'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { createClient } from '@/core/infrastructure/supabase/client'
import { SupabaseRouteRepository } from '@/core/infrastructure/repositories/SupabaseRouteRepository'
import { Route } from '@/core/domain/Route'
import {
  Plus,
  MapPin,
  Map,
  TrendingUp,
  Mountain,
  Clock,
  MoreVertical,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  X,
  Menu,
} from 'lucide-react'
import { BrandLogoLoader } from '@/components/ui/BrandLogoLoader'
import { AnimeIconButton } from '@/components/ui/AnimeIconButton'
import {
  DashboardAppTopBar,
  DashboardAppTopBarHeading,
  DASHBOARD_APP_TOP_BAR_ICON_BUTTON_CLASS,
  DashboardCoachHeaderSlot,
} from '@/app/dashboard/components/DashboardAppTopBar'
import { useDashboardSidebar } from '@/lib/dashboard/DashboardSidebarContext'
import { cn } from '@/lib/utils'
import { getAuthUserOrNull } from '@/lib/authSession'
import { routeViewUrl } from '@/lib/routeViewNavigation'
import { routePreviewIsVideo } from '@/lib/routePreviewMedia'
import { fetchSampledPreviewPointsByRouteIds, thumbnailTrackPoints } from '@/lib/routeListPreviewTrack'
import { RouteTraceThumbnail } from '@/components/routes/RouteTraceThumbnail'

const SelectedRoutePreviewMap = dynamic(
  () =>
    import('@/components/routes/SelectedRoutePreviewMap').then((m) => ({
      default: m.SelectedRoutePreviewMap,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-40 rounded-xl border border-slate-700 bg-slate-900/80 flex items-center justify-center text-sm text-slate-500">
        Cargando mapa del trazado…
      </div>
    ),
  }
)

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const config: Record<string, { color: string; label: string; icon: string }> = {
    Beginner: { color: 'bg-green-500/20 text-green-400 border-green-500/30', label: 'Principiante', icon: '🟢' },
    Intermediate: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', label: 'Intermedio', icon: '🔵' },
    Expert: { color: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'Experto', icon: '🔴' },
  }

  const { color, label, icon } = config[difficulty] || config.Beginner

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${color}`}>
      {icon} {label}
    </span>
  )
}

function RouteCard({
  route,
  onDelete,
  onToggleVisibility,
  onMapPreview,
  mapPreviewOpen,
  mapPreviewLoading,
}: {
  route: Route
  onDelete: (id: string) => void
  onToggleVisibility: (id: string, isPublic: boolean) => void
  onMapPreview: (r: Route) => void | Promise<void>
  mapPreviewOpen: boolean
  mapPreviewLoading: boolean
}) {
  const [showMenu, setShowMenu] = useState(false)

  return (
    <div className="gdh-immersive-card rounded-xl overflow-hidden transition-colors">
      {/* Header con vista previa (imagen / GIF / clip) o placeholder */}
      <div className="h-32 bg-gradient-to-br from-amber-500/20 to-slate-800 relative overflow-hidden">
        {route.previewMediaUrl ? (
          routePreviewIsVideo(route.previewMediaUrl) ? (
            <video
              src={route.previewMediaUrl}
              className="absolute inset-0 w-full h-full object-cover"
              muted
              loop
              playsInline
              autoPlay
              preload="metadata"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={route.previewMediaUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          )
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <RouteTraceThumbnail trackPoints={thumbnailTrackPoints(route)} />
          </div>
        )}
        
        {/* Badge de visibilidad */}
        <div className="absolute top-3 right-3">
          {route.isPublic ? (
            <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs flex items-center gap-1">
              <Eye size={12} />
              Pública
            </span>
          ) : (
            <span className="px-2 py-1 bg-slate-700 text-gray-400 rounded-full text-xs flex items-center gap-1">
              <EyeOff size={12} />
              Privada
            </span>
          )}
        </div>
      </div>

      {/* Contenido */}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white truncate">{route.name}</h3>
            {route.description && (
              <p className="text-sm text-gray-400 truncate mt-1">{route.description}</p>
            )}
          </div>

          {/* Menú */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <MoreVertical size={16} className="text-gray-400" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-10 min-w-[150px]">
                <button
                  onClick={() => {
                    onToggleVisibility(route.id, !route.isPublic)
                    setShowMenu(false)
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-700 flex items-center gap-2"
                >
                  {route.isPublic ? <EyeOff size={16} /> : <Eye size={16} />}
                  {route.isPublic ? 'Hacer privada' : 'Hacer pública'}
                </button>
                <Link
                  href={`/dashboard/routes/edit?id=${encodeURIComponent(route.id)}`}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-700 flex items-center gap-2"
                  onClick={() => setShowMenu(false)}
                >
                  <Edit2 size={16} />
                  Editar
                </Link>
                <button
                  onClick={() => {
                    onDelete(route.id)
                    setShowMenu(false)
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-red-500/20 text-red-400 flex items-center gap-2"
                >
                  <Trash2 size={16} />
                  Eliminar
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <DifficultyBadge difficulty={route.difficulty} />
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-amber-400 mb-1">
              <TrendingUp size={14} />
            </div>
            <p className="text-sm font-bold text-white">{route.distanceKm.toFixed(2)}</p>
            <p className="text-xs text-gray-400">km</p>
          </div>
          <div className="text-center border-l border-slate-800">
            <div className="flex items-center justify-center gap-1 text-green-400 mb-1">
              <Mountain size={14} />
            </div>
            <p className="text-sm font-bold text-white">
              {route.elevationGainM ? `+${route.elevationGainM.toFixed(0)}` : '-'}
            </p>
            <p className="text-xs text-gray-400">m ↑</p>
          </div>
          <div className="text-center border-l border-slate-800">
            <div className="flex items-center justify-center gap-1 text-blue-400 mb-1">
              <Clock size={14} />
            </div>
            <p className="text-sm font-bold text-white">-</p>
            <p className="text-xs text-gray-400">record</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void onMapPreview(route)}
          disabled={mapPreviewLoading}
          aria-expanded={mapPreviewOpen}
          className={`w-full py-2 text-center text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${
            mapPreviewOpen
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-100'
          } ${mapPreviewLoading ? 'opacity-60 pointer-events-none' : ''}`}
        >
          <Map size={16} />
          {mapPreviewLoading
            ? 'Abriendo mapa…'
            : mapPreviewOpen
            ? 'Vista previa activa'
            : thumbnailTrackPoints(route).length >= 2
              ? 'Vista previa en mapa'
              : 'Cargar vista previa'}
        </button>

        {/* Ver ruta en mapa */}
        <Link
          href={routeViewUrl(route.id, 'routes')}
          className="block w-full py-2 bg-slate-800 hover:bg-slate-700 text-center text-sm font-medium rounded-lg transition-colors"
        >
          Ver detalles
        </Link>
      </div>
    </div>
  )
}

export default function RoutesPage() {
  const { openSidebar } = useDashboardSidebar()
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [routes, setRoutes] = useState<Route[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mapPreviewRoute, setMapPreviewRoute] = useState<Route | null>(null)
  const [mapPreviewPortalReady, setMapPreviewPortalReady] = useState(false)
  const [mapPreviewLoadingRouteId, setMapPreviewLoadingRouteId] = useState<string | null>(null)
  const hasLoadedRoutesRef = useRef(false)

  const repository = useMemo(() => new SupabaseRouteRepository(), [])
  const supabase = useMemo(() => createClient(), [])

  const handleMapPreviewToggle = async (r: Route) => {
    if (mapPreviewRoute?.id === r.id) {
      setMapPreviewRoute(null)
      return
    }
    setMapPreviewLoadingRouteId(r.id)
    try {
      const full = await repository.getRouteById(r.id)
      if (full && full.trackPoints.length >= 2) {
        setMapPreviewRoute(full)
      }
    } finally {
      setMapPreviewLoadingRouteId(null)
    }
  }

  useEffect(() => {
    setMapPreviewPortalReady(true)
  }, [])

  useEffect(() => {
    if (!mapPreviewRoute) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMapPreviewRoute(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [mapPreviewRoute])

  // Cargar usuario (sesión local primero → menos espera que getUser solo)
  useEffect(() => {
    void (async () => {
      const supaUser = await getAuthUserOrNull()
      if (supaUser) setUser({ id: supaUser.id })
    })()
  }, [])

  // Cargar rutas
  useEffect(() => {
    if (!user) return
    if (hasLoadedRoutesRef.current) return
    hasLoadedRoutesRef.current = true

    const loadRoutes = async () => {
      try {
        setIsLoading(true)
        const { data, error } = await supabase
          .from('routes')
          .select(
            'id, name, description, difficulty, track_type, distance_km, elevation_gain_m, elevation_loss_m, start_lat, start_lng, end_lat, end_lng, created_by, created_at, updated_at, is_public, status, preview_media_url, icon_symbol_key'
          )
          .eq('created_by', user.id)
          .order('created_at', { ascending: false })
        if (error) throw error
        const lightRoutes: Route[] = (data || []).map((r) => ({
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
          isPublic: Boolean(r.is_public),
          status: (r.status as Route['status']) ?? 'active',
          previewMediaUrl: (r.preview_media_url as string | null) ?? null,
          iconSymbolKey:
            r.icon_symbol_key != null && String(r.icon_symbol_key).trim() !== ''
              ? String(r.icon_symbol_key)
              : null,
        }))
        let mergedRoutes = lightRoutes
        try {
          const previewMap = await fetchSampledPreviewPointsByRouteIds(supabase, lightRoutes.map((x) => x.id))
          mergedRoutes = lightRoutes.map((route) => ({
            ...route,
            trackPoints: previewMap.get(route.id) ?? [],
          }))
        } catch (prevErr) {
          console.error('Vista previa listado (muestreada):', prevErr)
        }
        setRoutes(mergedRoutes)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error cargando rutas')
      } finally {
        setIsLoading(false)
      }
    }

    loadRoutes()
  }, [user])

  // Eliminar ruta
  const handleDelete = async (routeId: string) => {
    if (!confirm('¿Estás seguro de eliminar esta ruta?')) return

    try {
      await repository.deleteRoute(routeId)
      setRoutes((prev) => prev.filter((r) => r.id !== routeId))
      setMapPreviewRoute((prev) => (prev?.id === routeId ? null : prev))
    } catch (err) {
      alert('Error eliminando la ruta')
    }
  }

  // Cambiar visibilidad
  const handleToggleVisibility = async (routeId: string, isPublic: boolean) => {
    try {
      await repository.updateRoute(routeId, { isPublic })
      setRoutes((prev) =>
        prev.map((r) => (r.id === routeId ? { ...r, isPublic } : r))
      )
    } catch (err) {
      alert('Error actualizando la ruta')
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gdh-page flex items-center justify-center">
        <div className="text-center">
          <BrandLogoLoader label="Cargando rutas..." compact showRing />
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gdh-page flex items-center justify-center">
        <BrandLogoLoader label="Cargando rutas..." compact showRing />
      </div>
    )
  }

  return (
    <div className="gdh-immersive-page text-slate-100 pb-28">
      <DashboardAppTopBar
        leading={
          <AnimeIconButton
            label="Menú"
            onClick={() => openSidebar()}
            className={cn(DASHBOARD_APP_TOP_BAR_ICON_BUTTON_CLASS)}
          >
            <Menu size={22} aria-hidden />
          </AnimeIconButton>
        }
        center={
          <DashboardAppTopBarHeading
            title="Mis Rutas"
            subtitle={`${routes.length} ${routes.length === 1 ? 'ruta' : 'rutas'} creadas`}
          />
        }
        trailing={
          <div className="flex min-w-0 shrink-0 items-center justify-end gap-1.5">
            <DashboardCoachHeaderSlot />
            <Link
              href="/dashboard/routes/create"
              className="inline-flex max-w-[10.5rem] items-center gap-1.5 truncate rounded-xl border border-teal-400/30 bg-teal-500/15 px-3 py-2 text-sm font-semibold text-teal-100 transition-colors hover:bg-teal-500/25 sm:max-w-none sm:gap-2"
            >
              <Plus size={18} aria-hidden className="shrink-0" />
              <span className="truncate">Crear Ruta</span>
            </Link>
          </div>
        }
      />

      {/* Contenido */}
      <main className="max-w-7xl mx-auto p-4">
        {error ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
            <p className="text-red-400">{error}</p>
          </div>
        ) : routes.length === 0 ? (
          <div className="text-center py-20">
            <MapPin className="mx-auto text-gray-600 mb-4" size={64} />
            <h2 className="text-xl font-semibold text-white mb-2">
              No tienes rutas creadas
            </h2>
            <p className="text-gray-400 mb-6">
              Crea tu primera ruta dibujándola en el mapa o grabándola en tiempo real
            </p>
            <div className="flex items-center justify-center">
              <Link
                href="/dashboard/routes/create"
                className="px-6 py-3 rounded-xl border border-teal-400/30 bg-teal-500/20 text-teal-100 hover:bg-teal-500/30 transition-colors flex items-center gap-2 font-semibold"
              >
                <Plus size={20} />
                Crear Ruta
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {routes.map((route) => (
                <RouteCard
                  key={route.id}
                  route={route}
                  onDelete={handleDelete}
                  onToggleVisibility={handleToggleVisibility}
                  onMapPreview={handleMapPreviewToggle}
                  mapPreviewOpen={mapPreviewRoute?.id === route.id}
                  mapPreviewLoading={mapPreviewLoadingRouteId === route.id}
                />
              ))}
            </div>
            {mapPreviewPortalReady &&
              mapPreviewRoute &&
              mapPreviewRoute.trackPoints.length >= 2 &&
              createPortal(
                <div
                  className="fixed inset-0 z-[2147483645] flex items-center justify-center bg-black/70 p-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:p-6"
                  role="presentation"
                  onClick={() => setMapPreviewRoute(null)}
                >
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="route-map-preview-title"
                    className="relative w-full max-w-2xl max-h-[min(85dvh,720px)] overflow-y-auto rounded-2xl border border-slate-600/80 bg-gdh-card p-4 shadow-2xl"
                    style={{ zIndex: 2147483646 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <h2
                          id="route-map-preview-title"
                          className="text-lg font-semibold text-white truncate"
                        >
                          Vista previa: {mapPreviewRoute.name}
                        </h2>
                        <p className="text-sm text-slate-400">Trazado sobre mapa</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMapPreviewRoute(null)}
                        className="shrink-0 p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                        aria-label="Cerrar vista previa"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <SelectedRoutePreviewMap route={mapPreviewRoute} />
                  </div>
                </div>,
                document.body
              )}
          </>
        )}
      </main>
    </div>
  )
}
