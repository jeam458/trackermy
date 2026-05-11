'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import { APP_MAP_CANVAS_HEX, DARK_MAP_TILE, tileLayerPresetProps } from '@/components/routes/mapTheme'
import type { MapPoint } from '@/hooks/useGPSRecorder'

const TEAL = '#4FD1C5'
const INDIGO = '#6366F1'

function FitTrack({ positions }: { positions: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (positions.length === 0) return
    if (positions.length === 1) {
      map.setView(positions[0]!, 17)
      return
    }
    const b = L.latLngBounds(positions)
    map.fitBounds(b, { padding: [28, 28], maxZoom: 18 })
  }, [map, positions])
  return null
}

function PanToSelected({
  positions,
  selectedIndex,
}: {
  positions: [number, number][]
  selectedIndex: number | null
}) {
  const map = useMap()
  useEffect(() => {
    if (selectedIndex == null || selectedIndex < 0 || selectedIndex >= positions.length) return
    const p = positions[selectedIndex]!
    map.panTo(p, { animate: true, duration: 0.35 })
  }, [map, positions, selectedIndex])
  return null
}

export interface OverviewTrackMapProps {
  points: MapPoint[]
  selectedIndex: number | null
  onSelectIndex: (index: number) => void
  height?: number
  className?: string
}

export default function OverviewTrackMap({
  points,
  selectedIndex,
  onSelectIndex,
  height = 220,
  className = '',
}: OverviewTrackMapProps) {
  const positions = useMemo(
    () => points.map((p) => [p.latitude, p.longitude] as [number, number]),
    [points]
  )

  const center = useMemo((): [number, number] => {
    if (positions.length === 0) return [-13.5319, -71.9675]
    const mid = Math.floor(positions.length / 2)
    return positions[mid]!
  }, [positions])

  if (points.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl bg-[#121826] text-sm text-slate-500 border border-white/5 ${className}`}
        style={{ height }}
      >
        Sin puntos para el mapa
      </div>
    )
  }

  return (
    <div className={`overflow-hidden rounded-2xl border border-white/10 ${className}`} style={{ height }}>
      <MapContainer
        center={center}
        zoom={16}
        className="h-full w-full z-0 map-dark-ui"
        style={{ height: '100%', width: '100%', background: APP_MAP_CANVAS_HEX }}
        scrollWheelZoom
      >
        <TileLayer {...tileLayerPresetProps(DARK_MAP_TILE)} />
        <FitTrack positions={positions} />
        <PanToSelected positions={positions} selectedIndex={selectedIndex} />
        <Polyline
          positions={positions}
          pathOptions={{
            color: TEAL,
            weight: 4,
            opacity: 0.85,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
        {points.map((p, i) => {
          const sel = selectedIndex === i
          return (
            <CircleMarker
              key={`ov-${i}-${p.latitude.toFixed(5)}`}
              center={[p.latitude, p.longitude]}
              radius={sel ? 9 : 4}
              pathOptions={{
                color: sel ? TEAL : INDIGO,
                weight: sel ? 3 : 2,
                fillColor: sel ? TEAL : INDIGO,
                fillOpacity: sel ? 0.45 : 0.35,
              }}
              eventHandlers={{
                click: () => onSelectIndex(i),
              }}
            >
              <Tooltip direction="top" offset={[0, -6]} opacity={0.95} permanent={false}>
                <span className="text-xs font-semibold text-slate-800">#{i + 1}</span>
              </Tooltip>
            </CircleMarker>
          )
        })}
      </MapContainer>
    </div>
  )
}
