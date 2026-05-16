import { NextResponse } from 'next/server'
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

function isTableUnavailable(err: { code?: string; message?: string } | null): boolean {
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

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let body: { screen_kind?: unknown; sentiment?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const screen_kind = String(body.screen_kind || '').trim() as GuideScreenKind
  if (!ALLOWED_KINDS.has(screen_kind)) {
    return NextResponse.json({ error: 'screen_kind inválido' }, { status: 400 })
  }

  const s = Number(body.sentiment)
  if (s !== 1 && s !== -1) {
    return NextResponse.json({ error: 'sentiment debe ser 1 o -1' }, { status: 400 })
  }

  const { error } = await supabase.from('guide_coach_turn_feedback').insert({
    user_id: user.id,
    screen_kind,
    sentiment: s,
  })

  if (error) {
    if (isTableUnavailable(error)) {
      return NextResponse.json({ ok: false, code: 'TABLE_MISSING' }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
