import { parseAmbientRecipe, parseEnterRecipe } from '@/lib/pet/petEmotionAnimationRecipe'
import { parseProceduralFacePartial } from '@/lib/pet/petProceduralFaceRecipe'

const SLUG_RE = /^[a-z][a-z0-9_]{1,62}$/

export function isPetEmotionProposalExperimentEnabled(): boolean {
  return (
    typeof process !== 'undefined' &&
    String(process.env.NEXT_PUBLIC_GUIDE_PET_EMOTION_PROPOSALS || '').trim() === '1'
  )
}

/**
 * Si el modelo WebLLM devuelve `pet_emotion_proposal` y el flag público está activo,
 * envía una fila a `pet_emotion_proposals` (validación en API + lista blanca de recetas).
 */
export async function maybeSubmitPetEmotionProposalFromLlm(raw: unknown): Promise<{
  ok: boolean
  reason?: string
}> {
  if (!isPetEmotionProposalExperimentEnabled()) {
    return { ok: false, reason: 'disabled' }
  }
  if (typeof window === 'undefined') {
    return { ok: false, reason: 'server' }
  }
  if (!raw || typeof raw !== 'object') {
    return { ok: false, reason: 'empty' }
  }
  const o = raw as Record<string, unknown>
  const slug = typeof o.slug === 'string' ? o.slug.trim().toLowerCase() : ''
  if (!SLUG_RE.test(slug)) {
    return { ok: false, reason: 'slug' }
  }
  if (!parseAmbientRecipe(o.ambient_animations)) {
    return { ok: false, reason: 'ambient' }
  }
  if (o.enter_animation != null && !parseEnterRecipe(o.enter_animation)) {
    return { ok: false, reason: 'enter' }
  }
  if (o.procedural_face != null) {
    if (typeof o.procedural_face !== 'object' || Array.isArray(o.procedural_face)) {
      return { ok: false, reason: 'procedural_face' }
    }
    const pf = parseProceduralFacePartial(o.procedural_face)
    const keys = Object.keys(o.procedural_face as object)
    if (keys.length > 0 && pf === null) {
      return { ok: false, reason: 'procedural_face' }
    }
  }

  try {
    const payload: Record<string, unknown> = {
      slug,
      label_es: o.label_es,
      focus_x: o.focus_x,
      focus_y: o.focus_y,
      zoom: o.zoom,
      atlas_slot: o.atlas_slot,
      ambient_animations: o.ambient_animations,
      enter_animation: o.enter_animation,
    }
    if (o.procedural_face != null && typeof o.procedural_face === 'object' && !Array.isArray(o.procedural_face)) {
      payload.procedural_face = o.procedural_face
    }
    const r = await fetch('/api/dashboard/pet-emotions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      return { ok: false, reason: j.error || `http_${r.status}` }
    }
    return { ok: true }
  } catch {
    return { ok: false, reason: 'network' }
  }
}
