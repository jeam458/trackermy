'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Map as MapIcon } from 'lucide-react'
import { BrandSpinner } from '@/components/ui/BrandLogoLoader'
import { SupabaseRouteRepository } from '@/core/infrastructure/repositories/SupabaseRouteRepository'
import { Route } from '@/core/domain/Route'
import { APP_MAP_CANVAS_HEX, routeColorFromId } from '@/components/routes/mapTheme'
import { useLocale } from '@/lib/i18n/LocaleProvider'
import { interpolate } from '@/messages/interpolate'
import { MAPLIBRE_CARTO_DARK_STYLE } from '@/lib/maplibreAppStyles'
import { Map, MapControls, MapFitBounds, MapRoute, useMap } from '@/components/ui/map'

const DEFAULT_CENTER_LNGLAT: [number, number] = [-71.9675, -13.5319]

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

function combinedLngLatsForRoutes(routes: Route[]): [number, number][] {
  const out: [number, number][] = []
  for (const r of routes) {
    for (const p of r.trackPoints) {
      out.push([p.longitude, p.latitude])
    }
  }
  return out
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
    void (async () => {
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

  const boundsCoords = useMemo(() => combinedLngLatsForRoutes(routes), [routes])

  if (!userId) {
    return null
  }

  if (loading) {
    return (
      <section className="flex items-center justify-center gap-3 rounded-[1.5rem] border border-white/10 bg-gdh-card p-6 text-slate-400">
        <BrandSpinner size={22} />
        {m.loading}
      </section>
    )
  }

  if (routes.length === 0) {
    return (
      <section className="rounded-[1.5rem] border border-white/10 bg-gdh-card p-6 text-center text-slate-500">
        <MapIcon className="mx-auto mb-2 opacity-50" size={28} />
        <p className="text-sm">{m.empty}</p>
      </section>
    )
  }

  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-gdh-card shadow-lg">
      <div className="border-b border-white/10 px-5 py-4">
        <h3 className="text-lg font-semibold text-slate-100">{m.title}</h3>
        <p className="mt-1 text-xs text-slate-500">
          {routes.length === 1 ? m.footerOne : interpolate(m.footerMany, { count: routes.length })}
        </p>
      </div>
      <div className="h-[280px] w-full map-dark-ui" style={{ background: APP_MAP_CANVAS_HEX }}>
        <Map
          theme="dark"
          forceStyle={MAPLIBRE_CARTO_DARK_STYLE}
          className="map-dark-ui h-full w-full [&_.maplibregl-ctrl-attrib]:!text-[10px] [&_.maplibregl-ctrl-attrib]:!text-slate-400"
          center={DEFAULT_CENTER_LNGLAT}
          zoom={12}
          minZoom={3}
          maxZoom={22}
        >
          <MapResizeOnWindowResize />
          <MapControls position="bottom-right" showZoom showCompass />
          {boundsCoords.length >= 2 && (
            <MapFitBounds lngLats={boundsCoords} maxZoom={15} padding={28} duration={0} />
          )}
          {routes.map((route) => {
            const color = routeColorFromId(route.id)
            const coords = route.trackPoints.map((p) => [p.longitude, p.latitude] as [number, number])
            if (coords.length < 2) return null
            return (
              <MapRoute
                key={route.id}
                id={`user-route-${route.id}`}
                coordinates={coords}
                color={color}
                width={4}
                opacity={0.85}
                interactive={false}
              />
            )
          })}
        </Map>
      </div>
    </section>
  )
}
