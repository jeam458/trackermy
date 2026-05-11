import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { assertCoachAdminRequest, getCoachAdminSecret } from '@/lib/admin/coachAdminAuth'
import { runCatalogResearchLlm } from '@/lib/maintenance/runCatalogResearchLlm'

function serviceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) return null
  return createClient(url, key)
}

function mapAdminError(e: unknown): NextResponse {
  const m = e instanceof Error ? e.message : 'error'
  if (m === 'DISABLED') {
    return NextResponse.json(
      {
        ok: false,
        code: 'ADMIN_DISABLED',
        message: 'Definí GUIDE_COACH_ADMIN_SECRET (≥16 chars) y SUPABASE_SERVICE_ROLE_KEY.',
      },
      { status: 503 }
    )
  }
  if (m === 'FORBIDDEN') {
    return NextResponse.json({ ok: false, code: 'FORBIDDEN', message: 'Secreto admin inválido o ausente.' }, { status: 403 })
  }
  return NextResponse.json({ ok: false, code: 'INTERNAL', message: m }, { status: 500 })
}

/**
 * Procesa solicitudes `pending` de `maintenance_catalog_research_requests` con OpenAI
 * (skill `catalogResearchSkill`) y guarda `proposed_payload`. No merge al catálogo publicado.
 *
 * Cabecera: `x-coach-admin-secret` o `Authorization: Bearer` (mismo `GUIDE_COACH_ADMIN_SECRET`).
 * Query: `?limit=5` (1–20).
 */
export async function GET(req: Request) {
  try {
    assertCoachAdminRequest(req)
  } catch (e) {
    return mapAdminError(e)
  }
  const sb = serviceSupabase()
  if (!sb) {
    return NextResponse.json({ ok: false, code: 'NO_SERVICE_KEY', message: 'Falta SUPABASE_SERVICE_ROLE_KEY.' }, { status: 503 })
  }
  const { count, error } = await sb
    .from('maintenance_catalog_research_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 })
  }
  return NextResponse.json({
    ok: true,
    pending: typeof count === 'number' ? count : 0,
    has_openai: Boolean(process.env.OPENAI_API_KEY?.trim()),
    has_admin_secret: Boolean(getCoachAdminSecret()),
  })
}

export async function POST(req: Request) {
  try {
    assertCoachAdminRequest(req)
  } catch (e) {
    return mapAdminError(e)
  }
  const sb = serviceSupabase()
  if (!sb) {
    return NextResponse.json({ ok: false, code: 'NO_SERVICE_KEY', message: 'Falta SUPABASE_SERVICE_ROLE_KEY.' }, { status: 503 })
  }

  const url = new URL(req.url)
  let limit = 5
  const lim = Number(url.searchParams.get('limit'))
  if (Number.isFinite(lim) && lim >= 1 && lim <= 20) limit = Math.floor(lim)

  const { data: rows, error } = await sb
    .from('maintenance_catalog_research_requests')
    .select('id, raw_brand, raw_model, raw_variant, category_slug, user_notes, status')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 })
  }

  const processed: string[] = []
  const failed: { id: string; error: string }[] = []

  for (const row of rows || []) {
    const id = String(row.id)
    const now = new Date().toISOString()
    const { data: claimed, error: uerr } = await sb
      .from('maintenance_catalog_research_requests')
      .update({ status: 'processing', updated_at: now })
      .eq('id', id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle()

    if (uerr || !claimed) continue

    const llm = await runCatalogResearchLlm({
      raw_brand: String(row.raw_brand || ''),
      raw_model: row.raw_model ? String(row.raw_model) : null,
      raw_variant: row.raw_variant ? String(row.raw_variant) : null,
      category_slug: row.category_slug ? String(row.category_slug) : null,
      user_notes: row.user_notes ? String(row.user_notes) : null,
    })

    if ('error' in llm) {
      const detail = 'detail' in llm && typeof llm.detail === 'string' ? llm.detail : ''
      const msg = [llm.error, detail].filter(Boolean).join(' | ').slice(0, 2000)
      await sb
        .from('maintenance_catalog_research_requests')
        .update({
          status: 'failed',
          error_message: msg,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
      failed.push({ id, error: llm.error })
      continue
    }

    const { error: ferr } = await sb
      .from('maintenance_catalog_research_requests')
      .update({
        status: 'completed',
        proposed_payload: llm.payload as unknown as Record<string, unknown>,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (ferr) {
      await sb
        .from('maintenance_catalog_research_requests')
        .update({
          status: 'failed',
          error_message: ferr.message.slice(0, 2000),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
      failed.push({ id, error: ferr.message })
      continue
    }

    processed.push(id)
  }

  return NextResponse.json({
    ok: true,
    processed_ids: processed,
    failed,
    batch_limit: limit,
  })
}
