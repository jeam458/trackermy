'use client'

import { useEffect, useMemo, useRef } from 'react'
import { MapPinned } from 'lucide-react'
import { APP_MAP_CANVAS_HEX, routeColorFromId } from './mapTheme'
import { fadeSlideIn } from '@/lib/animeUi'
import type { Route, RouteTrackPoint } from '@/core/domain/Route'
import { MAPLIBRE_CARTO_DARK_STYLE } from '@/lib/maplibreAppStyles'
import { Map, MapControls, MapFitBounds, MapMarker, MapRoute, MarkerContent, MarkerPopup, useMap } from '@/components/ui/map'

type Props = {
  route: Route
  className?: string
}

function sortedTrackPoints(pts: RouteTrackPoint[]): [number, number][] {
  if (pts.length < 2) return []
  const s = [...pts].sort((a, b) => a.orderIndex - b.orderIndex)
  return s.map((p) => [p.latitude, p.longitude] as [number, number])
}

function latLngPathToLngLat(coords: [number, number][]): [number, number][] {
  return coords.map(([lat, lng]) => [lng, lat])
}

function MapResizeOnWindowResize() {
  const { map } = useMap()
  useEffect(() => {
    if (!map) return
    const onResize = () => requestAnimationFrame(() => map.resize())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [map])
  return null
}

export function SelectedRoutePreviewMap({ route, className = '' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  const positions = useMemo(() => sortedTrackPoints(route.trackPoints), [route])
  const lngLatLine = useMemo(() => latLngPathToLngLat(positions), [positions])

  const centerLngLat = useMemo((): [number, number] => {
    if (route.startCoord) {
      return [route.startCoord[1], route.startCoord[0]]
    }
    if (positions[0]) return [positions[0][1], positions[0][0]]
    return [-71.9675, -13.5319]
  }, [route.startCoord, positions])

  const lineColor = useMemo(() => routeColorFromId(route.id), [route.id])
  const routeKey = useMemo(
    () => `${route.id}-${positions.length}-${positions[0]?.[0]?.toFixed(4) ?? 0}`,
    [route.id, positions],
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el || positions.length < 2) return
    const anim = fadeSlideIn(el, { duration: 380, y: [10, 0] })
    return () => {
      try {
        if (anim && typeof (anim as { revert?: () => void }).revert === 'function') {
          ;(anim as { revert: () => void }).revert()
        }
      } catch {
        /* noop */
      }
      el.style.opacity = '1'
      el.style.transform = ''
    }
  }, [routeKey, positions.length])

  if (positions.length < 2) {
    return (
      <div
        className={`rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200/90 ${className}`}
      >
        <p>Esta ruta no tiene suficientes puntos de trazado para mostrar en el mapa.</p>
      </div>
    )
  }

  const start = positions[0]!
  const end = positions[positions.length - 1]!

  return (
    <div ref={containerRef} className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <MapPinned size={16} className="text-teal-400" />
        Vista previa del trazado
      </div>
      <div
        className="h-[min(240px,38vh)] w-full overflow-hidden rounded-xl border border-white/10"
        style={{ background: APP_MAP_CANVAS_HEX }}
      >
        <Map
          theme="dark"
          forceStyle={MAPLIBRE_CARTO_DARK_STYLE}
          className="map-dark-ui h-full min-h-[220px] w-full [&_.maplibregl-ctrl-attrib]:!text-[10px] [&_.maplibregl-ctrl-attrib]:!text-slate-400"
          center={centerLngLat}
          zoom={14}
          minZoom={3}
          maxZoom={22}
        >
          <MapResizeOnWindowResize />
          <MapControls position="bottom-right" showZoom showCompass />
          <MapFitBounds lngLats={lngLatLine} maxZoom={16} padding={20} duration={0} />
          <MapRoute
            id={`preview-${route.id}`}
            coordinates={lngLatLine}
            color={lineColor}
            width={4}
            opacity={0.95}
            interactive={false}
          />
          <MapMarker longitude={start[1]} latitude={start[0]}>
            <MarkerContent className="h-4 w-4 rounded-full border-2 border-white bg-green-500 shadow-lg" />
            <MarkerPopup className="border border-white/10 bg-slate-900 text-slate-100">
              <span className="text-xs">Inicio</span>
            </MarkerPopup>
          </MapMarker>
          <MapMarker longitude={end[1]} latitude={end[0]}>
            <MarkerContent className="h-3.5 w-3.5 rounded-full border-2 border-white bg-red-500 shadow-lg" />
            <MarkerPopup className="border border-white/10 bg-slate-900 text-slate-100">
              <span className="text-xs">Meta</span>
            </MarkerPopup>
          </MapMarker>
        </Map>
      </div>
      <p className="text-[11px] text-slate-500">
        {route.name} · {positions.length} puntos · inicio (verde) / meta (rojo)
      </p>
    </div>
  )
}
