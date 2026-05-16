import { animate, stagger } from 'animejs'
import type { JSAnimation } from 'animejs'

/** Entrada suave: opacidad + desplazamiento vertical (anime v4: `y` → translateY). */
export function fadeSlideIn(
  targets: Parameters<typeof animate>[0],
  options?: { duration?: number; delay?: number; y?: [number, number] }
): JSAnimation {
  const y = options?.y ?? [16, 0]
  return animate(targets, {
    opacity: [0, 1],
    y,
    duration: options?.duration ?? 420,
    delay: options?.delay ?? 0,
    ease: 'outCubic',
  })
}

/** Lista con hijos `[data-anime-stagger]`. */
export function staggerIn(
  container: Element | null,
  options?: { selector?: string; spacing?: number; start?: number; duration?: number }
): JSAnimation | undefined {
  if (!container) return
  const sel = options?.selector ?? '[data-anime-stagger]'
  const elements = container.querySelectorAll(sel)
  if (!elements.length) return
  return animate(elements, {
    opacity: [0, 1],
    y: [14, 0],
    duration: options?.duration ?? 380,
    delay: stagger(options?.spacing ?? 55, { start: options?.start ?? 0 }),
    ease: 'outCubic',
  })
}

/** Micro-feedback al tocar (iconos / filas). */
export function pressPop(el: Element | null): JSAnimation | undefined {
  if (!el) return
  return animate(el, {
    scale: [1, 0.94, 1],
    duration: 220,
    ease: 'outQuad',
  })
}

/** Pulso sutil (nav activo, badges). */
export function gentlePulse(el: Element | null): JSAnimation {
  return animate(el ?? document.body, {
    scale: [1, 1.06, 1],
    duration: 650,
    ease: 'inOutSine',
    loop: 2,
  })
}

/** Pulso al avanzar el replay en el icono del rider encima del mapa (Leaflet divIcon). */
export function replayRiderIconPulse(el: Element | null): JSAnimation | undefined {
  if (!el) return
  return animate(el, {
    scale: [1, 1.14, 1],
    rotate: ['0deg', '4deg', '-3deg', '0deg'],
    duration: 280,
    ease: 'outQuad',
  })
}

function shimmerGradientCss(): string {
  if (typeof window === 'undefined') {
    return 'linear-gradient(90deg, transparent 0%, rgba(227,120,69,0.12) 50%, transparent 100%)'
  }
  const h =
    typeof getComputedStyle === 'undefined'
      ? '#e37845'
      : getComputedStyle(document.documentElement).getPropertyValue('--gdh-brand-highlight').trim() ||
        '#e37845'
  const core =
    typeof getComputedStyle === 'undefined'
      ? '#c55a2f'
      : getComputedStyle(document.documentElement).getPropertyValue('--gdh-brand').trim() || '#c55a2f'

  /**
   * Protección SSR: valores por defecto PATT (`#e37845`, `#c55a2f`) si falta cascada CSS.
   * Evita teal/púrpura genéricos (anti-slop tipo Impeccable).
   */
  const safeHl = /^#|^rgb|^hsla?/i.test(h) ? h : '#e37845'
  const safeCore = /^#|^rgb|^hsla?/i.test(core) ? core : '#c55a2f'
  return `linear-gradient(90deg, transparent 0%, color-mix(in srgb, ${safeHl} 18%, transparent) 44%, color-mix(in srgb, ${safeCore} 14%, transparent) 56%, transparent 100%)`
}

/** Barra interna que se desplaza (shimmer); el padre debe ser `position: relative; overflow: hidden`. */
export function runShimmerSweep(barEl: HTMLElement | null): JSAnimation | undefined {
  if (!barEl) return
  barEl.style.background = shimmerGradientCss()
  barEl.style.width = '50%'
  return animate(barEl, {
    x: ['-100%', '250%'],
    duration: 1500,
    ease: 'linear',
    loop: true,
  })
}

export { animate, stagger }
