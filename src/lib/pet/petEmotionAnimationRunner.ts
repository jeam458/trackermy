/**
 * Ejecuta recetas declarativas con animejs (lista blanca en `petEmotionAnimationRecipe.ts`).
 * Nunca evalúa código arbitrario desde la BD.
 */
import { animate } from '@/lib/animeUi'
import type { JSAnimation } from 'animejs'
import type { PetAmbientRecipe, PetAnimTrack, PetEnterRecipe } from '@/lib/pet/petEmotionAnimationRecipe'

function resolveTarget(wrapEl: HTMLElement, faceEl: HTMLElement, target: PetAnimTrack['target']): HTMLElement | null {
  if (target === 'wrap') return wrapEl
  return faceEl
}

function tweenToAnimateParams(tween: PetAnimTrack['tween']): Record<string, unknown> {
  const key = tween.prop
  const out: Record<string, unknown> = {
    [key]: tween.keyframes,
    duration: tween.duration,
  }
  if (tween.ease) out.ease = tween.ease
  if (tween.loop) out.loop = true
  if (tween.delay != null) out.delay = tween.delay
  return out
}

export function runAmbientRecipeFromDb(
  wrapEl: HTMLElement | null,
  faceEl: HTMLElement | null,
  recipe: PetAmbientRecipe,
  showcaseScale = 1
): () => void {
  if (!wrapEl || !faceEl) return () => {}
  const anims: JSAnimation[] = []
  const s = showcaseScale
  let appliedWrapFilter = false
  if (recipe.wrapStyle?.filter) {
    wrapEl.style.filter = recipe.wrapStyle.filter
    appliedWrapFilter = true
  }
  for (const track of recipe.tracks) {
    const el = resolveTarget(wrapEl, faceEl, track.target)
    if (!el) continue
    const params = tweenToAnimateParams(track.tween) as Parameters<typeof animate>[1]
    if (typeof params.duration === 'number') {
      params.duration = Math.round(Number(params.duration) * s)
    }
    anims.push(animate(el, params))
  }
  return () => {
    for (const a of anims) {
      try {
        a.revert()
      } catch {
        /* noop */
      }
    }
    if (appliedWrapFilter) {
      wrapEl.style.filter = ''
    }
    wrapEl.style.boxShadow = ''
  }
}

export function runEnterRecipeFromDb(
  wrapEl: HTMLElement | null,
  faceEl: HTMLElement | null,
  recipe: PetEnterRecipe
): () => void {
  if (!wrapEl || !faceEl) return () => {}
  const anims: JSAnimation[] = []
  for (const track of recipe.tracks) {
    const el = resolveTarget(wrapEl, faceEl, track.target)
    if (!el) continue
    const params = tweenToAnimateParams(track.tween) as Parameters<typeof animate>[1]
    anims.push(animate(el, params))
  }
  return () => {
    for (const a of anims) {
      try {
        a.revert()
      } catch {
        /* noop */
      }
    }
  }
}
