'use client'

import { useId } from 'react'
import type { MapPoint } from '@/hooks/useGPSRecorder'
import type { RecordedTrackPointRow } from '@/lib/recordedTrackOverviewRows'

export interface OverviewElevationProfileProps {
  points: MapPoint[]
  rows: RecordedTrackPointRow[]
  selectedIndex: number | null
  onSelectIndex: (index: number) => void
  className?: string
}

/**
 * Perfil de elevación si hay altitudes; si no, perfil de velocidad por tramo.
 */
export function OverviewElevationProfile({
  points,
  rows,
  selectedIndex,
  onSelectIndex,
  className = '',
}: OverviewElevationProfileProps) {
  const gradId = useId().replace(/:/g, '')
  const w = 100
  const h = 36
  const pad = 2

  const { mode, yLabel, linePath, fillPath, minV, maxV, ys } = buildProfile(
    points,
    rows
  )

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (rows.length < 2) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const ratio = x / rect.width
    const idx = Math.max(
      0,
      Math.min(
        points.length - 1,
        Math.round(ratio * (points.length - 1))
      )
    )
    onSelectIndex(idx)
  }

  if (points.length < 2 || !linePath) {
    return (
      <div
        className={`rounded-2xl border border-white/5 bg-[#121826] px-3 py-4 text-center text-xs text-slate-500 ${className}`}
      >
        No hay datos suficientes para el perfil.
      </div>
    )
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-end justify-between px-0.5">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-gdh-brand-highlight/90">
          {mode === 'elevation' ? 'Perfil de elevación' : 'Perfil de velocidad (sin alt. GPS)'}
        </h4>
        {minV != null && maxV != null && (
          <span className="text-[10px] text-slate-500 tabular-nums">
            {yLabel}: {minV.toFixed(0)} – {maxV.toFixed(0)} {mode === 'elevation' ? 'm' : 'km/h'}
          </span>
        )}
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-24 sm:h-28 cursor-crosshair select-none touch-manipulation"
        preserveAspectRatio="none"
        onClick={handleClick}
        role="img"
        aria-label="Perfil del recorrido; toca para elegir un punto"
      >
        <defs>
          <linearGradient id={`ovProfFill-${gradId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4FD1C5" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#6366F1" stopOpacity="0.08" />
          </linearGradient>
          <linearGradient id={`ovProfLine-${gradId}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#4FD1C5" />
            <stop offset="100%" stopColor="#6366F1" />
          </linearGradient>
        </defs>
        <path d={fillPath} fill={`url(#ovProfFill-${gradId})`} />
        <path
          d={linePath}
          fill="none"
          stroke={`url(#ovProfLine-${gradId})`}
          strokeWidth="0.5"
          vectorEffect="non-scaling-stroke"
          style={{ strokeWidth: 1.5 }}
        />
        {selectedIndex != null &&
          selectedIndex < ys.length &&
          ys[selectedIndex] != null && (
            <line
              x1={(selectedIndex / Math.max(1, ys.length - 1)) * (w - pad * 2) + pad}
              x2={(selectedIndex / Math.max(1, ys.length - 1)) * (w - pad * 2) + pad}
              y1={pad}
              y2={h - pad}
              stroke="#f59e0b"
              strokeWidth="0.4"
              strokeOpacity={0.6}
            />
          )}
      </svg>
    </div>
  )
}

function buildProfile(points: MapPoint[], rows: RecordedTrackPointRow[]) {
  const n = points.length
  if (n < 2) {
    return {
      mode: 'speed' as const,
      yLabel: 'V',
      linePath: '',
      fillPath: '',
      minV: null as number | null,
      maxV: null as number | null,
      ys: [] as (number | null)[],
    }
  }

  const w = 100
  const h = 36
  const pad = 2
  const alts = points.map((p) => (typeof p.altitude === 'number' ? p.altitude : null))
  const hasAlt = alts.filter((a) => a != null).length >= Math.min(3, n * 0.4)

  let mode: 'elevation' | 'speed' = 'speed'
  let values: number[] = []
  if (hasAlt) {
    mode = 'elevation'
    const imputed = alts.map((a, i) => {
      if (a != null) return a
      let L = i - 1
      let R = i + 1
      while (L >= 0 && alts[L] == null) L--
      while (R < n && alts[R] == null) R++
      if (L >= 0 && R < n && alts[L] != null && alts[R] != null) {
        const t = (i - L) / (R - L)
        return alts[L]! + t * (alts[R]! - alts[L]!)
      }
      return alts.find((x) => x != null) ?? 0
    })
    values = imputed as number[]
  } else {
    values = rows.map((r) => r.speedKmh ?? 0)
  }

  const minV = Math.min(...values)
  const maxV = Math.max(...values)
  const span = Math.max(maxV - minV, mode === 'elevation' ? 1 : 5)
  const yLabel = mode === 'elevation' ? 'Alt' : 'V'

  const xs = values.map((_, i) => pad + (i / Math.max(1, n - 1)) * (w - pad * 2))
  const ys = values.map((v) => {
    const t = (v - minV) / span
    return h - pad - t * (h - pad * 2)
  })

  const lineD = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x},${ys[i]}`).join(' ')
  const fillD = `${lineD} L${xs[xs.length - 1]!},${h - pad} L${pad},${h - pad} Z`
  return {
    mode,
    yLabel,
    linePath: lineD,
    fillPath: fillD,
    minV,
    maxV,
    ys,
  }
}
