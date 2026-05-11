'use client'

import { useEffect, useMemo, useRef } from 'react'
import { animate } from 'animejs'
import type { RouteTrackPoint } from '@/core/domain/Route'

function buildPathData(trackPoints: RouteTrackPoint[]) {
  if (!trackPoints || trackPoints.length < 2) return null
  const sorted = [...trackPoints].sort((a, b) => a.orderIndex - b.orderIndex)

  const lats = sorted.map((p) => p.latitude)
  const lngs = sorted.map((p) => p.longitude)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)

  const w = Math.max(0.000001, maxLng - minLng)
  const h = Math.max(0.000001, maxLat - minLat)
  const pad = 8
  const viewW = 180
  const viewH = 96
  const innerW = viewW - pad * 2
  const innerH = viewH - pad * 2

  const points = sorted.map((p) => {
    const x = ((p.longitude - minLng) / w) * innerW + pad
    const y = (1 - (p.latitude - minLat) / h) * innerH + pad
    return { x, y }
  })

  if (points.length < 2) return null
  const d = points
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'}${pt.x.toFixed(2)},${pt.y.toFixed(2)}`)
    .join(' ')
  return { d, points }
}

export function RouteTraceThumbnail({ trackPoints }: { trackPoints: RouteTrackPoint[] }) {
  const traceRef = useRef<SVGPathElement | null>(null)
  const riderRef = useRef<SVGCircleElement | null>(null)
  const data = useMemo(() => buildPathData(trackPoints), [trackPoints])

  useEffect(() => {
    const path = traceRef.current
    const rider = riderRef.current
    if (!path || !rider || !data) return

    path.style.strokeDasharray = '360'
    path.style.strokeDashoffset = '360'

    void animate(path, {
      strokeDashoffset: [360, 0],
      duration: 1600,
      ease: 'inOutSine',
      loop: true,
      alternate: true,
    })

    const keyframes = data.points
      .filter((_, i) => i % Math.max(1, Math.floor(data.points.length / 8)) === 0)
      .concat(data.points[data.points.length - 1]!)

    void animate(rider, {
      cx: keyframes.map((p) => p.x),
      cy: keyframes.map((p) => p.y),
      duration: 3200,
      ease: 'inOutSine',
      loop: true,
      alternate: true,
    })
  }, [data])

  if (!data) {
    return <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900" />
  }

  return (
    <svg viewBox="0 0 180 96" className="absolute inset-0 h-full w-full">
      <path d={data.d} fill="none" stroke="#334155" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <path
        ref={traceRef}
        d={data.d}
        fill="none"
        stroke="#22d3ee"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle ref={riderRef} cx={data.points[0]!.x} cy={data.points[0]!.y} r="3.6" fill="#2dd4bf" />
    </svg>
  )
}
