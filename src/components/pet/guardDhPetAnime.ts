/**
 * Motor de animación del pet (animejs v4):
 * - Crossfade entre capas del atlas (siempre aquí).
 * - Bucles y micro-entradas: delegan en `petEmotionAnimationRunner` + recetas.
 * - Recetas por emoción: BD (`dbAmbient` / `dbEnter`) o catálogo embebido `petEmotionBuiltinRecipes.ts`.
 * Para nuevas emociones / “cara gruñona” / color: preferí datos en BD o en el catálogo embebido, no lógica nueva en este archivo.
 */
import { animate } from '@/lib/animeUi'
import type { JSAnimation } from 'animejs'
import type { PetEmotion } from '@/components/pet/guardDhPetTypes'
import type { PetAmbientRecipe, PetEnterRecipe } from '@/lib/pet/petEmotionAnimationRecipe'
import {
  getBuiltinAmbientRecipe,
  getBuiltinEnterRecipe,
} from '@/lib/pet/petEmotionBuiltinRecipes'
import { runAmbientRecipeFromDb, runEnterRecipeFromDb } from '@/lib/pet/petEmotionAnimationRunner'

function dispose(anims: JSAnimation[]) {
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

function transitionDurationMs(from: PetEmotion | undefined, to: PetEmotion): number {
  if (to === 'ayuda_exitosa_fiesta' || from === 'ayuda_exitosa_fiesta') return 520
  if (to === 'conexion_perdida' || from === 'conexion_perdida') return 300
  if (to === 'cansado_flor' || from === 'cansado_flor' || to === 'cansado' || from === 'cansado') return 480
  if (to === 'exhausto_total' || from === 'exhausto_total') return 520
  return 400
}

/**
 * Crossfade entre dos capas del MISMO atlas de rostro (`out` → `in`).
 * `inEl` ya debe tener el `background-position` de la nueva emoción aplicado antes de llamar.
 */
export function playRostroExpressionCrossfade(
  outEl: HTMLElement,
  inEl: HTMLElement,
  from: PetEmotion | undefined,
  to: PetEmotion
): () => void {
  const anims: JSAnimation[] = []

  if (from === to) return () => {}

  if (from === undefined) {
    outEl.style.opacity = '1'
    outEl.style.transform = 'scale(1)'
    outEl.style.filter = 'none'
    inEl.style.opacity = '0'
    inEl.style.transform = 'scale(1)'
    inEl.style.filter = 'none'
    return () => {}
  }

  const ms = transitionDurationMs(from, to)
  inEl.style.opacity = '0'
  inEl.style.transform = 'scale(1.05)'
  outEl.style.filter = 'none'

  const easeOut = to === 'ayuda_exitosa_fiesta' ? 'outQuad' : 'outCubic'
  const easeIn = to === 'conexion_perdida' ? 'linear' : 'inQuad'

  anims.push(
    animate(outEl, {
      opacity: [1, 0],
      scale: [1, 0.93],
      duration: Math.round(ms * 0.55),
      ease: easeIn,
    })
  )
  anims.push(
    animate(inEl, {
      opacity: [0, 1],
      scale: [1.05, 1],
      duration: ms,
      ease: easeOut,
      delay: Math.round(ms * 0.08),
    })
  )

  return () => {
    outEl.style.filter = ''
    inEl.style.filter = ''
    dispose(anims)()
  }
}

/**
 * Bucles ambient: receta desde BD si existe; si no, catálogo embebido (`petEmotionBuiltinRecipes`).
 */
export function runPetAmbientAnimations(
  wrapEl: HTMLElement | null,
  faceEl: HTMLElement | null,
  emotion: PetEmotion,
  showcase: boolean,
  dbAmbient: PetAmbientRecipe | null = null
): () => void {
  if (!wrapEl || !faceEl) return () => {}
  const recipe = dbAmbient ?? getBuiltinAmbientRecipe(emotion)
  return runAmbientRecipeFromDb(wrapEl, faceEl, recipe, showcase ? 0.88 : 1)
}

/** Micro-entrada al cambiar de emoción (receta BD o catálogo embebido). */
export function playPetEmotionEnter(
  wrapEl: HTMLElement | null,
  faceEl: HTMLElement | null,
  emotion: PetEmotion,
  dbEnter: PetEnterRecipe | null = null
): () => void {
  if (!faceEl || !wrapEl) return () => {}
  const recipe = dbEnter ?? getBuiltinEnterRecipe(emotion)
  return runEnterRecipeFromDb(wrapEl, faceEl, recipe)
}
