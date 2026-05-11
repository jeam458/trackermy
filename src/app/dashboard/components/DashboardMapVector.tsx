'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import maplibregl from 'maplibre-gl'
import Link from 'next/link'
import { Check, Layers, Moon, SunMedium, Trees } from 'lucide-react'
import { MapPin, TrendingUp, Mountain } from 'lucide-react'
import { ProfileRepository } from '@/core/infrastructure/repositories/ProfileRepository'
import { createClient } from '@/core/infrastructure/supabase/client'
import type { Route, RouteTrackPoint } from '@/core/domain/Route'
import { fetchSampledPreviewPointsByRouteIds } from '@/lib/routeListPreviewTrack'
import { BrandSpinner } from '@/components/ui/BrandLogoLoader'
import { routeViewUrl } from '@/lib/routeViewNavigation'
import { animate, stagger } from '@/lib/animeUi'
import {
  APP_MAP_CANVAS_HEX,
  MAP_AVATAR_THUMB_IMG_CLASS,
  routeColorFromId,
} from '@/components/routes/mapTheme'
import { routeIconHtmlForRoute } from '@/components/routes/routeIconEngine'
import {
  Map,
  MapControls,
  MapMarker,
  MapRoute,
  MarkerContent,
  MarkerPopup,
  useMap,
} from '@/components/ui/map'
import { cn } from '@/lib/utils'

type TilePreset = 'dark' | 'outdoor' | 'natural'

const CARTO_DARK_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
const STYLE_NATURAL_LIGHT = '/map-styles/guarddh-natural-light.json'
const STYLE_NATURAL_DARK = '/map-styles/guarddh-natural-dark.json'

function MapLayerStylePickerPortal({
  open,
  current,
  onSelect,
  onClose,
}: {
  open: boolean
  current: TilePreset
  onSelect: (p: TilePreset) => void
  onClose: () => void
}) {
  if (!open || typeof document === 'undefined') return null

  const row = (preset: TilePreset, title: string, desc: string, Icon: typeof Moon) => {
    const active = current === preset
    return (
      <button
        type="button"
        onClick={() => {
          onSelect(preset)
          onClose()
        }}
        className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
          active ? 'border-teal-500/50 bg-teal-500/10' : 'border-white/10 bg-slate-800/40 hover:bg-white/5'
        }`}
      >
        <span className="mt-0.5 text-teal-400">
          <Icon size={20} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 font-semibold text-white">
            {title}
            {active ? <Check size={16} className="text-teal-400" aria-hidden /> : null}
          </span>
          <span className="mt-0.5 block text-xs text-slate-400">{desc}</span>
        </span>
      </button>
    )
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[5000] flex items-end justify-center p-3 pb-[calc(5.25rem+env(safe-area-inset-bottom,0px))]"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        aria-label="Cerrar selector de mapa"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="map-layer-picker-title-vector"
        className="relative z-10 w-full max-w-sm rounded-2xl border border-white/10 bg-gdh-card p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="map-layer-picker-title-vector" className="text-base font-bold text-white">
          Tipo de mapa
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Vector MapLibre: CARTO para contraste de marca; estilos GuardDh (OpenFreeMap / OSM) con agua,
          vegetación y relieve.
        </p>
        <div className="mt-4 space-y-2">
          {row('dark', 'Oscuro marca', 'Dark Matter (CARTO) — contraste alto.', Moon)}
          {row('outdoor', 'Naturaleza claro', 'OSM vectorial: bosques, agua y uso del suelo (claro).', SunMedium)}
          {row('natural', 'Naturaleza oscuro', 'Mismo dataset OSM con capas naturales en tema oscuro.', Trees)}
        </div>
      </div>
    </div>,
    document.body
  )
}

function MapResizeOnWindowResize() {
  const { map } = useMap()
  useEffect(() => {
    if (!map) return
    const onResize = () => {
      requestAnimationFrame(() => map.resize())
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [map])
  return null
}

interface RouteWithDistance extends Route {
  distance: number
}

const simplifyTrackPoints = (
  points: Array<{ latitude: number; longitude: number }>,
  zoom: number
) => {
  if (zoom < 14) return points.filter((_, i) => i % 10 === 0)
  if (zoom < 16) return points.filter((_, i) => i % 5 === 0)
  if (zoom < 18) return points.filter((_, i) => i % 2 === 0)
  return points
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

const DISCOVER_ROUTE_CANDIDATES = 80
const MAP_ROUTE_TRACK_SAMPLE = 72

function mapPublicRouteRow(r: Record<string, unknown>): Route {
  return {
    id: String(r.id),
    name: String(r.name),
    description: (r.description as string | null) ?? undefined,
    difficulty: (r.difficulty as Route['difficulty']) ?? 'Beginner',
    trackType: (r.track_type as Route['trackType']) ?? 'trail',
    distanceKm: Number(r.distance_km) || 0,
    elevationGainM: r.elevation_gain_m != null ? Number(r.elevation_gain_m) : undefined,
    elevationLossM: r.elevation_loss_m != null ? Number(r.elevation_loss_m) : undefined,
    startCoord: [Number(r.start_lat), Number(r.start_lng)],
    endCoord: [Number(r.end_lat), Number(r.end_lng)],
    trackPoints: [],
    createdBy: String(r.created_by),
    createdAt: new Date(String(r.created_at)),
    updatedAt: new Date(String(r.updated_at)),
    isPublic: true,
    status: (r.status as Route['status']) ?? 'active',
    previewMediaUrl: (r.preview_media_url as string | null) ?? null,
    iconSymbolKey:
      r.icon_symbol_key != null && String(r.icon_symbol_key).trim() !== ''
        ? String(r.icon_symbol_key)
        : null,
  }
}

function pickRoutesForMap(candidates: Route[], userLoc: [number, number] | null, max = 10): Route[] {
  if (candidates.length === 0) return []
  if (!userLoc) return candidates.slice(0, max)
  return [...candidates]
    .map((r) => ({
      r,
      d: haversineKm(userLoc[0], userLoc[1], r.startCoord[0], r.startCoord[1]),
    }))
    .sort((a, b) => a.d - b.d)
    .slice(0, max)
    .map((x) => x.r)
}

/**
 * Mapa Descubrir con **MapLibre + estilos vectoriales CARTO** (componentes mapcn en `components/ui/map.tsx`).
 */
export default function DashboardMapVector() {
  const [lightRoutes, setLightRoutes] = useState<Route[]>([])
  const [trackSamples, setTrackSamples] = useState<Record<string, RouteTrackPoint[] | undefined>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null)
  const [currentZoom, setCurrentZoom] = useState(13)
  const [mapAvatarUrl, setMapAvatarUrl] = useState<string | null>(null)
  const [tilePreset, setTilePreset] = useState<TilePreset>('dark')
  const [layerPickerOpen, setLayerPickerOpen] = useState(false)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const profileRepoRef = useRef(new ProfileRepository())
  const routeIconsAnimatedRef = useRef(false)

  /** Cusco por defecto [lng, lat] para MapLibre */
  const initialCenterLngLat: [number, number] = [-71.9675, -13.5319]

  const forceStyle = useMemo(() => {
    switch (tilePreset) {
      case 'dark':
        return CARTO_DARK_STYLE
      case 'outdoor':
        return STYLE_NATURAL_LIGHT
      case 'natural':
        return STYLE_NATURAL_DARK
      default:
        return STYLE_NATURAL_DARK
    }
  }, [tilePreset])

  useEffect(() => {
    if (!layerPickerOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLayerPickerOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [layerPickerOpen])

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation([position.coords.latitude, position.coords.longitude])
      },
      () => {},
      { maximumAge: 60_000, timeout: 12_000, enableHighAccuracy: false }
    )
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !userLocation) return
    map.flyTo({
      center: [userLocation[1], userLocation[0]],
      zoom: 14,
      duration: 900,
    })
  }, [userLocation])

  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      try {
        const supabase = createClient()
        const routesQuery = supabase
          .from('routes')
          .select(
            'id, name, description, difficulty, track_type, distance_km, elevation_gain_m, elevation_loss_m, start_lat, start_lng, end_lat, end_lng, created_by, created_at, updated_at, is_public, status, preview_media_url, icon_symbol_key'
          )
          .eq('is_public', true)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(DISCOVER_ROUTE_CANDIDATES)

        const {
          data: { user: authUser },
        } = await supabase.auth.getUser()

        const [routesRes, prof] = await Promise.all([
          routesQuery,
          authUser ? profileRepoRef.current.getProfile(authUser.id) : Promise.resolve(null),
        ])

        if (!cancelled && prof) setMapAvatarUrl(prof.map_avatar_url ?? null)

        if (routesRes.error) throw routesRes.error
        const rows = (routesRes.data || []) as Record<string, unknown>[]
        if (!cancelled) setLightRoutes(rows.map(mapPublicRouteRow))
      } catch (error) {
        console.error('Error cargando rutas:', error)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadData()
    return () => {
      cancelled = true
    }
  }, [])

  const topRoutes = useMemo(
    () => pickRoutesForMap(lightRoutes, userLocation, 10),
    [lightRoutes, userLocation]
  )

  useEffect(() => {
    if (topRoutes.length === 0) return
    const ids = topRoutes.map((r) => r.id)
    const need = ids.filter((id) => trackSamples[id] === undefined)
    if (need.length === 0) return

    let cancelled = false
    void (async () => {
      try {
        const supabase = createClient()
        const m = await fetchSampledPreviewPointsByRouteIds(supabase, need, MAP_ROUTE_TRACK_SAMPLE)
        if (cancelled) return
        setTrackSamples((prev) => {
          const next = { ...prev }
          for (const id of need) {
            next[id] = m.get(id) ?? []
          }
          return next
        })
      } catch (e) {
        console.error('Error cargando trazos del mapa:', e)
        if (!cancelled) {
          setTrackSamples((prev) => {
            const next = { ...prev }
            for (const id of need) {
              if (next[id] === undefined) next[id] = []
            }
            return next
          })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [topRoutes, trackSamples])

  const routes: RouteWithDistance[] = useMemo(() => {
    return topRoutes.map((route) => ({
      ...route,
      trackPoints: trackSamples[route.id] ?? [],
      distance: userLocation
        ? haversineKm(userLocation[0], userLocation[1], route.startCoord[0], route.startCoord[1])
        : 0,
    }))
  }, [topRoutes, trackSamples, userLocation])

  useEffect(() => {
    if (routeIconsAnimatedRef.current) return
    const t = window.setTimeout(() => {
      const icons = document.querySelectorAll<HTMLElement>('.gdh-route-icon:not([data-animated="1"])')
      if (!icons.length) return
      routeIconsAnimatedRef.current = true
      icons.forEach((el) => {
        el.dataset.animated = '1'
      })
      animate(icons, {
        opacity: [0, 1],
        scale: [0.78, 1.06, 1],
        rotate: ['-4deg', '0deg'],
        duration: 560,
        delay: stagger(70),
        ease: 'outCubic',
      })
    }, 120)
    return () => window.clearTimeout(t)
  }, [routes])

  if (isLoading) {
    return (
      <div
        className="flex h-full min-h-[200px] w-full items-center justify-center"
        style={{ background: APP_MAP_CANVAS_HEX }}
      >
        <div className="text-center">
          <BrandSpinner className="mx-auto mb-4" size={48} />
          <p className="text-gray-400">Cargando rutas cercanas…</p>
        </div>
      </div>
    )
  }

  const layerPickerTrigger = (
    <div className="border-border bg-background flex flex-col overflow-hidden rounded-md border shadow-sm">
      <button
        type="button"
        onClick={() => setLayerPickerOpen(true)}
        title="Elegir tipo de mapa"
        aria-label="Abrir opciones de tipo de mapa"
        aria-expanded={layerPickerOpen}
        className={cn(
          'flex size-8 items-center justify-center transition-all',
          'hover:bg-accent dark:hover:bg-accent/40',
          'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset',
          tilePreset === 'dark' && 'text-amber-600 dark:text-amber-300',
          tilePreset === 'outdoor' && 'text-emerald-600 dark:text-emerald-300',
          tilePreset === 'natural' && 'text-sky-500 dark:text-sky-300'
        )}
      >
        <Layers className="size-4" aria-hidden />
      </button>
    </div>
  )

  return (
    <>
      <div
        className="relative z-0 h-full min-h-0 w-full overflow-hidden rounded-[inherit]"
        style={{ background: APP_MAP_CANVAS_HEX }}
      >
        <Map
          ref={mapRef}
          className="map-dark-ui h-full min-h-0 w-full [&_.maplibregl-ctrl-attrib]:!text-[10px] [&_.maplibregl-ctrl-attrib]:!text-slate-400"
          theme="dark"
          forceStyle={forceStyle}
          center={initialCenterLngLat}
          zoom={userLocation ? 14 : 13}
          onViewportChange={(v) => setCurrentZoom(v.zoom)}
        >
          <MapResizeOnWindowResize />
          <MapControls
            position="bottom-right"
            showZoom
            showCompass
            showLocate
            showFullscreen
            onLocate={(c) => setUserLocation([c.latitude, c.longitude])}
            afterContent={layerPickerTrigger}
          />

          {userLocation ? (
            <MapMarker longitude={userLocation[1]} latitude={userLocation[0]}>
              <MarkerContent>
                {mapAvatarUrl?.trim() ? (
                  <div
                    className="h-7 w-7 overflow-hidden rounded-full border-2 border-white shadow-lg"
                    style={{ boxShadow: '0 2px 8px rgba(0,0,0,.5)' }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={encodeURI(mapAvatarUrl.trim())}
                      alt=""
                      className={MAP_AVATAR_THUMB_IMG_CLASS}
                    />
                  </div>
                ) : (
                  <div
                    className="h-5 w-5 rounded-full border-[3px] border-white bg-blue-500 shadow-lg"
                    style={{ boxShadow: '0 2px 8px rgba(0,0,0,.5)' }}
                  />
                )}
              </MarkerContent>
              <MarkerPopup>
                <div className="px-3 py-2.5 pr-8 text-white">
                  <strong className="text-blue-400">Tu ubicación</strong>
                </div>
              </MarkerPopup>
            </MapMarker>
          ) : null}

          {routes.map((route) => {
            const diffColor =
              route.difficulty === 'Expert'
                ? 'text-red-400'
                : route.difficulty === 'Intermediate'
                  ? 'text-sky-400'
                  : 'text-emerald-400'
            const diffText =
              route.difficulty === 'Expert'
                ? 'Experto'
                : route.difficulty === 'Intermediate'
                  ? 'Intermedio'
                  : 'Principiante'

            return (
              <MapMarker
                key={route.id}
                longitude={route.startCoord[1]}
                latitude={route.startCoord[0]}
              >
                <MarkerContent>
                  <div
                    className="gdh-route-icon flex items-center justify-center"
                    dangerouslySetInnerHTML={{
                      __html: routeIconHtmlForRoute(route.id, route.iconSymbolKey),
                    }}
                  />
                </MarkerContent>
                <MarkerPopup>
                  <div className="min-w-[250px] px-4 py-3 pr-10 text-white">
                    <h3 className="mb-2 pr-1 text-lg font-bold leading-tight">{route.name}</h3>
                    {route.description ? <p className="mb-3 text-sm text-gray-300">{route.description}</p> : null}
                    <div className="mb-3 flex items-center gap-2">
                      <Mountain size={16} className={diffColor} />
                      <span className={`${diffColor} text-sm font-medium`}>{diffText}</span>
                    </div>
                    <div className="mb-3 grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-1 text-gray-300">
                        <TrendingUp size={14} />
                        <span className="text-sm font-medium">{route.distanceKm.toFixed(2)} km</span>
                      </div>
                      {route.elevationGainM ? (
                        <div className="flex items-center gap-1 text-gray-300">
                          <Mountain size={14} />
                          <span className="text-sm font-medium">+{route.elevationGainM.toFixed(0)} m</span>
                        </div>
                      ) : null}
                    </div>
                    {userLocation && route.distance > 0 ? (
                      <div className="mb-3 flex items-center gap-1 text-blue-400">
                        <MapPin size={14} />
                        <span className="text-sm font-medium">A {route.distance.toFixed(2)} km de ti</span>
                      </div>
                    ) : null}
                    <div className="mt-3 flex justify-end">
                      <Link
                        href={routeViewUrl(route.id, 'discover')}
                        className="gdh-discover-route-cta inline-flex min-h-[2.85rem] min-w-[200px] w-[min(100%,17.5rem)] items-center justify-center rounded-xl bg-gradient-to-r from-gdh-brand to-gdh-brand-muted px-5 py-3 text-sm font-semibold text-white shadow-md shadow-teal-900/30 [text-shadow:0_1px_2px_rgba(0,0,0,0.35)] transition-colors hover:from-gdh-brand-highlight hover:to-gdh-brand"
                      >
                        Ver detalles
                      </Link>
                    </div>
                  </div>
                </MarkerPopup>
              </MapMarker>
            )
          })}

          {routes.map((route) => {
            if (route.trackPoints.length === 0) return null
            const simplifiedPoints = simplifyTrackPoints(
              route.trackPoints.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
              currentZoom
            )
            if (simplifiedPoints.length < 2) return null
            const lineColor = routeColorFromId(route.id)
            const coords: [number, number][] = simplifiedPoints.map((p) => [p.longitude, p.latitude])
            return (
              <MapRoute
                key={`line-${route.id}`}
                id={route.id}
                coordinates={coords}
                color={lineColor}
                width={currentZoom > 16 ? 5 : 3}
                opacity={currentZoom > 15 ? 0.88 : 0.45}
              />
            )
          })}
        </Map>
      </div>
      <MapLayerStylePickerPortal
        open={layerPickerOpen}
        current={tilePreset}
        onSelect={setTilePreset}
        onClose={() => setLayerPickerOpen(false)}
      />
    </>
  )
}
