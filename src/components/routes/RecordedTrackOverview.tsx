'use client'

import dynamic from 'next/dynamic'
import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Compass, MapPin, Mountain } from 'lucide-react'
import { formatTime, type MapPoint } from '@/hooks/useGPSRecorder'
import {
  avgSpeedKmhFromTrack,
  buildRecordedTrackRows,
  maxSpeedKmhFromRows,
  type RecordedTrackPointRow,
} from '@/lib/recordedTrackOverviewRows'
import { buildSpeedSegments, scaleForSegmentBars, type SpeedSegment } from '@/lib/recordedTrackSegments'
import { OverviewElevationProfile } from '@/components/routes/OverviewElevationProfile'

const OverviewTrackMap = dynamic(() => import('@/components/routes/OverviewTrackMap'), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-[220px] items-center justify-center rounded-2xl border border-white/10 bg-[#121826] text-sm text-slate-500"
      aria-hidden
    >
      Cargando mapa…
    </div>
  ),
})

function formatClockOffset(sec: number | null): string {
  if (sec === null || Number.isNaN(sec)) return '—'
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`
}

function formatNumber(n: number | null, digits = 1): string {
  if (n === null || Number.isNaN(n)) return '—'
  return n.toFixed(digits)
}

const PANEL = 'rounded-2xl border border-white/10 bg-[#121826] p-4 shadow-lg shadow-black/20'

export interface RecordedTrackOverviewProps {
  points: MapPoint[]
  totalElapsedSec: number
  totalDistanceM: number
  /** Título opcional (template: "Resumen de tu bajada") */
  title?: string
  className?: string
}

export function RecordedTrackOverview({
  points,
  totalElapsedSec,
  totalDistanceM,
  title = 'Resumen de tu bajada',
  className = '',
}: RecordedTrackOverviewProps) {
  const [detailOpen, setDetailOpen] = useState(true)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  const rows = useMemo(() => buildRecordedTrackRows(points), [points])
  const vMax = useMemo(() => maxSpeedKmhFromRows(rows), [rows])
  const vAvg = useMemo(
    () => avgSpeedKmhFromTrack(totalDistanceM, totalElapsedSec),
    [totalDistanceM, totalElapsedSec]
  )

  const segments = useMemo(() => buildSpeedSegments(rows, 5), [rows])
  const segScale = useMemo(() => scaleForSegmentBars(segments), [segments])

  const elevStats = useMemo(() => {
    const alts = points.map((p) => p.altitude).filter((a): a is number => typeof a === 'number')
    if (alts.length < 2) return null
    let min = alts[0]!
    let max = alts[0]!
    for (const a of alts) {
      if (a < min) min = a
      if (a > max) max = a
    }
    const gain = computeRoughGain(alts)
    return { min, max, delta: max - min, gain }
  }, [points])

  if (points.length === 0) {
    return (
      <div
        className={`rounded-2xl border border-white/10 bg-[#121826] p-4 text-sm text-slate-500 ${className}`}
      >
        Sin puntos de recorrido.
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#1b2330] to-[#121826] p-4 sm:p-5">
        <h3 className="text-center text-2xl font-black tracking-tight text-white">Estadísticas de Bajada</h3>
        <p className="mt-1 text-center text-slate-300">{title}</p>

        {segments.length > 0 && (
          <div className="mt-5 rounded-xl border border-white/10 bg-[#0f1520]/85 px-3 pt-3 pb-2">
            <div className="grid grid-cols-[28px_1fr] gap-2">
              <div className="flex h-40 flex-col justify-between text-[11px] text-slate-500 tabular-nums pt-1">
                <span>{Math.round(segScale)}</span>
                <span>{Math.round(segScale * 0.75)}</span>
                <span>{Math.round(segScale * 0.5)}</span>
                <span>{Math.round(segScale * 0.25)}</span>
                <span>0</span>
              </div>
              <div>
                <div className="grid h-40 grid-rows-4 gap-0">
                  <div className="border-b border-white/10" />
                  <div className="border-b border-white/10" />
                  <div className="border-b border-white/10" />
                  <div className="border-b border-white/10" />
                </div>
                <div className="-mt-40 flex h-40 items-end justify-between gap-1.5 px-1">
                  {segments.map((seg) => (
                    <SegmentBar key={seg.label} seg={seg} scale={segScale} />
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-3 text-center text-xs text-slate-400">
              <span>Tramos</span>
              <span>Segmento</span>
              <span>Tramos</span>
            </div>
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-xl border border-white/10 bg-white/5">
          <StatCell
            label="Velocidad máxima"
            value={vMax != null ? `${vMax.toFixed(0)} km/h` : '—'}
            valueClassName="text-4xl font-black tracking-tight text-white tabular-nums"
          />
          <StatCell
            label="Velocidad media"
            value={vAvg != null ? `${vAvg.toFixed(0)} km/h` : '—'}
            valueClassName="text-4xl font-black tracking-tight text-white tabular-nums"
            withSeparator
          />
          <StatCell
            label="Tiempo total"
            value={formatTime(totalElapsedSec)}
            valueClassName="text-4xl font-black tracking-tight text-white font-mono tabular-nums"
            withSeparator
          />
        </div>
      </div>

      {/* Mapa + perfil */}
      <div className={`${PANEL} space-y-4`}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gdh-brand-highlight/90">
            Recorrido
          </span>
          <span className="text-[10px] text-slate-500">Toca un punto en el mapa o en la tabla</span>
        </div>
        <OverviewTrackMap
          points={points}
          selectedIndex={selectedIndex}
          onSelectIndex={setSelectedIndex}
          height={220}
        />
        <OverviewElevationProfile
          points={points}
          rows={rows}
          selectedIndex={selectedIndex}
          onSelectIndex={setSelectedIndex}
        />
      </div>

      {/* Desnivel resumido */}
      {elevStats && (
        <div className={`${PANEL} grid grid-cols-2 sm:grid-cols-4 gap-3`}>
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-slate-500">
              <Mountain size={12} className="text-gdh-muted" />
              Desnivel
            </div>
            <p className="text-lg font-bold text-white mt-0.5">
              +{Math.round(elevStats.gain.positive)} / −{Math.round(elevStats.gain.negative)} m
            </p>
            <p className="text-[10px] text-slate-500">subida / bajada aprox.</p>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase text-slate-500">Altitud min</div>
            <p className="text-lg font-bold text-slate-200">{Math.round(elevStats.min)} m</p>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase text-slate-500">Altitud máx</div>
            <p className="text-lg font-bold text-slate-200">{Math.round(elevStats.max)} m</p>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase text-slate-500">Rango</div>
            <p className="text-lg font-bold text-slate-200">{Math.round(elevStats.delta)} m</p>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="rounded-2xl border border-white/10 overflow-hidden bg-[#121826]">
        <button
          type="button"
          onClick={() => setDetailOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-2 bg-[#161d2e] px-3 py-3 text-left hover:bg-slate-800/80 transition-colors"
        >
          <span className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <MapPin size={16} className="text-gdh-brand-highlight shrink-0" />
            Detalle por ubicación
          </span>
          {detailOpen ? <ChevronDown size={18} className="text-slate-500" /> : <ChevronRight size={18} className="text-slate-500" />}
        </button>

        {detailOpen && (
          <div className="max-h-[min(50vh,380px)] overflow-auto border-t border-white/5">
            <div className="min-w-[720px] sm:min-w-0">
              <table className="w-full text-left text-[11px] sm:text-xs">
                <thead className="sticky top-0 z-[1] bg-[#0f1520] text-slate-400 font-semibold border-b border-white/10">
                  <tr>
                    <th className="px-2 py-2 w-8">#</th>
                    <th className="px-1 py-2">Tiempo</th>
                    <th className="px-1 py-2">Acum.</th>
                    <th className="px-1 py-2">Tramo</th>
                    <th className="px-1 py-2">Vel.</th>
                    <th className="px-1 py-2 hidden sm:table-cell">±GPS</th>
                    <th className="px-1 py-2">
                      <span className="inline-flex items-center gap-0.5">
                        <Compass size={10} className="opacity-80" />
                        Rumbo
                      </span>
                    </th>
                    <th className="px-1 py-2 hidden md:table-cell">Alt.</th>
                    <th className="px-1 py-2">Lat</th>
                    <th className="px-1 py-2">Lng</th>
                  </tr>
                </thead>
                <tbody className="text-slate-200 divide-y divide-white/5">
                  {rows.map((r) => (
                    <TrackRow
                      key={r.index}
                      r={r}
                      selected={selectedIndex === r.index}
                      onSelect={() => setSelectedIndex(r.index)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <p className="px-2 py-2 text-[10px] text-slate-500 border-t border-white/5 sm:hidden">
              Desliza horizontalmente para ver todas las columnas.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function computeRoughGain(alts: number[]): { positive: number; negative: number } {
  let pos = 0
  let neg = 0
  for (let i = 1; i < alts.length; i++) {
    const d = alts[i]! - alts[i - 1]!
    if (d > 0) pos += d
    else neg += -d
  }
  return { positive: pos, negative: neg }
}

const BAR_PX = 96

function SegmentBar({ seg, scale }: { seg: SpeedSegment; scale: number }) {
  const px = Math.max(6, (seg.maxSpeedKmh / scale) * BAR_PX)
  return (
    <div className="flex h-36 flex-1 flex-col items-center justify-end gap-1 min-w-0">
      <div
        className="w-full max-w-[58px] rounded-t-md bg-gradient-to-t from-gdh-brand/90 to-gdh-brand-highlight shadow-sm shadow-[0_4px_14px_rgba(197,90,47,0.25)]"
        style={{ height: `${px}px` }}
        title={`${seg.label}: ${seg.maxSpeedKmh.toFixed(0)} km/h`}
      />
      <span className="text-[10px] text-slate-500 font-mono tabular-nums opacity-0">{seg.label}</span>
    </div>
  )
}

function StatCell({
  label,
  value,
  valueClassName,
  withSeparator = false,
}: {
  label: string
  value: string
  valueClassName: string
  withSeparator?: boolean
}) {
  return (
    <div className={`p-3 text-center ${withSeparator ? 'border-l border-white/10' : ''}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={valueClassName}>{value}</p>
    </div>
  )
}

function TrackRow({
  r,
  selected,
  onSelect,
}: {
  r: RecordedTrackPointRow
  selected: boolean
  onSelect: () => void
}) {
  return (
    <tr
      className={`cursor-pointer transition-colors ${
        selected ? 'bg-gdh-brand/15 ring-1 ring-inset ring-gdh-brand/30' : 'hover:bg-white/[0.04]'
      }`}
      onClick={onSelect}
    >
      <td className="px-2 py-1.5 text-slate-500 tabular-nums">{r.index + 1}</td>
      <td className="px-1 py-1.5 text-slate-300 tabular-nums whitespace-nowrap">
        {formatClockOffset(r.timeOffsetSec)}
        {r.segmentDtMs != null && r.index > 0 && (
          <span className="text-slate-500 hidden sm:inline">
            {' '}
            (Δt {(r.segmentDtMs / 1000).toFixed(1)}s)
          </span>
        )}
      </td>
      <td className="px-1 py-1.5 text-gdh-brand-highlight/90 tabular-nums">
        {formatNumber(r.cumDistanceM, 0)} m
      </td>
      <td className="px-1 py-1.5 text-slate-400 tabular-nums">
        {r.index === 0 ? '—' : `${formatNumber(r.segmentM, 1)} m`}
      </td>
      <td className="px-1 py-1.5 font-medium text-amber-200/95 tabular-nums">
        {r.speedKmh != null ? `${r.speedKmh.toFixed(0)} km/h` : '—'}
      </td>
      <td className="px-1 py-1.5 text-slate-400 tabular-nums hidden sm:table-cell">
        {r.precisiónM != null ? `±${r.precisiónM.toFixed(0)}m` : '—'}
      </td>
      <td className="px-1 py-1.5 text-slate-300">
        {r.directionLabel != null && r.bearingDeg != null
          ? `${r.directionLabel} ${r.bearingDeg.toFixed(0)}°`
          : '—'}
      </td>
      <td className="px-1 py-1.5 text-slate-500 tabular-nums hidden md:table-cell">
        {r.altitudeM != null ? `${r.altitudeM.toFixed(0)} m` : '—'}
      </td>
      <td className="px-1 py-1.5 text-slate-500 font-mono text-[10px] whitespace-nowrap">
        {r.latitude.toFixed(5)}
      </td>
      <td className="px-1 py-1.5 text-slate-500 font-mono text-[10px] whitespace-nowrap">
        {r.longitude.toFixed(5)}
      </td>
    </tr>
  )
}
