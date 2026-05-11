/**
 * Ojos del pet mirando hacia el aviso (toast → rider guide) con animejs.
 */
import { animate } from '@/lib/animeUi'
import type { JSAnimation } from 'animejs'

export type ToastGlanceDirection = 'below' | 'above'

/**
 * Mirada rápida + parpadeo. `below` = hacia la burbuja bajo el orb (dashboard);
 * `above` = hacia arriba (p. ej. toasts visibles top-center).
 */
export function runToastGlanceOnPupils(
  pupilsRowEl: HTMLElement | null,
  size: number,
  direction: ToastGlanceDirection = 'below'
): () => void {
  if (!pupilsRowEl) return () => {}
  const anims: JSAnimation[] = []

  const dy = direction === 'below' ? size * 0.12 : -size * 0.1
  const dx = size * 0.035

  anims.push(
    animate(pupilsRowEl, {
      y: [0, dy, dy * 0.82, 0],
      x: [0, dx, dx * 0.4, 0],
      duration: 820,
      ease: 'outCubic',
    })
  )

  anims.push(
    animate(pupilsRowEl, {
      scaleY: [1, 0.1, 1, 0.12, 1],
      duration: 340,
      delay: 640,
      ease: 'inOutQuad',
    })
  )

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
