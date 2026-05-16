'use client'

import { useCallback, useRef, useState } from 'react'
import { Mountain } from 'lucide-react'

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n))

type Marker = { left: string; top: string; border: string }

const MARKERS: Marker[] = [
  { left: '18%', top: '42%', 'border': 'rgba(34,211,238,0.85)' },
  { left: '62%', top: '36%', 'border': 'rgba(168,85,247,0.9)' },
  { left: '48%', top: '58%', 'border': 'rgba(251,146,60,0.9)' },
  { left: '72%', top: '52%', 'border': 'rgba(52,211,153,0.85)' },
]

/**
 * Vista “globo” estilizada (marca) con pan/zoom 2D en el interior del círculo.
 * Para datos geo reales, pasá marcadores normalizados 0–100 en el futuro.
 */
export function GuardDhGlobeStage({ className = '' }: { className?: string }) {
  const [scale, setScale] = useState(1)
  const [tx, setTx] = useState(0)
  const [ty, setTy] = useState(0)
  const drag = useRef<null | { px: number; py: number; tx: number; ty: number }>(null)

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setScale((s) => clamp(s - e.deltaY * 0.0012, 0.82, 2.6))
  }, [])

  const onPointerDown = (e: React.PointerEvent) => {
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { px: e.clientX, py: e.clientY, tx, ty }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    const dx = e.clientX - drag.current.px
    const dy = e.clientY - drag.current.py
    setTx(drag.current.tx + dx * 0.65)
    setTy(drag.current.ty + dy * 0.65)
  }
  const onPointerUp = (e: React.PointerEvent) => {
    try {
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* noop */
    }
    drag.current = null
  }

  return (
    <div
      className={`relative mx-auto aspect-square w-full max-w-[min(100%,22rem)] select-none ${className}`}
      onWheel={onWheel}
    >
      <div
        className="pointer-events-none absolute inset-[-8%] rounded-full opacity-70 blur-2xl"
        style={{
          background: 'radial-gradient(circle at 50% 55%, rgba(56,189,248,0.35), transparent 62%)',
        }}
      />
      <div className="relative h-full w-full overflow-hidden rounded-full border border-gdh-brand/35 bg-gdh-canvas shadow-[0_0_40px_rgba(227,120,69,0.14),inset_0_0_60px_rgba(0,0,0,0.65)]">
        <div
          className="absolute inset-0 touch-none cursor-grab active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div
            className="absolute left-1/2 top-1/2 h-[145%] w-[145%] will-change-transform"
            style={{
              transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(${scale})`,
            }}
          >
            <div
              className="h-full w-full rounded-full"
              style={{
                background:
                  'radial-gradient(circle at 32% 35%, rgba(71,85,105,0.55), transparent 42%), radial-gradient(circle at 70% 55%, rgba(51,65,85,0.5), transparent 48%), radial-gradient(circle at 50% 100%, rgba(15,23,42,0.95), #020617)',
              }}
            />
            <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.35]" viewBox="0 0 100 100">
              <ellipse cx="36" cy="44" rx="16" ry="10" fill="none" stroke="rgba(148,163,184,0.35)" strokeWidth="0.4" />
              <ellipse cx="64" cy="48" rx="18" ry="11" fill="none" stroke="rgba(148,163,184,0.28)" strokeWidth="0.35" />
              <path
                d="M20 58 Q 40 52 55 60 T 88 54"
                fill="none"
                stroke="rgba(45,212,191,0.45)"
                strokeWidth="0.55"
              />
              <path
                d="M18 66 Q 44 60 58 68 T 90 62"
                fill="none"
                stroke="rgba(251,146,60,0.4)"
                strokeWidth="0.45"
              />
            </svg>
            {MARKERS.map((m, i) => (
              <div
                key={i}
                className="absolute h-3 w-3 rounded-full border-2 bg-slate-900/90 shadow-lg"
                style={{ left: m.left, top: m.top, borderColor: m.border, transform: 'translate(-50%, -50%)' }}
              />
            ))}
          </div>
        </div>
        <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-[14%]">
          <Mountain className="h-10 w-10 text-white/85 drop-shadow-[0_0_18px_rgba(255,255,255,0.35)]" strokeWidth={1.25} />
        </div>
      </div>
    </div>
  )
}
