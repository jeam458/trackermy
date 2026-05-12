'use client'

import { useEffect, useId, useRef } from 'react'
import { animate } from 'animejs'
import type { JSAnimation } from 'animejs'

import {
  MOUNTAIN_STROKE_PATH,
  pointyTopHexagonPoints,
  wavyRingClosedPath,
} from '@/lib/brand/guardDhMarkLoaderGeometry'
import { cn } from '@/lib/utils'

const RING_LOBES = 5

type Props = {
  compact?: boolean
  className?: string
}

/**
 * Marca guardDh como SVG + animejs: tres anillos ondulados (teal / trail / sol),
 * hexágono, montaña y sol — sin imagen.
 */
export function GuardDhMarkLoaderSvg({ compact = false, className }: Props) {
  const glowId = `gdh-loader-glow-${useId().replace(/:/g, '')}`
  const vb = compact ? 46 : 56
  const sunRef = useRef<SVGCircleElement>(null)
  const emblemRef = useRef<SVGGElement>(null)
  const ringSunRef = useRef<SVGGElement>(null)
  const ringTrailRef = useRef<SVGGElement>(null)
  const ringTealRef = useRef<SVGGElement>(null)
  const pathTealRef = useRef<SVGPathElement>(null)

  const rSun = compact ? 38 : 46
  const rTrail = compact ? 30.5 : 37
  const rTeal = compact ? 23.5 : 29
  const hexR = compact ? 14.5 : 17.5

  const pathSun = wavyRingClosedPath(rSun, compact ? 2.2 : 2.8, RING_LOBES, 0.35)
  const pathTrail = wavyRingClosedPath(rTrail, compact ? 1.9 : 2.4, RING_LOBES, 1.2)
  const pathTeal = wavyRingClosedPath(rTeal, compact ? 1.6 : 2.0, RING_LOBES, 2.45)

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) return

    const animations: JSAnimation[] = []

    if (ringSunRef.current) {
      animations.push(
        animate(ringSunRef.current, {
          rotate: [0, 360],
          duration: 11200,
          ease: 'linear',
          loop: true,
        }),
      )
    }
    if (ringTrailRef.current) {
      animations.push(
        animate(ringTrailRef.current, {
          rotate: [0, -360],
          duration: 7400,
          ease: 'linear',
          loop: true,
        }),
      )
    }
    if (ringTealRef.current) {
      animations.push(
        animate(ringTealRef.current, {
          rotate: [0, 360],
          duration: 4800,
          ease: 'linear',
          loop: true,
        }),
      )
    }

    const tealPath = pathTealRef.current
    if (tealPath) {
      const len = tealPath.getTotalLength()
      if (Number.isFinite(len) && len > 2) {
        tealPath.style.strokeDasharray = String(len * 0.42)
        tealPath.style.strokeDashoffset = String(len * 0.2)
        animations.push(
          animate(tealPath, {
            strokeDashoffset: [len * 0.2, len * -0.35],
            duration: 3200,
            ease: 'inOutSine',
            loop: true,
            alternate: true,
          }),
        )
      }
    }

    if (emblemRef.current) {
      animations.push(
        animate(emblemRef.current, {
          scale: [0.98, 1.03, 0.98],
          opacity: [0.88, 1, 0.88],
          duration: 2600,
          ease: 'inOutSine',
          loop: true,
        }),
      )
    }

    if (sunRef.current) {
      animations.push(
        animate(sunRef.current, {
          opacity: [0.55, 1, 0.55],
          duration: 2000,
          ease: 'inOutSine',
          loop: true,
        }),
      )
    }

    return () => {
      animations.forEach((a) => a.revert())
      if (tealPath) {
        tealPath.style.strokeDasharray = ''
        tealPath.style.strokeDashoffset = ''
      }
    }
  }, [compact])

  const dim = compact ? 152 : 188

  return (
    <svg
      className={cn('shrink-0 text-[var(--gdh-brand-highlight)]', className)}
      width={dim}
      height={dim}
      viewBox={`-${vb} -${vb} ${vb * 2} ${vb * 2}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <radialGradient id={glowId} cx="50%" cy="42%" r="65%">
          <stop offset="0%" stopColor="rgba(45,212,191,0.28)" />
          <stop offset="55%" stopColor="rgba(99,102,241,0.08)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      <circle cx="0" cy="0" r={vb - 2} fill={`url(#${glowId})`} />

      <g ref={ringSunRef} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
        <path
          d={pathSun}
          stroke="var(--gdh-sun)"
          strokeWidth={compact ? 1.35 : 1.55}
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={0.92}
        />
      </g>
      <g ref={ringTrailRef} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
        <path
          d={pathTrail}
          stroke="var(--gdh-trail)"
          strokeWidth={compact ? 1.25 : 1.45}
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={0.88}
        />
      </g>
      <g ref={ringTealRef} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
        <path
          ref={pathTealRef}
          d={pathTeal}
          stroke="var(--gdh-brand-highlight)"
          strokeWidth={compact ? 1.65 : 1.9}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </g>

      <g ref={emblemRef} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
        <polygon
          points={pointyTopHexagonPoints(hexR)}
          stroke="rgba(148, 163, 184, 0.55)"
          strokeWidth="1.15"
          fill="rgba(15, 23, 42, 0.35)"
        />
        <path
          d={MOUNTAIN_STROKE_PATH}
          stroke="rgba(241, 245, 249, 0.88)"
          strokeWidth="1.35"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <circle
          ref={sunRef}
          cx="0"
          cy={compact ? 9.5 : 11}
          r={compact ? 2.85 : 3.35}
          fill="var(--gdh-sun)"
          stroke="rgba(251, 191, 36, 0.35)"
          strokeWidth="0.5"
        />
      </g>
    </svg>
  )
}

type MiniProps = {
  size?: number
  className?: string
}

/** Spinner compacto: un anillo ondulado teal animado con animejs. */
export function GuardDhMarkSpinnerMini({ size = 22, className }: MiniProps) {
  const gRef = useRef<SVGGElement>(null)

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce || !gRef.current) return
    const a = animate(gRef.current, {
      rotate: [0, 360],
      duration: 900,
      ease: 'linear',
      loop: true,
    })
    return () => a.revert()
  }, [])

  const path = wavyRingClosedPath(9.5, 1.1, 4, 0.8, 48)

  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg width={size} height={size} viewBox="-12 -12 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g ref={gRef} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
          <path
            d={path}
            stroke="var(--gdh-brand-highlight)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.95}
          />
        </g>
      </svg>
    </span>
  )
}
