import { NextResponse } from 'next/server'
import { createClient } from '@/core/infrastructure/supabase/server'
import { enqueueMaintenanceCatalogResearchIfNeeded } from '@/lib/maintenance/enqueueCatalogResearch'

const MAX_LEN = 240

type Body = {
  rawBrand?: unknown
  rawModel?: unknown
  rawVariant?: unknown
  categorySlug?: unknown
  userNotes?: unknown
  /** p.ej. profile_frame_field | profile_bike_brand | manual */
  sourceContext?: unknown
}

function str(v: unknown): string | null {
  if (v === undefined || v === null) return null
  if (typeof v !== 'string') return null
  const t = v.trim()
  if (!t) return null
  if (t.length > MAX_LEN) {
    return t.slice(0, MAX_LEN)
  }
  return t
}

/**
 * Encola una solicitud para investigar un componente (marca/modelo/variante) y
 * más adelante fusionar al catálogo `maintenance_*` (IA + curación o worker).
 */
export async function POST(req: Request) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ ok: false, code: 'BAD_JSON', message: 'Cuerpo JSON inválido.' }, { status: 400 })
  }

  const rawBrand = str(body.rawBrand)
  const rawModel = str(body.rawModel)
  if (!rawBrand) {
    return NextResponse.json(
      { ok: false, code: 'MISSING_FIELDS', message: 'rawBrand es obligatorio; rawModel opcional (solo marca).' },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, code: 'UNAUTHORIZED', message: 'No autenticado.' }, { status: 401 })
  }

  const rawVariant = str(body.rawVariant)
  const categorySlug = str(body.categorySlug)
  const userNotes = str(body.userNotes)
  const sourceContextRaw = str(body.sourceContext)
  const sourceContext = sourceContextRaw || 'manual'

  const res = await enqueueMaintenanceCatalogResearchIfNeeded(supabase, {
    userId: user.id,
    rawBrand,
    rawModel: rawModel ?? null,
    rawVariant,
    categorySlug,
    userNotes,
    sourceContext,
  })

  if (!res.inserted) {
    if (res.reason === 'covered') {
      return NextResponse.json({
        ok: true,
        skipped: true,
        message:
          'El catálogo de mantenimiento ya cubre esta marca/modelo (no se duplicó la cola). Si falta una variante (carrera, año), usá rawVariant o pedí skill `request_maintenance_catalog_research` con más detalle.',
      })
    }
    if (res.reason === 'invalid') {
      return NextResponse.json({ ok: false, code: 'INVALID', message: 'rawBrand vacío.' }, { status: 400 })
    }
    return NextResponse.json(
      { ok: false, code: 'DB_INSERT', message: 'No se pudo guardar la solicitud.' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    id: res.id,
    status: 'pending' as const,
    message:
      'Solicitud registrada. El worker admin (`/api/admin/maintenance-catalog-research-run`) llena `proposed_payload` con el skill de investigación; merge al catálogo publicado sigue siendo paso aparte.',
  })
}
