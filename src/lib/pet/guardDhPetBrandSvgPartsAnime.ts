/**
 * Micro-tweens sobre paths etiquetados `data-gdh-part` en el SVG de marca.
 * Complementa el bounce global (wrap/face) sin reemplazarlo.
 */
import { animate } from '@/lib/animeUi'
import type { JSAnimation } from 'animejs'
import type { PetEmotion } from '@/components/pet/guardDhPetTypes'
import { queryPart } from '@/lib/pet/petSvgPathParts'

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

/**
 * Pulso corto al entrar en una emoción (no loop; evita pelear con ambient del wrap).
 */
export function playPetBrandSvgPartEnter(svg: SVGSVGElement | null, emotion: PetEmotion): () => void {
  if (!svg) return () => {}

  const mouth = queryPart(svg, 'mouth')
  const eyeL = queryPart(svg, 'eye-left')
  const eyeR = queryPart(svg, 'eye-right')
  const visor = queryPart(svg, 'visor')
  const brows = queryPart(svg, 'brow')
  const cheeks = queryPart(svg, 'cheek')

  const anims: JSAnimation[] = []
  const hasMouth = mouth.length > 0
  const hasEyes = eyeL.length + eyeR.length > 0

  const safe = (targets: Element[], params: Record<string, unknown>) => {
    if (!targets.length) return
    anims.push(animate(targets, params as Parameters<typeof animate>[1]))
  }

  switch (emotion) {
    case 'ayuda_exitosa_fiesta':
      if (hasMouth) {
        safe(mouth, { scaleY: [1, 1.12, 1], duration: 420, ease: 'outBack' })
      }
      safe(cheeks, { scale: [1, 1.08, 1], duration: 480, ease: 'outQuad' })
      break
    case 'confusion_error':
    case 'molesto':
      safe(brows, { translateY: [0, -2.5, 0], duration: 380, ease: 'inOutSine' })
      if (hasMouth) {
        safe(mouth, { translateY: [0, 3, 0], duration: 360, ease: 'outQuad' })
      }
      break
    case 'cansado':
    case 'cansado_flor':
    case 'exhausto':
    case 'exhausto_total':
      if (hasEyes) {
        safe([...eyeL, ...eyeR], { translateY: [0, 2.5, 0], opacity: [1, 0.88, 1], duration: 520, ease: 'inOutSine' })
      }
      break
    case 'velocidad_critica':
      if (hasEyes) {
        safe([...eyeL, ...eyeR], { scaleX: [1, 1.08, 1], scaleY: [1, 1.06, 1], duration: 280, ease: 'outQuad' })
      }
      break
    case 'conexion_perdida':
      safe([...mouth, ...visor, ...eyeL, ...eyeR], { opacity: [1, 0.58, 1], duration: 280, ease: 'linear' })
      break
    case 'pensando_mapa':
    case 'pensando_minimal':
      safe(visor, { translateX: [0, -1.2, 1.2, 0], duration: 1400, ease: 'inOutSine', loop: 2 })
      break
    case 'principal':
    case 'saludo':
    case 'inicio_ruta':
    case 'fin_ruta':
    default:
      if (hasMouth) {
        safe(mouth, { scaleY: [1, 1.06, 1], duration: 340, ease: 'outQuad' })
      }
      break
  }

  return dispose(anims)
}
