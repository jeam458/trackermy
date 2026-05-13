'use client'

import maplibregl from 'maplibre-gl'
import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { useMap } from '@/components/ui/map'
import { nominatimSearchFirst } from '@/lib/nominatimGeocode'
import type { MapPoint } from './types'

const LIVE_MARKER_BUDGET = 45

export function liveRecordingMarkerIndices(len: number): number[] {
  if (len <= LIVE_MARKER_BUDGET) {
    return Array.from({ length: len }, (_, i) => i)
  }
  const stride = Math.ceil(len / LIVE_MARKER_BUDGET)
  const idx = new Set<number>()
  for (let i = 0; i < len; i += stride) idx.add(i)
  idx.add(len - 1)
  return Array.from(idx).sort((a, b) => a - b)
}

function latLngPositionsToLngLats(positions: [number, number][]): [number, number][] {
  return positions.map(([lat, lng]) => [lng, lat])
}

export function FitBoundsToPublishedRoute({
  positions,
  enabled,
}: {
  /** [lat, lng][] (misma convención que antes con Leaflet) */
  positions: [number, number][]
  enabled: boolean
}) {
  const { map, isLoaded } = useMap()
  const signature =
    positions.length +
    ':' +
    (positions[0]?.[0] ?? '') +
    ':' +
    (positions[positions.length - 1]?.[1] ?? '')

  useEffect(() => {
    if (!enabled || !isLoaded || !map || positions.length < 2) return
    const lngLats = latLngPositionsToLngLats(positions)
    const b = new maplibregl.LngLatBounds(lngLats[0], lngLats[0])
    for (const c of lngLats) b.extend(c)
    map.fitBounds(b, { padding: 32, maxZoom: 16, duration: 380 })
  }, [map, isLoaded, enabled, signature, positions])

  return null
}

export function LiveRecordingMapFollower({
  enabled,
  allLinePoints,
}: {
  enabled: boolean
  allLinePoints: MapPoint[]
}) {
  const { map, isLoaded } = useMap()
  const lineRef = useRef(allLinePoints)
  lineRef.current = allLinePoints
  const lastPanMs = useRef(0)
  const tailSignature =
    allLinePoints.length > 0
      ? `${allLinePoints.length}:${allLinePoints[allLinePoints.length - 1]!.latitude.toFixed(6)}:${allLinePoints[allLinePoints.length - 1]!.longitude.toFixed(6)}`
      : ''

  useEffect(() => {
    if (!enabled || !isLoaded || !map || allLinePoints.length === 0) return
    const last = allLinePoints[allLinePoints.length - 1]!
    const now = Date.now()
    if (now - lastPanMs.current < 800) return
    lastPanMs.current = now
    const z = Math.max(map.getZoom(), 16)
    map.flyTo({
      center: [last.longitude, last.latitude],
      zoom: z,
      duration: 400,
      essential: true,
    })
  }, [enabled, isLoaded, map, tailSignature, allLinePoints])

  useEffect(() => {
    if (!enabled || !isLoaded || !map) return

    const refreshLayout = () => {
      requestAnimationFrame(() => {
        try {
          map.resize()
        } catch {
          /* noop */
        }
        const pts = lineRef.current
        if (pts.length > 0) {
          const l = pts[pts.length - 1]!
          map.jumpTo({
            center: [l.longitude, l.latitude],
            zoom: Math.max(map.getZoom(), 16),
          })
        }
      })
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        setTimeout(refreshLayout, 120)
      }
    }

    document.addEventListener('visibilitychange', onVisibility)

    let appListener: { remove: () => Promise<void> } | undefined
    let cancelled = false

    void (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core')
        if (cancelled || !Capacitor.isNativePlatform()) return
        const { App } = await import('@capacitor/app')
        appListener = await App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) setTimeout(refreshLayout, 180)
        })
      } catch {
        /* noop */
      }
    })()

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      void appListener?.remove()
    }
  }, [enabled, isLoaded, map])

  return null
}

export function FlyToWhenReady({
  target,
  zoomMin = 16,
  bump = 0,
}: {
  /** [lat, lng] */
  target: [number, number] | null | undefined
  zoomMin?: number
  bump?: number
}) {
  const { map, isLoaded } = useMap()
  const seen = useRef<string | null>(null)
  useEffect(() => {
    if (!target || !isLoaded || !map) return
    const sig = `${bump}|${target[0].toFixed(6)},${target[1].toFixed(6)}`
    if (seen.current === sig) return
    seen.current = sig
    map.flyTo({
      center: [target[1], target[0]],
      zoom: Math.max(map.getZoom(), zoomMin),
      duration: 550,
      essential: true,
    })
  }, [target, bump, map, isLoaded, zoomMin])
  return null
}

export function MapEventHandler({
  onMapClick,
  onMapReady,
}: {
  onMapClick: (lat: number, lng: number) => void | Promise<void>
  onMapReady: (map: maplibregl.Map) => void
}) {
  const { map, isLoaded } = useMap()

  useEffect(() => {
    if (!isLoaded || !map) return
    const click = (e: maplibregl.MapMouseEvent) => {
      void Promise.resolve(onMapClick(e.lngLat.lat, e.lngLat.lng))
    }
    map.on('click', click)
    onMapReady(map)
    return () => {
      map.off('click', click)
    }
  }, [map, isLoaded, onMapClick, onMapReady])

  return null
}

export function MapSearchPanel({
  onPickStart,
  onPickEnd,
}: {
  onPickStart: (p: MapPoint) => void
  onPickEnd: (p: MapPoint) => void
}) {
  const { map, isLoaded } = useMap()
  const [qStart, setQStart] = useState('')
  const [qEnd, setQEnd] = useState('')
  const [busy, setBusy] = useState<'start' | 'end' | null>(null)

  const search = async (which: 'start' | 'end') => {
    const q = which === 'start' ? qStart.trim() : qEnd.trim()
    if (!q || !isLoaded || !map) return
    setBusy(which)
    try {
      const r = await nominatimSearchFirst(q)
      if (!r) return
      map.flyTo({
        center: [r.lng, r.lat],
        zoom: 17,
        duration: 800,
        essential: true,
      })
      const pt: MapPoint = { latitude: r.lat, longitude: r.lng }
      if (which === 'start') onPickStart(pt)
      else onPickEnd(pt)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div
      className="pointer-events-auto absolute right-2 top-14 z-[1000] w-[min(280px,calc(100%-16px))]"
    >
      <div className="flex flex-col gap-2 rounded-lg border border-slate-600 bg-slate-900/95 p-2 text-slate-100 shadow-xl backdrop-blur-sm">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Búsqueda</div>
        <div className="flex gap-1">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-green-400" size={14} />
            <input
              value={qStart}
              onChange={(e) => setQStart(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search('start')}
              placeholder="Inicio (dirección)"
              className="w-full rounded-md border border-slate-600 bg-slate-800 py-1.5 pl-7 pr-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => search('start')}
            className="shrink-0 rounded-md bg-green-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-green-500 disabled:opacity-50"
          >
            Ir
          </button>
        </div>
        <div className="flex gap-1">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-red-400" size={14} />
            <input
              value={qEnd}
              onChange={(e) => setQEnd(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search('end')}
              placeholder="Meta (dirección)"
              className="w-full rounded-md border border-slate-600 bg-slate-800 py-1.5 pl-7 pr-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => search('end')}
            className="shrink-0 rounded-md bg-red-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50"
          >
            Ir
          </button>
        </div>
      </div>
    </div>
  )
}

export function UserLocationTracker({
  onLocationUpdate,
  enabled = false,
}: {
  onLocationUpdate: (point: MapPoint) => void
  enabled: boolean
}) {
  const watchIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled || !navigator.geolocation) {
      return
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const point: MapPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          altitude: position.coords.altitude ?? undefined,
          accuracy: position.coords.accuracy ?? undefined,
        }
        onLocationUpdate(point)
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          console.log('Permiso de ubicación denegado')
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          console.log('Ubicación no disponible')
        } else if (error.code === error.TIMEOUT) {
          console.log('Timeout al obtener ubicación')
        } else {
          console.error('Error de geolocalización:', error)
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      }
    )

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [enabled, onLocationUpdate])

  return null
}
