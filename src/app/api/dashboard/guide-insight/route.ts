import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createClient } from '@/core/infrastructure/supabase/server'
import type { GuideScreenKind } from '@/lib/guide-ai/types'

const ALLOWED_KINDS = new Set<GuideScreenKind>([
  'dashboard_home',
  'route_detail',
  'attempt_stats',
  'replay',
  'ranking',
  'profile',
  'activity',
  'discover',
  'record',
  'other',
])

/** Tabla no migrada o no expuesta en API; evitamos 500 en navegación (fire-and-forget del cliente). */
function isGuideInsightTableUnavailable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  const c = String(err.code || '')
  const m = String(err.message || '').toLowerCase()
  return (
    c === '42P01' ||
    c === 'PGRST205' ||
    m.includes('does not exist') ||
    m.includes('schema cache') ||
    m.includes('could not find the table')
  )
}

async function bumpAggregateInsight(
  supabase: Awaited<ReturnType<typeof createClient>>,
  screen_kind: GuideScreenKind,
  insight_key: string,
  now: string
): Promise<{ ok: boolean; error?: string }> {
  const { data: row, error: selErr } = await supabase
    .from('guide_coach_aggregate_insights')
    .select('id, score')
    .eq('screen_kind', screen_kind)
    .eq('insight_key', insight_key)
    .maybeSingle()

  if (selErr) {
    if (isGuideInsightTableUnavailable(selErr)) return { ok: false }
    return { ok: false, error: selErr.message }
  }
  if (!row?.id) return { ok: false, error: 'Fila no encontrada tras conflicto' }
  const score = Number(row.score) || 1
  const { error: upErr } = await supabase
    .from('guide_coach_aggregate_insights')
    .update({ score: score + 1, last_seen_at: now })
    .eq('id', row.id)
  if (upErr) {
    if (isGuideInsightTableUnavailable(upErr)) return { ok: false }
    return { ok: false, error: upErr.message }
  }
  return { ok: true }
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let body: { screen_kind?: unknown; insight_es?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const screen_kind = String(body.screen_kind || '').trim() as GuideScreenKind
  if (!ALLOWED_KINDS.has(screen_kind)) {
    return NextResponse.json({ error: 'screen_kind inválido' }, { status: 400 })
  }

  let insight_es = String(body.insight_es || '').trim().replace(/\s+/g, ' ')
  insight_es = insight_es.slice(0, 400)
  if (insight_es.length < 12) {
    return NextResponse.json({ error: 'Texto demasiado corto' }, { status: 400 })
  }

  const insight_key = createHash('sha256').update(`${screen_kind}|${insight_es}`).digest('hex').slice(0, 48)

  const { data: existing, error: selErr } = await supabase
    .from('guide_coach_aggregate_insights')
    .select('id, score')
    .eq('screen_kind', screen_kind)
    .eq('insight_key', insight_key)
    .maybeSingle()

  if (selErr) {
    if (isGuideInsightTableUnavailable(selErr)) {
      console.warn('[guide-insight] tabla no disponible:', selErr.message)
      return NextResponse.json({ ok: false, skipped: true }, { status: 200 })
    }
    return NextResponse.json({ error: selErr.message }, { status: 500 })
  }

  const now = new Date().toISOString()
  if (existing && typeof (existing as { id?: string }).id === 'string') {
    const id = (existing as { id: string }).id
    const score = Number((existing as { score?: unknown }).score) || 1
    const { error: upErr } = await supabase
      .from('guide_coach_aggregate_insights')
      .update({ score: score + 1, last_seen_at: now })
      .eq('id', id)
    if (upErr) {
      if (isGuideInsightTableUnavailable(upErr)) {
        console.warn('[guide-insight] tabla no disponible (update):', upErr.message)
        return NextResponse.json({ ok: false, skipped: true }, { status: 200 })
      }
      return NextResponse.json({ error: upErr.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, mode: 'bump' })
  }

  const { error: insErr } = await supabase.from('guide_coach_aggregate_insights').insert({
    screen_kind,
    insight_key,
    insight_es,
    score: 1,
    last_seen_at: now,
  })
  if (insErr) {
    if (insErr.code === '23505') {
      const bumped = await bumpAggregateInsight(supabase, screen_kind, insight_key, now)
      if (bumped.ok) return NextResponse.json({ ok: true, mode: 'bump_race' })
      if (!bumped.error) {
        console.warn('[guide-insight] conflicto único pero bump no aplicable:', insErr.message)
        return NextResponse.json({ ok: false, skipped: true }, { status: 200 })
      }
      return NextResponse.json({ error: bumped.error }, { status: 500 })
    }
    if (isGuideInsightTableUnavailable(insErr)) {
      console.warn('[guide-insight] tabla no disponible (insert):', insErr.message)
      return NextResponse.json({ ok: false, skipped: true }, { status: 200 })
    }
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, mode: 'insert' })
}
