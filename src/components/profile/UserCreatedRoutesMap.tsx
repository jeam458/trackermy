'use client'

import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Polyline, Tooltip, useMap } from 'react-leaflet'
import { latLngBounds } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Map as MapIcon } from 'lucide-react'
import { BrandSpinner } from '@/components/ui/BrandLogoLoader'
import { SupabaseRouteRepository } from '@/core/infrastructure/repositories/SupabaseRouteRepository'
import { Route } from '@/core/domain/Route'
import { APP_MAP_CANVAS_HEX, DARK_MAP_TILE, routeColorFromId, tileLayerPresetProps } from '@/components/routes/mapTheme'
import { useLocale } from '@/lib/i18n/LocaleProvider'
import { interpolate } from '@/messages/interpolate'

const DEFAULT_CENTER: [number, number] = [-13.5319, -71.9675]

function FitRoutes({ routes }: { routes: Route[] }) {
  const map = useMap()
  useEffect(() => {
    if (routes.length === 0) return
    const b = latLngBounds([])
    for (const r of routes) {
      for (const p of r.trackPoints) {
        b.extend([p.latitude, p.longitude])
      }
    }
    if (b.isValid()) {
      map.fitBounds(b, { padding: [28, 28], maxZoom: 15, animate: true })
    }
  }, [map, routes])
  return null
}

export function UserCreatedRoutesMap({ userId }: { userId: string | null }) {
  const { messages } = useLocale()
  const m = messages.profile.userRoutesMap
  const repoRef = useRef(new SupabaseRouteRepository())
  const [routes, setRoutes] = useState<Route[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const list = await repoRef.current.getUserRoutes(userId)
        if (!cancelled) setRoutes(list)
      } catch (e) {
        console.error(e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  if (!userId) {
    return null
  }

  if (loading) {
    return (
      <section className="bg-gdh-card border border-white/10 rounded-[1.5rem] p-6 flex items-center justify-center gap-3 text-slate-400">
        <BrandSpinner size={22} />
        {m.loading}
      </section>
    )
  }

  if (routes.length === 0) {
    return (
      <section className="bg-gdh-card border border-white/10 rounded-[1.5rem] p-6 text-center text-slate-500">
        <MapIcon className="mx-auto mb-2 opacity-50" size={28} />
        <p className="text-sm">{m.empty}</p>
      </section>
    )
  }

  return (
    <section className="bg-gdh-card border border-white/10 rounded-[1.5rem] overflow-hidden shadow-lg">
      <div className="px-5 py-4 border-b border-white/10">
        <h3 className="font-semibold text-lg text-slate-100">{m.title}</h3>
        <p className="text-xs text-slate-500 mt-1">
          {routes.length === 1 ? m.footerOne : interpolate(m.footerMany, { count: routes.length })}
        </p>
      </div>
      <div className="h-[280px] w-full [&_.leaflet-container]:h-full map-dark-ui">
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={12}
          className="w-full h-full z-0"
          style={{ height: '100%', background: APP_MAP_CANVAS_HEX }}
        >
          <TileLayer {...tileLayerPresetProps(DARK_MAP_TILE)} />
          <FitRoutes routes={routes} />
          {routes.map((route) => {
            const color = routeColorFromId(route.id)
            const positions = route.trackPoints.map((p) => [p.latitude, p.longitude] as [number, number])
            if (positions.length < 2) return null
            return (
              <Polyline
                key={route.id}
                pathOptions={{ color, weight: 4, opacity: 0.85 }}
                positions={positions}
              >
                <Tooltip direction="top" sticky>
                  <span className="text-xs font-medium">{route.name}</span>
                </Tooltip>
              </Polyline>
            )
          })}
        </MapContainer>
      </div>
    </section>
  )
}
