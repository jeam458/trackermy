'use client'

import type { GuidePetMood } from '@/lib/pet/guidePetBridge'

type Props = {
  mood: GuidePetMood | null
  isThinking: boolean
  /** Tamaño del contenedor del atlas (px). */
  size?: number
  className?: string
}

/**
 * Capa SVG mínima (ojos) sobre el atlas: puede competir con el PNG + pupilas HTML.
 * En el rider suele mostrarse solo mientras la guía está “pensando” (WebLLM).
 */
export function GuidePetMoodEyesOverlay({ mood, isThinking, size = 52, className = '' }: Props) {
  if (!isThinking && !mood) return null

  const effective: GuidePetMood = isThinking ? 'analyzing' : mood ?? 'neutral'
  const eyeY =
    effective === 'warning' ? -4 : effective === 'analyzing' ? 3 : effective === 'stoked' ? -2 : effective === 'happy' ? -1 : 0
  const rx = effective === 'analyzing' ? 5.2 : effective === 'warning' ? 5.8 : 5
  const ry = effective === 'analyzing' ? 2.8 : effective === 'stoked' ? 5.6 : 4.8
  const opacity = isThinking ? 0.55 : 0.42

  return (
    <svg
      className={`pointer-events-none absolute left-1/2 top-[18%] -translate-x-1/2 text-cyan-100/90 ${className}`}
      width={Math.round(size * 0.72)}
      height={Math.round(size * 0.28)}
      viewBox="0 0 100 36"
      aria-hidden
      style={{ opacity }}
    >
      <ellipse
        cx="32"
        cy={18 + eyeY}
        rx={rx}
        ry={ry}
        className="fill-current transition-all duration-300 ease-out"
      />
      <ellipse
        cx="68"
        cy={18 + eyeY}
        rx={rx}
        ry={ry}
        className="fill-current transition-all duration-300 ease-out"
      />
      {isThinking ? (
        <circle cx="32" cy={18 + eyeY} r="1.6" className="fill-slate-900/70" />
      ) : null}
      {isThinking ? (
        <circle cx="68" cy={18 + eyeY} r="1.6" className="fill-slate-900/70" />
      ) : null}
    </svg>
  )
}
