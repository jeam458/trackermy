'use client'

import { useEffect, useId, useMemo, useRef } from 'react'
import { animate } from 'animejs'
import type { RouteTrackPoint } from '@/core/domain/Route'

const VB_W = 120
const VB_H = 56
const PAD = 6

function computeSilhouette(trackPoints: RouteTrackPoint[]) {
  if (!trackPoints || trackPoints.length < 2) return null
  const sorted = [...trackPoints].sort((a, b) => a.orderIndex - b.orderIndex)
  const lats = sorted.map((p) => p.latitude)
  const lngs = sorted.map((p) => p.longitude)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const w = Math.max(1e-6, maxLng - minLng)
  const h = Math.max(1e-6, maxLat - minLat)
  const innerW = VB_W - PAD * 2
  const innerH = VB_H - PAD * 2 - 6
  const baseY = VB_H - PAD

  const pts = sorted.map((p) => ({
    x: ((p.longitude - minLng) / w) * innerW + PAD,
    y: (1 - (p.latitude - minLat) / h) * innerH + PAD,
  }))

  const lineD = pts.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(2)},${pt.y.toFixed(2)}`).join(' ')
  const first = pts[0]!
  const last = pts[pts.length - 1]!
  const areaD = `${lineD} L ${last.x.toFixed(2)},${baseY} L ${first.x.toFixed(2)},${baseY} Z`

  return { lineD, areaD }
}

/**
 * Perfil compacto tipo “silueta de ruta” para cards (trazo + relleno suave), animado con animejs.
 */
export function RouteCardSilhouette({ trackPoints }: { trackPoints: RouteTrackPoint[] }) {
  const uid = useId().replace(/:/g, '')
  const lineRef = useRef<SVGPathElement>(null)
  const fillRef = useRef<SVGPathElement>(null)
  const data = useMemo(() => computeSilhouette(trackPoints), [trackPoints])

  useEffect(() => {
    const line = lineRef.current
    const fill = fillRef.current
    if (!line || !fill || !data) return

    const len = line.getTotalLength()
    if (!Number.isFinite(len) || len < 2) return

    line.style.strokeDasharray = String(len)
    line.style.strokeDashoffset = String(len)
    fill.style.opacity = '0'

    const strokeAnim = animate(line, {
      strokeDashoffset: [len, 0],
      duration: 1500,
      ease: 'outCubic',
      loop: true,
      alternate: true,
    })

    const fillAnim = animate(fill, {
      opacity: [0, 0.42],
      duration: 700,
      ease: 'outQuad',
    })

    return () => {
      strokeAnim.revert()
      fillAnim.revert()
    }
  }, [data])

  const gradStroke = `sil-stroke-${uid}`
  const gradFill = `sil-fill-${uid}`

  if (!data) {
    return (
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="h-14 w-full max-w-[7.5rem] text-slate-500"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        <path
          d={`M ${PAD} ${VB_H * 0.55} Q ${VB_W * 0.35} ${PAD + 4} ${VB_W * 0.55} ${VB_H * 0.42} T ${VB_W - PAD} ${VB_H * 0.5}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity={0.4}
        />
      </svg>
    )
  }

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className="h-14 w-full max-w-[7.5rem] drop-shadow-[0_0_12px_rgba(34,211,238,0.15)]"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradStroke} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="55%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>
        <linearGradient id={gradFill} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.45} />
          <stop offset="70%" stopColor="#6366f1" stopOpacity={0.12} />
          <stop offset="100%" stopColor="#312e81" stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <path ref={fillRef} d={data.areaD} fill={`url(#${gradFill})`} opacity={0} />
      <path
        ref={lineRef}
        d={data.lineD}
        fill="none"
        stroke={`url(#${gradStroke})`}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
