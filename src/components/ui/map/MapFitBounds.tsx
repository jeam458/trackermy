'use client'

import maplibregl from 'maplibre-gl'
import { useEffect } from 'react'
import { useMap } from './MapContext'

export type MapFitBoundsProps = {
  /** Coordenadas MapLibre: [lng, lat] cada una */
  lngLats: [number, number][]
  maxZoom?: number
  padding?: number | maplibregl.PaddingOptions
  duration?: number
  enabled?: boolean
}

export function MapFitBounds({
  lngLats,
  maxZoom = 16,
  padding = 24,
  duration = 0,
  enabled = true,
}: MapFitBoundsProps) {
  const { map, isLoaded } = useMap()

  useEffect(() => {
    if (!enabled || !isLoaded || !map || lngLats.length < 2) return

    const fit = () => {
      try {
        map.resize()
      } catch {
        /* noop */
      }
      const b = new maplibregl.LngLatBounds(lngLats[0], lngLats[0])
      for (const c of lngLats) b.extend(c)
      map.fitBounds(b, { padding, maxZoom, duration })
    }

    fit()
    const raf = requestAnimationFrame(fit)
    const t = window.setTimeout(fit, 200)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(t)
    }
  }, [map, isLoaded, lngLats, maxZoom, padding, duration, enabled])

  return null
}
