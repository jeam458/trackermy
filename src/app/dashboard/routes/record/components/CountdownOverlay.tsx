'use client'

import { useLayoutEffect, useRef } from 'react'
import { animate } from 'animejs'

const COUNTDOWN_STROKE_LEN = 264

export function CountdownOverlay({
  countdown,
  gradientId,
}: {
  countdown: number
  gradientId: string
}) {
  const ringRef = useRef<SVGCircleElement | null>(null)
  const labelRef = useRef<HTMLSpanElement | null>(null)
  const prevRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    const targetOff = COUNTDOWN_STROKE_LEN * (1 - countdown / 3)
    const fromOff = prevRef.current == null ? COUNTDOWN_STROKE_LEN : COUNTDOWN_STROKE_LEN * (1 - prevRef.current / 3)
    prevRef.current = countdown
    if (ringRef.current) {
      ringRef.current.setAttribute('stroke-dashoffset', String(fromOff))
      void animate(ringRef.current, { strokeDashoffset: [fromOff, targetOff], duration: 420, ease: 'outCubic' })
    }
    if (labelRef.current) {
      void animate(labelRef.current, { scale: [1.2, 1], opacity: [0.35, 1], duration: 280, ease: 'outCubic' })
    }
  }, [countdown])

  return (
    <div className="fixed inset-0 z-[10050] pointer-events-auto">
      <div className="absolute inset-0 bg-black/40" />
      <div className="absolute inset-x-0 top-0 h-[58vh] bg-gradient-to-b from-[#131a22]/95 to-[#131a22]/90 backdrop-blur-sm border-b border-white/10 flex flex-col items-center justify-center px-6">
        <p className="text-center text-2xl font-black tracking-tight text-white mb-5">¡Prepárate para la bajada!</p>
        <p className="mb-8 max-w-md text-center text-sm leading-relaxed text-slate-300">
          Iniciando validación de velocidad en el punto de partida...
        </p>
        <div className="relative w-52 h-52">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100" aria-hidden>
            <circle cx="50" cy="50" r="42" stroke="#334155" strokeWidth="5.5" fill="none" />
            <circle
              ref={ringRef}
              cx="50" cy="50" r="42"
              stroke={`url(#${gradientId})`}
              strokeWidth="5.5" fill="none" strokeLinecap="round"
              strokeDasharray={COUNTDOWN_STROKE_LEN}
              strokeDashoffset={COUNTDOWN_STROKE_LEN}
            />
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#2dd4bf" />
                <stop offset="100%" stopColor="#5eead4" />
              </linearGradient>
            </defs>
          </svg>
          <span
            ref={labelRef}
            className="absolute inset-0 flex items-center justify-center text-7xl font-black text-white tabular-nums z-10 [text-shadow:0_1px_0_rgba(0,0,0,0.35)] [transform-origin:center]"
          >
            {countdown}
          </span>
        </div>
        <p className="mt-8 text-center text-sm text-slate-300">
          Iniciando validación de velocidad en el punto de partida...
        </p>
      </div>
    </div>
  )
}
