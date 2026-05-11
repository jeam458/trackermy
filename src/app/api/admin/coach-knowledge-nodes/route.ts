import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { assertCoachAdminRequest, getCoachAdminSecret } from '@/lib/admin/coachAdminAuth'
import type { CoachEvidenceStrength } from '@/lib/guide-ai/coachKnowledgeTree.types'

function serviceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) return null
  return createClient(url, key)
}

function isEvidenceStrength(s: string): s is CoachEvidenceStrength {
  return s === 'literature_synthesis' || s === 'practice_consensus' || s === 'program_design_meta'
}

type UpsertBody = {
  id: string
  parent_id?: string | null
  level?: number
  title_es: string
  summary_es: string
  practice_cues?: string[]
  tags?: string[]
  evidence_strength: string
  citation_label_es: string
  source_url?: string | null
  sort_order?: number
  is_active?: boolean
}

function mapError(e: unknown): NextResponse {
  const m = e instanceof Error ? e.message : 'error'
  if (m === 'DISABLED') {
    return NextResponse.json(
      {
        ok: false,
        code: 'ADMIN_DISABLED',
        message:
          'Definí GUIDE_COACH_ADMIN_SECRET (≥16 chars) y SUPABASE_SERVICE_ROLE_KEY en el entorno del servidor.',
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
 * CRUD de `coach_knowledge_nodes` con **service_role** (sin redeploy de código).
 *
 * - `GET`: lista nodos (activos por defecto; `?all=1` incluye inactivos).
 * - `POST`: upsert de un nodo (cuerpo JSON `UpsertBody`).
 * - `PATCH`: `{"id":"…","is_active":false}` para baja lógica.
 *
 * Cabecera: `x-coach-admin-secret: <GUIDE_COACH_ADMIN_SECRET>` o `Authorization: Bearer <mismo>`.
 */
export async function GET(req: Request) {
  try {
    assertCoachAdminRequest(req)
  } catch (e) {
    return mapError(e)
  }
  const sb = serviceSupabase()
  if (!sb) {
    return NextResponse.json({ ok: false, code: 'NO_SERVICE_KEY', message: 'Falta SUPABASE_SERVICE_ROLE_KEY.' }, { status: 503 })
  }
  const url = new URL(req.url)
  const all = url.searchParams.get('all') === '1'
  let q = sb.from('coach_knowledge_nodes').select('*').order('sort_order', { ascending: true }).order('id', { ascending: true })
  if (!all) {
    q = q.eq('is_active', true)
  }
  const { data, error } = await q
  if (error) {
    return NextResponse.json({ ok: false, code: 'DB', message: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, nodes: data ?? [] })
}

export async function POST(req: Request) {
  try {
    assertCoachAdminRequest(req)
  } catch (e) {
    return mapError(e)
  }
  const sb = serviceSupabase()
  if (!sb) {
    return NextResponse.json({ ok: false, code: 'NO_SERVICE_KEY', message: 'Falta SUPABASE_SERVICE_ROLE_KEY.' }, { status: 503 })
  }
  let body: UpsertBody
  try {
    body = (await req.json()) as UpsertBody
  } catch {
    return NextResponse.json({ ok: false, code: 'BAD_JSON', message: 'JSON inválido.' }, { status: 400 })
  }
  const id = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : ''
  if (!id || typeof body.title_es !== 'string' || typeof body.summary_es !== 'string') {
    return NextResponse.json({ ok: false, code: 'VALIDATION', message: 'Requerido: id, title_es, summary_es.' }, { status: 400 })
  }
  if (!isEvidenceStrength(String(body.evidence_strength))) {
    return NextResponse.json(
      { ok: false, code: 'VALIDATION', message: 'evidence_strength inválido.' },
      { status: 400 }
    )
  }
  const row = {
    id,
    parent_id: body.parent_id ?? null,
    level: typeof body.level === 'number' && body.level >= 1 ? Math.min(8, Math.floor(body.level)) : 1,
    title_es: body.title_es.trim(),
    summary_es: body.summary_es.trim(),
    practice_cues: Array.isArray(body.practice_cues) ? body.practice_cues : [],
    tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
    evidence_strength: body.evidence_strength,
    citation_label_es: String(body.citation_label_es || '').trim() || 'Síntesis interna GuardDH.',
    source_url: body.source_url ?? null,
    sort_order: typeof body.sort_order === 'number' ? Math.floor(body.sort_order) : 0,
    is_active: body.is_active !== false,
    updated_at: new Date().toISOString(),
  }
  const { error } = await sb.from('coach_knowledge_nodes').upsert(row, { onConflict: 'id' })
  if (error) {
    return NextResponse.json({ ok: false, code: 'DB', message: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, id })
}

export async function PATCH(req: Request) {
  try {
    assertCoachAdminRequest(req)
  } catch (e) {
    return mapError(e)
  }
  const sb = serviceSupabase()
  if (!sb) {
    return NextResponse.json({ ok: false, code: 'NO_SERVICE_KEY', message: 'Falta SUPABASE_SERVICE_ROLE_KEY.' }, { status: 503 })
  }
  let body: { id?: string; is_active?: boolean }
  try {
    body = (await req.json()) as { id?: string; is_active?: boolean }
  } catch {
    return NextResponse.json({ ok: false, code: 'BAD_JSON', message: 'JSON inválido.' }, { status: 400 })
  }
  const id = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : ''
  if (!id || typeof body.is_active !== 'boolean') {
    return NextResponse.json({ ok: false, code: 'VALIDATION', message: 'Requerido: id, is_active (boolean).' }, { status: 400 })
  }
  const { error } = await sb
    .from('coach_knowledge_nodes')
    .update({ is_active: body.is_active, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) {
    return NextResponse.json({ ok: false, code: 'DB', message: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, id })
}

/** HEAD: comprobar que el secreto y service_role están configurados (sin listar datos). */
export async function HEAD() {
  if (!getCoachAdminSecret()) {
    return new NextResponse(null, { status: 503 })
  }
  if (!serviceSupabase()) {
    return new NextResponse(null, { status: 503 })
  }
  return new NextResponse(null, { status: 204 })
}
