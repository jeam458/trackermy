import { NextResponse } from 'next/server'
import { createClient } from '@/core/infrastructure/supabase/server'
import { parseAmbientRecipe, parseEnterRecipe } from '@/lib/pet/petEmotionAnimationRecipe'
import type { PetEmotionRegistryEntry } from '@/lib/pet/petEmotionRegistry.types'
import {
  PET_PROCEDURAL_FACE_JSON_KEYS,
  parseProceduralFacePartial,
} from '@/lib/pet/petProceduralFaceRecipe'

function mapRow(row: {
  slug: string
  label_es: string | null
  atlas_slot: number | null
  focus_x: number | null
  focus_y: number | null
  zoom: number | null
  ambient_animations: unknown
  enter_animation: unknown
  procedural_face: unknown
}): PetEmotionRegistryEntry | null {
  const ambient = parseAmbientRecipe(row.ambient_animations)
  const enter = parseEnterRecipe(row.enter_animation)
  const hasRostro =
    row.focus_x != null &&
    row.focus_y != null &&
    row.zoom != null &&
    Number.isFinite(Number(row.focus_x)) &&
    Number.isFinite(Number(row.focus_y)) &&
    Number.isFinite(Number(row.zoom))
  const proceduralFace =
    row.procedural_face !== undefined && row.procedural_face !== null
      ? parseProceduralFacePartial(row.procedural_face)
      : null
  return {
    slug: row.slug,
    labelEs: typeof row.label_es === 'string' ? row.label_es : '',
    ambient,
    enter,
    rostro: hasRostro
      ? {
          focusX: Number(row.focus_x),
          focusY: Number(row.focus_y),
          zoom: Number(row.zoom),
        }
      : null,
    atlasSlot: row.atlas_slot != null && Number.isFinite(Number(row.atlas_slot)) ? Number(row.atlas_slot) : null,
    proceduralFace,
  }
}

/** Definiciones aprobadas para animar el pet (lectura autenticada vía RLS). */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('pet_emotion_definitions')
    .select(
      'slug, label_es, atlas_slot, focus_x, focus_y, zoom, ambient_animations, enter_animation, procedural_face'
    )
    .order('slug', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const definitions: PetEmotionRegistryEntry[] = []
  for (const raw of data || []) {
    const m = mapRow(raw as Parameters<typeof mapRow>[0])
    if (m) definitions.push(m)
  }

  return NextResponse.json({ definitions })
}

const SLUG_RE = /^[a-z][a-z0-9_]{1,62}$/

type ProposalBody = {
  slug?: string
  label_es?: string
  focus_x?: number | null
  focus_y?: number | null
  zoom?: number | null
  atlas_slot?: number | null
  ambient_animations?: unknown
  enter_animation?: unknown
  procedural_face?: unknown
}

/** Cola de nuevas emociones / recetas (validación estricta; merge a `definitions` es paso aparte). */
export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let body: ProposalBody
  try {
    body = (await req.json()) as ProposalBody
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : ''
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json(
      { error: 'slug inválido (min 2, max 63, solo minúsculas, números y _)' },
      { status: 400 }
    )
  }

  const ambient = parseAmbientRecipe(body.ambient_animations as unknown)
  if (!ambient) {
    return NextResponse.json(
      { error: 'ambient_animations inválido: se requiere { tracks: [...] } con tweens permitidos' },
      { status: 400 }
    )
  }

  const enter = body.enter_animation != null ? parseEnterRecipe(body.enter_animation) : null
  if (body.enter_animation != null && !enter) {
    return NextResponse.json({ error: 'enter_animation inválido' }, { status: 400 })
  }

  let proceduralFace: ReturnType<typeof parseProceduralFacePartial> = null
  if (body.procedural_face !== undefined && body.procedural_face !== null) {
    const raw = body.procedural_face
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      return NextResponse.json({ error: 'procedural_face debe ser un objeto' }, { status: 400 })
    }
    const o = raw as Record<string, unknown>
    const allowed = new Set<string>([...PET_PROCEDURAL_FACE_JSON_KEYS])
    for (const k of Object.keys(o)) {
      if (!allowed.has(k)) {
        return NextResponse.json({ error: `procedural_face: clave no permitida (${k})` }, { status: 400 })
      }
    }
    const parsed = parseProceduralFacePartial(raw)
    if (Object.keys(o).length > 0 && parsed === null) {
      return NextResponse.json(
        { error: 'procedural_face inválido (valores fuera de lista o tipos incorrectos)' },
        { status: 400 }
      )
    }
    proceduralFace = parsed
  }

  const label_es = typeof body.label_es === 'string' ? body.label_es.trim().slice(0, 120) : slug
  const fx = body.focus_x
  const fy = body.focus_y
  const zm = body.zoom
  const slot = body.atlas_slot

  const { data, error } = await supabase
    .from('pet_emotion_proposals')
    .insert({
      slug,
      label_es: label_es || slug,
      focus_x: fx != null && Number.isFinite(fx) ? fx : null,
      focus_y: fy != null && Number.isFinite(fy) ? fy : null,
      zoom: zm != null && Number.isFinite(zm) ? zm : null,
      atlas_slot: slot != null && Number.isFinite(slot) ? Math.floor(Number(slot)) : null,
      ambient_animations: ambient,
      enter_animation: enter,
      procedural_face: proceduralFace,
      proposed_by: user.id,
      status: 'pending',
    })
    .select('id, slug, status, created_at')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, proposal: data })
}
