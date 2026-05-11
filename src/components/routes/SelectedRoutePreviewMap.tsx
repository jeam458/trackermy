'use client'

import { useEffect, useLayoutEffect, useRef, useMemo, memo } from 'react'
import type { Polyline as LeafletPolylineClass } from 'leaflet'
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from 'react-leaflet'
import L from 'leaflet'
import { animate } from 'animejs'
import 'leaflet/dist/leaflet.css'
import { MapPinned } from 'lucide-react'
import { APP_MAP_CANVAS_HEX, DARK_MAP_TILE, routeColorFromId, tileLayerPresetProps } from './mapTheme'
import { fadeSlideIn } from '@/lib/animeUi'
import type { Route, RouteTrackPoint } from '@/core/domain/Route'

type Props = {
  route: Route
  className?: string
}

function sortedTrackPoints(pts: RouteTrackPoint[]): [number, number][] {
  if (pts.length < 2) return []
  const s = [...pts].sort((a, b) => a.orderIndex - b.orderIndex)
  return s.map((p) => [p.latitude, p.longitude] as [number, number])
}

function FitBoundsToRoute({ positions }: { positions: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (positions.length < 2) return
    const fit = () => {
      try {
        map.invalidateSize()
      } catch {
        /* noop */
      }
      const latlngs = positions.map((p) => L.latLng(p[0], p[1]))
      const b = L.latLngBounds(latlngs)
      map.fitBounds(b, { padding: [20, 20], maxZoom: 16, animate: false })
    }
    fit()
    const raf = window.requestAnimationFrame(fit)
    /** Un segundo repintado evita tamaño 0 antes de hidratar layout; menos llamadas que varios timeouts. */
    const t1 = window.setTimeout(fit, 200)
    return () => {
      window.cancelAnimationFrame(raf)
      window.clearTimeout(t1)
    }
  }, [map, positions])
  return null
}

/**
 * Trazo animado (stroke-dash) cuando el polilínea ya está en el DOM SVG.
 */
const AnimatedPath = memo(function AnimatedPath({
  lineRef,
  lineColor,
  routeKey,
}: {
  lineRef: React.MutableRefObject<LeafletPolylineClass | null>
  lineColor: string
  routeKey: string
}) {
  const map = useMap()
  useEffect(() => {
    const pl = lineRef.current
    if (!pl) return

    const run = () => {
      const el = pl.getElement()
      if (!el) return
      const path = el instanceof SVGPathElement ? el : el.querySelector('path')
      if (!path || typeof path.getTotalLength !== 'function') return
      const len = path.getTotalLength()
      if (!Number.isFinite(len) || len < 4) {
        void animate(path, { opacity: [0, 1], duration: 500, ease: 'outCubic' })
        return
      }
      path.style.stroke = lineColor
      path.setAttribute('stroke', lineColor)
      path.setAttribute('fill', 'none')
      path.setAttribute('stroke-width', '4')
      path.style.strokeDasharray = String(len)
      path.style.strokeDashoffset = String(len)
      void animate(path, {
        strokeDashoffset: [len, 0],
        duration: 1800,
        ease: 'outCubic',
      })
    }

    // Capa aún no montada: reintenta
    pl.once('add', run)
    const t = window.setTimeout(run, 50)
    map.whenReady(() => {
      window.setTimeout(run, 16)
    })
    return () => {
      clearTimeout(t)
      pl.off('add', run)
    }
  }, [lineRef, lineColor, routeKey, map])
  return null
})

/**
 * Mapa de vista previa del track de una ruta creada (no grabación en vivo).
 */
export function SelectedRoutePreviewMap({ route, className = '' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const lineRef = useRef<LeafletPolylineClass | null>(null)

  const positions = useMemo(() => sortedTrackPoints(route.trackPoints), [route])
  const center = useMemo((): [number, number] => {
    if (route.startCoord) {
      return [route.startCoord[0], route.startCoord[1]]
    }
    if (positions[0]) return [positions[0][0], positions[0][1]]
    return [-13.5319, -71.9675]
  }, [route.startCoord, positions])

  const lineColor = useMemo(() => routeColorFromId(route.id), [route.id])
  const routeKey = useMemo(
    () => `${route.id}-${positions.length}-${positions[0]?.[0]?.toFixed(4) ?? 0}`,
    [route.id, positions]
  )

  useLayoutEffect(() => {
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
        className="h-[min(240px,38vh)] w-full overflow-hidden rounded-xl border border-white/10 [&_.leaflet-container]:h-full [&_.leaflet-container]:rounded-xl"
        style={{ background: APP_MAP_CANVAS_HEX }}
      >
        <MapContainer
          center={center}
          zoom={14}
          minZoom={3}
          maxZoom={DARK_MAP_TILE.maxZoom}
          className="h-full w-full min-h-[220px] map-dark-ui"
          style={{ background: APP_MAP_CANVAS_HEX }}
          scrollWheelZoom
          preferCanvas={false}
        >
          <TileLayer {...tileLayerPresetProps(DARK_MAP_TILE)} />
          <FitBoundsToRoute positions={positions} />
          <Polyline
            ref={lineRef}
            positions={positions}
            pathOptions={{
              color: lineColor,
              weight: 4,
              opacity: 0.95,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
          <AnimatedPath lineRef={lineRef} lineColor={lineColor} routeKey={routeKey} />
          <CircleMarker
            center={start}
            radius={8}
            pathOptions={{
              color: '#22c55e',
              fillColor: '#22c55e',
              fillOpacity: 0.9,
              weight: 2,
            }}
          />
          <CircleMarker
            center={end}
            radius={6}
            pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.85, weight: 2 }}
          />
        </MapContainer>
      </div>
      <p className="text-[11px] text-slate-500">
        {route.name} · {positions.length} puntos · inicio (verde) / meta (rojo)
      </p>
    </div>
  )
}
