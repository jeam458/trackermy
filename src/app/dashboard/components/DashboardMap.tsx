'use client'

import { useEffect, useState, useRef, useMemo, type ComponentType } from 'react'
import { createPortal } from 'react-dom'
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, useMap } from 'react-leaflet'
import { DivIcon, latLngBounds } from 'leaflet'
import { Check, Crosshair, Layers, Maximize2, Minimize2, Moon, Scan, SunMedium } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import { MapPin, TrendingUp, Mountain } from 'lucide-react'
import { ProfileRepository } from '@/core/infrastructure/repositories/ProfileRepository'
import { createClient } from '@/core/infrastructure/supabase/client'
import { Route, RouteTrackPoint } from '@/core/domain/Route'
import { fetchSampledPreviewPointsByRouteIds } from '@/lib/routeListPreviewTrack'
import { BrandSpinner } from '@/components/ui/BrandLogoLoader'
import { routeViewUrl } from '@/lib/routeViewNavigation'
import { animate, stagger } from '@/lib/animeUi'
import {
  APP_MAP_CANVAS_HEX,
  BRAND_OUTDOOR_MAP_TILE,
  DARK_MAP_TILE,
  routeColorFromId,
  MAP_MARKER_AVATAR_IMG_INLINE_STYLE,
  tileLayerPresetProps,
} from '@/components/routes/mapTheme'
import { routeIconHtmlForRoute } from '@/components/routes/routeIconEngine'

type TilePreset = 'dark' | 'outdoor'

function MapInvalidateOnExpand({ expanded }: { expanded: boolean }) {
  const map = useMap()
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      map.invalidateSize()
    })
    const t = window.setTimeout(() => map.invalidateSize(), 220)
    return () => {
      cancelAnimationFrame(id)
      window.clearTimeout(t)
    }
  }, [map, expanded])
  return null
}

function userMapLocationIcon(mapAvatarUrl: string | null): DivIcon {
  if (mapAvatarUrl?.trim()) {
    const u = encodeURI(mapAvatarUrl.trim())
    return new DivIcon({
      className: 'leaflet-route-marker',
      html: `<div style="width:28px;height:28px;border-radius:50%;overflow:hidden;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.5);"><img src="${u}" alt="" style="${MAP_MARKER_AVATAR_IMG_INLINE_STYLE}"/></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -10],
    })
  }
  return new DivIcon({
    className: 'leaflet-route-marker',
    html: `<div style="width:22px;height:22px;border-radius:50%;background:#3b82f6;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.5);"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -10],
  })
}

const createRouteIcon = (route: Pick<Route, 'id' | 'iconSymbolKey'>) =>
  new DivIcon({
    className: 'leaflet-route-marker',
    html: routeIconHtmlForRoute(route.id, route.iconSymbolKey),
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -10],
  })

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

  const row = (
    preset: TilePreset,
    title: string,
    desc: string,
    Icon: typeof Moon
  ) => {
    const active = current === preset
    return (
      <button
        type="button"
        onClick={() => {
          onSelect(preset)
          onClose()
        }}
        className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
          active
            ? 'border-teal-500/50 bg-teal-500/10'
            : 'border-white/10 bg-slate-800/40 hover:bg-white/5'
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
        aria-labelledby="map-layer-picker-title"
        className="relative z-10 w-full max-w-sm rounded-2xl border border-white/10 bg-gdh-card p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="map-layer-picker-title" className="text-base font-bold text-white">
          Tipo de mapa
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Misma cartografía OpenStreetMap; solo cambia el tratamiento visual (oscuro de marca vs más claro).
        </p>
        <div className="mt-4 space-y-2">
          {row('dark', 'Oscuro marca', 'Contraste alto, alineado al dashboard.', Moon)}
          {row('outdoor', 'Outdoor / claro', 'Mejor lectura de sendas y vegetación.', SunMedium)}
        </div>
      </div>
    </div>,
    document.body
  )
}

function MapFloatingToolbar({
  userLocation,
  routes,
  mapExpanded,
  onToggleMapExpanded,
  tilePreset,
  onOpenLayerPicker,
  layerPickerOpen,
  onUserLocationResolved,
}: {
  userLocation: [number, number] | null
  routes: RouteWithDistance[]
  mapExpanded: boolean
  onToggleMapExpanded?: () => void
  tilePreset: TilePreset
  onOpenLayerPicker: () => void
  layerPickerOpen: boolean
  onUserLocationResolved: (latlng: [number, number]) => void
}) {
  const map = useMap()
  const geoOk = typeof navigator !== 'undefined' && !!navigator.geolocation

  const centerOnUser = () => {
    const fly = (ll: [number, number]) => {
      map.flyTo(ll, Math.max(map.getZoom(), 15), { duration: 0.65 })
    }
    if (userLocation) {
      fly(userLocation)
      return
    }
    if (!geoOk) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const ll: [number, number] = [pos.coords.latitude, pos.coords.longitude]
        onUserLocationResolved(ll)
        fly(ll)
      },
      () => {
        /* permiso denegado o timeout */
      },
      { enableHighAccuracy: true, timeout: 14_000, maximumAge: 0 }
    )
  }

  const showAllRoutes = () => {
    if (routes.length === 0) return
    const b = latLngBounds([])
    routes.forEach((r) => {
      b.extend([r.startCoord[0], r.startCoord[1]])
      r.trackPoints.forEach((p) => b.extend([p.latitude, p.longitude]))
    })
    if (b.isValid()) map.fitBounds(b, { padding: [36, 36], maxZoom: 14, animate: true })
  }

  return (
    <div className="leaflet-top leaflet-right" style={{ marginTop: 56, marginRight: 10, zIndex: 1200 }}>
      {/*
        Leaflet pone pointer-events:none en .leaflet-top; sin un hijo con pointer-events:auto
        los botones nunca reciben clic (parece que “no funcionan”).
      */}
      <div className="leaflet-control flex flex-col gap-2 !float-none !clear-none" style={{ pointerEvents: 'auto' }}>
        <button
          type="button"
          onClick={centerOnUser}
          disabled={!geoOk}
          title={userLocation ? 'Centrar en mi ubicación' : 'Obtener ubicación y centrar'}
          aria-label="Centrar mapa en mi ubicación GPS"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-gdh-card/95 text-teal-400 shadow-lg hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40"
        >
          <Crosshair size={20} aria-hidden />
        </button>
        {onToggleMapExpanded ? (
          <button
            type="button"
            onClick={onToggleMapExpanded}
            aria-pressed={mapExpanded}
            aria-label={mapExpanded ? 'Reducir mapa' : 'Maximizar mapa'}
            title={mapExpanded ? 'Reducir mapa' : 'Maximizar mapa'}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-gdh-card/95 text-gdh-trail shadow-lg hover:bg-white/10"
          >
            {mapExpanded ? <Minimize2 size={20} aria-hidden /> : <Maximize2 size={20} aria-hidden />}
          </button>
        ) : (
          <button
            type="button"
            onClick={showAllRoutes}
            disabled={routes.length === 0}
            title="Ver todas las rutas"
            aria-label="Encuadrar todas las rutas visibles"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-gdh-card/95 text-gdh-trail shadow-lg hover:bg-white/10 disabled:opacity-40"
          >
            <Scan size={20} aria-hidden />
          </button>
        )}
        <button
          type="button"
          onClick={onOpenLayerPicker}
          title="Elegir tipo de mapa (oscuro / outdoor)"
          aria-label="Abrir opciones de tipo de mapa"
          aria-expanded={layerPickerOpen}
          className={`flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-gdh-card/95 shadow-lg hover:bg-white/10 ${
            tilePreset === 'outdoor' ? 'text-emerald-300' : 'text-amber-300'
          }`}
        >
          <Layers size={20} aria-hidden />
        </button>
      </div>
    </div>
  )
}

function MapZoomHandler({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const map = useMap()

  useEffect(() => {
    const handleZoom = () => {
      onZoomChange(map.getZoom())
    }

    map.on('zoomend', handleZoom)
    return () => {
      map.off('zoomend', handleZoom)
    }
  }, [map, onZoomChange])

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

/** Candidatas para “cercanas”; el mapa solo pinta 10. */
const DISCOVER_ROUTE_CANDIDATES = 80
/** Puntos por ruta en polilínea (ligero vs getRouteById completo). */
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

export default function DashboardMap({
  mapExpanded = false,
  onToggleMapExpanded,
}: {
  mapExpanded?: boolean
  onToggleMapExpanded?: () => void
}) {
  const [lightRoutes, setLightRoutes] = useState<Route[]>([])
  const [trackSamples, setTrackSamples] = useState<Record<string, RouteTrackPoint[] | undefined>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null)
  const [currentZoom, setCurrentZoom] = useState(13)
  const [mapAvatarUrl, setMapAvatarUrl] = useState<string | null>(null)
  const [tilePreset, setTilePreset] = useState<TilePreset>('dark')
  const [layerPickerOpen, setLayerPickerOpen] = useState(false)

  useEffect(() => {
    if (!layerPickerOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLayerPickerOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [layerPickerOpen])

  const activeTile =
    tilePreset === 'dark' ? DARK_MAP_TILE : BRAND_OUTDOOR_MAP_TILE
  const profileRepoRef = useRef(new ProfileRepository())
  const routeIconsAnimatedRef = useRef(false)

  const userMarkerIcon = useMemo(() => userMapLocationIcon(mapAvatarUrl), [mapAvatarUrl])

  const defaultCenter: [number, number] = [-13.5319, -71.9675]

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation([position.coords.latitude, position.coords.longitude])
      },
      () => console.log('No se pudo obtener ubicación'),
      { maximumAge: 60_000, timeout: 12_000, enableHighAccuracy: false }
    )
  }, [])

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
    }, 90)
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
          <p className="text-gray-400">Cargando rutas cercanas...</p>
        </div>
      </div>
    )
  }

  return (
    <>
    <MapContainer
      center={userLocation || defaultCenter}
      zoom={userLocation ? 14 : 13}
      className="map-dark-ui z-0 h-full min-h-0 w-full"
      style={{ height: '100%', minHeight: '100%', background: activeTile.canvas ?? APP_MAP_CANVAS_HEX }}
    >
      <TileLayer key={tilePreset} {...tileLayerPresetProps(activeTile)} />

      <MapInvalidateOnExpand expanded={mapExpanded} />
      <MapFloatingToolbar
        userLocation={userLocation}
        routes={routes}
        mapExpanded={mapExpanded}
        onToggleMapExpanded={onToggleMapExpanded}
        tilePreset={tilePreset}
        layerPickerOpen={layerPickerOpen}
        onOpenLayerPicker={() => setLayerPickerOpen(true)}
        onUserLocationResolved={setUserLocation}
      />
      <MapZoomHandler onZoomChange={setCurrentZoom} />

      {userLocation && (
        <Marker position={userLocation} icon={userMarkerIcon}>
          <Popup className="gdh-discover-user-popup" autoPanPadding={[56, 56]}>
            <div className="px-3 py-2.5 pr-10 text-white">
              <strong className="text-blue-400">Tu Ubicación</strong>
            </div>
          </Popup>
        </Marker>
      )}

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
          <Marker
            key={route.id}
            position={[route.startCoord[0], route.startCoord[1]]}
            icon={createRouteIcon(route)}
          >
            <Popup className="gdh-discover-route-popup" autoPanPadding={[56, 56]}>
              <div className="min-w-[250px] px-4 py-3 pr-11 text-white">
                <h3 className="mb-2 pr-1 text-lg font-bold leading-tight">{route.name}</h3>

                {route.description && (
                  <p className="mb-3 text-sm text-gray-300">{route.description}</p>
                )}

                <div className="mb-3 flex items-center gap-2">
                  <Mountain size={16} className={diffColor} />
                  <span className={`${diffColor} text-sm font-medium`}>{diffText}</span>
                </div>

                <div className="mb-3 grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1 text-gray-300">
                    <TrendingUp size={14} />
                    <span className="text-sm font-medium">{route.distanceKm.toFixed(2)} km</span>
                  </div>
                  {route.elevationGainM && (
                    <div className="flex items-center gap-1 text-gray-300">
                      <Mountain size={14} />
                      <span className="text-sm font-medium">+{route.elevationGainM.toFixed(0)} m</span>
                    </div>
                  )}
                </div>

                {userLocation && route.distance > 0 && (
                  <div className="mb-3 flex items-center gap-1 text-blue-400">
                    <MapPin size={14} />
                    <span className="text-sm font-medium">A {route.distance.toFixed(2)} km de ti</span>
                  </div>
                )}

                <div className="mt-3 flex justify-end">
                  <a
                    href={routeViewUrl(route.id, 'discover')}
                    className="gdh-discover-route-cta inline-flex min-h-[2.85rem] min-w-[200px] w-[min(100%,17.5rem)] items-center justify-center rounded-xl bg-gradient-to-r from-gdh-brand to-gdh-brand-muted px-5 py-3 text-sm font-semibold text-white shadow-md shadow-teal-900/30 [text-shadow:0_1px_2px_rgba(0,0,0,0.35)] transition-colors hover:from-gdh-brand-highlight hover:to-gdh-brand"
                  >
                    Ver Detalles
                  </a>
                </div>
              </div>
            </Popup>
          </Marker>
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

        return (
          <Polyline
            key={`line-${route.id}`}
            positions={simplifiedPoints.map((p) => [p.latitude, p.longitude] as [number, number])}
            color={lineColor}
            weight={currentZoom > 16 ? 5 : 3}
            opacity={currentZoom > 15 ? 0.88 : 0.45}
          >
            <Tooltip
              permanent={currentZoom >= 15}
              direction="top"
              offset={[0, -6]}
              opacity={1}
              className="!rounded-md !border !border-slate-600 !bg-slate-900/95 !px-2 !py-1 !text-xs !font-semibold !text-amber-300 !shadow-lg"
            >
              {route.name}
            </Tooltip>
          </Polyline>
        )
      })}
    </MapContainer>
    <MapLayerStylePickerPortal
      open={layerPickerOpen}
      current={tilePreset}
      onSelect={setTilePreset}
      onClose={() => setLayerPickerOpen(false)}
    />
    </>
  )
}
