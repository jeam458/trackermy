'use client'

import dynamic from 'next/dynamic'
import { Suspense, useState, useEffect, useMemo, useCallback, type ComponentType } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { normalizeRouteViewFrom, resolveRouteViewBackHref } from '@/lib/routeViewNavigation'
import { createClient } from '@/core/infrastructure/supabase/client'
import { SupabaseRouteRepository } from '@/core/infrastructure/repositories/SupabaseRouteRepository'
import type { Route as DomainRoute } from '@/core/domain/Route'
import {
  Trophy,
  Users,
  TrendingUp,
  Gauge,
  Mountain,
  AlertTriangle,
  ListOrdered,
  ChevronDown,
  ChevronUp,
  Trash2,
  Loader2,
  Pencil,
  ArrowLeft,
} from 'lucide-react'
import { BrandLogoLoader } from '@/components/ui/BrandLogoLoader'
import {
  DashboardAppTopBar,
  DashboardAppTopBarHeading,
  DASHBOARD_APP_TOP_BAR_ICON_BUTTON_CLASS,
  DashboardCoachHeaderSlot,
} from '@/app/dashboard/components/DashboardAppTopBar'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { routePreviewIsVideo } from '@/lib/routePreviewMedia'
import { RouteMyRankPanel } from '@/components/routes/RouteMyRankPanel'
import { RouteOverviewShowcaseSection } from '@/components/routes/RouteOverviewShowcaseSection'
import {
  displaySpeedTriple,
  formatAggregatedMaxRecordedSpeedMps,
} from '@/lib/attemptSpeedDisplay'
import { canModerateRouteAsUser } from '@/lib/routeModeration'
import { deleteRouteStorageAssetsBeforeDb } from '@/lib/deleteRouteStorageAssets'
import { objectPathFromSupabasePublicUrl } from '@/lib/supabasePublicStoragePath'
import { toast } from '@/lib/toast'

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

interface RouteStatistics {
  total_attempts: number
  unique_riders: number
  best_time: number | null
  avg_time: number | null
  best_score: number | null
  avg_score: number | null
  max_recorded_speed: number | null
  avg_jumps: number | null
  avg_stops: number | null
}

interface RouteData {
  id: string
  name: string
  description: string | null
  distance_km: number
  elevation_gain_m: number | null
  difficulty: string
  is_public: boolean
  preview_media_url?: string | null
  created_by: string
}

interface RouteMetricCard {
  key: string
  label: string
  value: string
  valueClassName?: string
  icon?: ComponentType<{ size?: number; className?: string }>
  iconClassName?: string
  footer?: string
}

function RouteDashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const routeId = searchParams.get('id')
  const fromParam = normalizeRouteViewFrom(searchParams.get('from'))
  const attemptIdForBack = searchParams.get('attemptId')
  const replayFromParam = searchParams.get('replayFrom')

  const explicitBackHref = useMemo(
    () =>
      resolveRouteViewBackHref(fromParam, routeId, {
        attemptId: attemptIdForBack,
        replayFrom: replayFromParam,
      }),
    [fromParam, routeId, attemptIdForBack, replayFromParam]
  )

  const goBack = useCallback(() => {
    if (explicitBackHref) {
      router.push(explicitBackHref)
      return
    }
    router.back()
  }, [explicitBackHref, router])
  const [route, setRoute] = useState<RouteData | null>(null)
  const [domainRoute, setDomainRoute] = useState<DomainRoute | null>(null)
  const [statistics, setStatistics] = useState<RouteStatistics | null>(null)
  const [bestTime, setBestTime] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [sessionUser, setSessionUser] = useState<{ id: string; email: string | null } | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [saveMetaBusy, setSaveMetaBusy] = useState(false)
  const [removePreviewBusy, setRemovePreviewBusy] = useState(false)
  const [deleteRouteModalOpen, setDeleteRouteModalOpen] = useState(false)
  const [deleteRouteBusy, setDeleteRouteBusy] = useState(false)
  const [editPanelOpen, setEditPanelOpen] = useState(false)
  const routeRepo = useMemo(() => new SupabaseRouteRepository(), [])

  const canModerate = useMemo(
    () =>
      Boolean(
        route &&
          sessionUser &&
          canModerateRouteAsUser({
            userId: sessionUser.id,
            userEmail: sessionUser.email,
            routeCreatedBy: route.created_by,
          })
      ),
    [route, sessionUser]
  )

  // Cargar datos de la ruta
  useEffect(() => {
    if (!routeId) {
      setLoading(false)
      setError('Falta el id de la ruta en la URL (?id=…)')
      return
    }

    const loadRouteData = async () => {
      try {
        const supabase = createClient()

        const {
          data: { user },
        } = await supabase.auth.getUser()
        setSessionUser(user ? { id: user.id, email: user.email ?? null } : null)

        // Cargar ruta
        const { data: routeData, error: routeError } = await supabase
          .from('routes')
          .select('*')
          .eq('id', routeId)
          .single()

        if (routeError) throw routeError
        setRoute(routeData)

        // Cargar estadísticas
        const { data: statsData } = await supabase
          .rpc('get_route_statistics', { p_route_id: routeId })

        if (statsData && statsData.length > 0) {
          setStatistics(statsData[0])
        }

        // Cargar mejor tiempo
        const { data: bestTimeData } = await supabase
          .from('route_attempts')
          .select('*')
          .eq('route_id', routeId)
          .eq('is_public', true)
          .order('total_time', { ascending: true })
          .limit(1)
          .single()

        if (bestTimeData) {
          setBestTime(bestTimeData)
        }
      } catch (err) {
        console.error('Error cargando ruta:', err)
        setError('No se pudo cargar la ruta')
      } finally {
        setLoading(false)
      }
    }

    loadRouteData()
  }, [routeId])

  useEffect(() => {
    if (!route) return
    setEditName(route.name)
    setEditDescription(route.description ?? '')
  }, [route?.id, route?.name, route?.description])

  const handleSaveRouteMeta = async () => {
    if (!routeId || !canModerate || !route) return
    const name = editName.trim()
    if (!name) {
      toast.error('Nombre vacío', 'Indica un nombre para la ruta.')
      return
    }
    setSaveMetaBusy(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('routes')
        .update({
          name,
          description: editDescription.trim() ? editDescription.trim() : null,
        })
        .eq('id', routeId)

      if (error) throw error
      setRoute((prev) =>
        prev ? { ...prev, name, description: editDescription.trim() ? editDescription.trim() : null } : prev
      )
      toast.success('Cambios guardados', 'Nombre y descripción actualizados.')
    } catch (err) {
      console.error(err)
      toast.error('No se pudo guardar', err instanceof Error ? err.message : 'Inténtalo de nuevo.')
    } finally {
      setSaveMetaBusy(false)
    }
  }

  const handleRemovePreviewMedia = async () => {
    if (!route?.preview_media_url || !routeId || !canModerate) return
    if (
      !window.confirm(
        '¿Quitar la imagen o vídeo de vista previa de esta ruta? Se borrará el archivo del almacenamiento.'
      )
    )
      return
    setRemovePreviewBusy(true)
    try {
      const supabase = createClient()
      const path = objectPathFromSupabasePublicUrl(route.preview_media_url, 'route-previews')
      if (path) {
        const { error: se } = await supabase.storage.from('route-previews').remove([path])
        if (se) console.warn('[remove preview]', se.message)
      }
      const { error } = await supabase.from('routes').update({ preview_media_url: null }).eq('id', routeId)
      if (error) throw error
      setRoute((prev) => (prev ? { ...prev, preview_media_url: null } : prev))
      toast.success('Vista previa eliminada')
    } catch (err) {
      console.error(err)
      toast.error('Error', err instanceof Error ? err.message : 'No se pudo quitar la vista previa.')
    } finally {
      setRemovePreviewBusy(false)
    }
  }

  const handleConfirmDeleteRoute = async () => {
    if (!routeId || !route || !canModerate) return
    setDeleteRouteBusy(true)
    try {
      const supabase = createClient()
      await deleteRouteStorageAssetsBeforeDb(supabase, routeId, route.preview_media_url)
      await routeRepo.deleteRoute(routeId)
      toast.success('Ruta eliminada', 'Se borraron intentos, puntos y medios asociados.')
      setDeleteRouteModalOpen(false)
      router.push('/dashboard/routes')
    } catch (err) {
      console.error(err)
      toast.error(
        'No se pudo eliminar la ruta',
        err instanceof Error ? err.message : 'Comprueba permisos o conexión.'
      )
    } finally {
      setDeleteRouteBusy(false)
    }
  }

  useEffect(() => {
    if (!routeId) {
      setDomainRoute(null)
      return
    }
    setDomainRoute(null)
    let cancelled = false
    routeRepo.getRouteById(routeId).then((r) => {
      if (!cancelled) setDomainRoute(r)
    })
    return () => {
      cancelled = true
    }
  }, [routeId, routeRepo])

  // Formatear tiempo
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 100)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
  }

  const bestTimeSpeeds =
    bestTime != null
      ? displaySpeedTriple(
          bestTime.gps_points,
          bestTime.max_speed,
          bestTime.avg_speed
        )
      : null

  const metricCards: RouteMetricCard[] = route
    ? [
        {
          key: 'distance',
          label: 'Distancia',
          value: `${route.distance_km.toFixed(2)} km`,
          icon: TrendingUp,
          iconClassName: 'text-amber-500',
        },
        {
          key: 'elevation',
          label: 'Desnivel +',
          value: route.elevation_gain_m != null ? `+${route.elevation_gain_m.toFixed(0)} m` : 'N/A',
          icon: Mountain,
          iconClassName: 'text-green-500',
        },
        {
          key: 'difficulty',
          label: 'Dificultad',
          value: route.difficulty,
          icon: Gauge,
          iconClassName: 'text-blue-500',
        },
        {
          key: 'record',
          label: 'Récord (comunidad)',
          value: bestTime ? formatTime(bestTime.total_time) : 'Aún no hay intentos',
          valueClassName: bestTime
            ? 'text-lg font-bold text-amber-400 font-mono tabular-nums'
            : 'text-sm text-slate-500',
          icon: Trophy,
          iconClassName: 'text-amber-500',
          footer:
            bestTime && bestTimeSpeeds
              ? `v: ${bestTimeSpeeds.maxKmh} med. ${bestTimeSpeeds.avgKmh} · sc ${bestTime.overall_score ?? '—'}/100`
              : undefined,
        },
        ...(statistics
          ? [
              {
                key: 'unique-riders',
                label: 'Riders (únicos)',
                value: String(statistics.unique_riders),
                icon: Users,
                iconClassName: 'text-purple-500',
              },
              {
                key: 'attempts',
                label: 'Intentos (total)',
                value: String(statistics.total_attempts),
                icon: ListOrdered,
                iconClassName: 'text-cyan-500',
              },
              {
                key: 'avg-time',
                label: 'Tiempo promedio',
                value: statistics.avg_time != null ? formatTime(statistics.avg_time) : '—',
                valueClassName: 'text-lg font-bold text-white font-mono',
              },
              {
                key: 'avg-score',
                label: 'Score promedio',
                value: statistics.avg_score != null ? statistics.avg_score.toFixed(0) : '—',
              },
              {
                key: 'max-speed',
                label: 'Vel. máx. registrada',
                value:
                  statistics.max_recorded_speed != null
                    ? formatAggregatedMaxRecordedSpeedMps(statistics.max_recorded_speed)
                    : '—',
                valueClassName: 'text-lg font-bold text-emerald-400',
              },
              {
                key: 'avg-jumps',
                label: 'Saltos ∅',
                value: statistics.avg_jumps != null ? statistics.avg_jumps.toFixed(1) : '—',
              },
              {
                key: 'avg-stops',
                label: 'Paradas ∅',
                value: statistics.avg_stops != null ? statistics.avg_stops.toFixed(1) : '—',
              },
            ] satisfies RouteMetricCard[]
          : []),
      ]
    : []

  if (loading) {
    return (
      <div className="min-h-screen bg-gdh-page flex items-center justify-center">
        <BrandLogoLoader label="Cargando ruta..." compact showRing />
      </div>
    )
  }

  if (error || !route) {
    return (
      <div className="min-h-screen bg-gdh-page flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto text-red-500 mb-4" size={40} />
          <p className="text-gray-400 mb-4">{error || 'Ruta no encontrada'}</p>
          <button
            onClick={goBack}
            className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-lg"
          >
            Volver
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gdh-page text-slate-100">
      <DashboardAppTopBar
        contentMaxWidth="7xl"
        leading={
          <button
            type="button"
            onClick={goBack}
            className={cn(DASHBOARD_APP_TOP_BAR_ICON_BUTTON_CLASS)}
            aria-label="Volver"
          >
            <ArrowLeft size={22} aria-hidden />
          </button>
        }
        center={
          <DashboardAppTopBarHeading
            titleVariant="compact"
            title={route.name}
            subtitle={
              <span className="line-clamp-2 text-slate-400">
                {route.description?.trim() ? route.description : 'Sin descripción'}
              </span>
            }
          />
        }
        trailing={
          <div className="flex min-w-0 max-w-[min(100%,18rem)] items-center justify-end gap-1.5 sm:max-w-none">
            <DashboardCoachHeaderSlot />
            {canModerate ? (
              <button
                type="button"
                onClick={() => setEditPanelOpen((open) => !open)}
                aria-label={editPanelOpen ? 'Cerrar edición de ruta' : 'Editar ruta'}
                className={cn(
                  DASHBOARD_APP_TOP_BAR_ICON_BUTTON_CLASS,
                  'shrink-0 border border-white/15 bg-white/5 hover:bg-white/10',
                )}
              >
                <Pencil size={18} aria-hidden className="text-slate-200" />
              </button>
            ) : null}
          </div>
        }
      />
      {route.preview_media_url && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <div className="relative w-full h-48 md:h-64 rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
            {routePreviewIsVideo(route.preview_media_url) ? (
              <video
                src={route.preview_media_url}
                className="w-full h-full object-cover"
                muted
                loop
                playsInline
                autoPlay
                preload="metadata"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={route.preview_media_url}
                alt=""
                className="w-full h-full object-cover"
              />
            )}
            {canModerate && (
              <div className="absolute right-2 top-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleRemovePreviewMedia()}
                  disabled={removePreviewBusy}
                  className="rounded-lg border border-red-500/40 bg-black/70 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-950/80 disabled:opacity-50"
                >
                  {removePreviewBusy ? (
                    <Loader2 className="inline h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    'Quitar vista previa'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto space-y-6 p-4 pb-24">
        {canModerate && editPanelOpen && (
          <section className="space-y-4 rounded-2xl border border-teal-500/25 bg-gdh-card p-4">
            <div>
              <h2 className="text-lg font-bold text-white">Gestión de la ruta</h2>
              <p className="mt-1 text-xs text-slate-500">
                Puedes cambiar nombre y descripción, quitar la vista previa, borrar fotos o vídeos de la galería de
                intentos (icono papelera en la galería) y eliminar la ruta por completo. El trazado publicado y los
                datos generados por la app no se editan desde aquí.
              </p>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-400" htmlFor="route-edit-name">
                Nombre
              </label>
              <input
                id="route-edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-gdh-canvas-2 px-3 py-2.5 text-white outline-none focus:border-teal-500/50"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-400" htmlFor="route-edit-desc">
                Descripción
              </label>
              <textarea
                id="route-edit-desc"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={4}
                className="w-full resize-y rounded-xl border border-white/10 bg-gdh-canvas-2 px-3 py-2.5 text-white outline-none focus:border-teal-500/50"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleSaveRouteMeta()}
                disabled={saveMetaBusy}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
              >
                {saveMetaBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                Guardar nombre y descripción
              </button>
              <button
                type="button"
                onClick={() => setDeleteRouteModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-2.5 text-sm font-semibold text-red-200 hover:bg-red-950/50"
              >
                <Trash2 size={16} aria-hidden />
                Eliminar ruta…
              </button>
            </div>
          </section>
        )}
        {domainRoute && domainRoute.trackPoints.length >= 2 && (
          <section className="space-y-2">
            <div>
              <h2 className="text-lg font-bold text-white">Trazado de la ruta (plantilla publicada)</h2>
              <p className="text-xs text-slate-500">
                Polilínea de la ficha. Tus bajadas con GPS, tiempos y análisis por tramo están en tu perfil.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-700/80 bg-slate-900/40 p-4">
              <SelectedRoutePreviewMap route={domainRoute} />
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-white/10 bg-gdh-card p-3">
          <button
            type="button"
            onClick={() => setDetailsOpen((o) => !o)}
            className="w-full flex items-center justify-between gap-3 text-left"
            aria-expanded={detailsOpen}
          >
            <div>
              <h2 className="text-2xl font-semibold text-white leading-tight">Detalle de la ruta</h2>
              <p className="text-xs text-slate-500 mt-1">
                Datos de pista y comunidad. Toca para {detailsOpen ? 'ocultar' : 'ver'} métricas.
              </p>
            </div>
            <span className="h-9 w-9 rounded-lg border border-white/15 bg-white/5 flex items-center justify-center text-slate-300 shrink-0">
              {detailsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </span>
          </button>

          {detailsOpen && (
            <div className="mt-3 space-y-3">
              <p className="text-xs text-slate-500">
                Datos de la pista y, si existen, cifras de la comunidad.{' '}
                <Link href="/dashboard/profile" className="text-teal-400 hover:text-teal-300 underline">
                  Tus intentos y análisis de bajada: perfil
                </Link>
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {metricCards.map((card) => {
                  const Icon = card.icon
                  return (
                    <div key={card.key} className="p-4 bg-slate-800/50 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        {Icon ? <Icon className={card.iconClassName ?? 'text-slate-400'} size={18} /> : null}
                        <span className="text-xs text-gray-400">{card.label}</span>
                      </div>
                      <p className={card.valueClassName ?? 'text-lg font-bold text-white'}>
                        {card.value}
                      </p>
                      {card.footer ? (
                        <p className="text-[10px] text-slate-500 mt-1 leading-snug">{card.footer}</p>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </section>

        <RouteOverviewShowcaseSection
          routeId={route.id}
          routeName={route.name}
          routeTrackPoints={domainRoute?.trackPoints ?? []}
          replayReturnFrom={fromParam}
          canManageGallery={canModerate}
          renderBeforeGallery={
            <>
              <RouteMyRankPanel routeId={route.id} replayReturnFrom={fromParam} />
              <button
                type="button"
                onClick={() =>
                  routeId &&
                  router.push(`/dashboard/routes/route-ranking?id=${encodeURIComponent(routeId)}`)
                }
                className="w-full py-4 bg-gdh-card hover:bg-white/5 border border-white/10 text-white font-semibold rounded-2xl transition-colors flex items-center justify-center gap-2"
              >
                <Trophy size={20} className="text-amber-500" />
                Ver ranking completo
              </button>
            </>
          }
        />
      </main>

      {deleteRouteModalOpen && (
        <div
          className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-route-title"
        >
          <div className="max-w-md rounded-2xl border border-white/10 bg-gdh-card p-5 shadow-xl">
            <h2 id="delete-route-title" className="text-lg font-bold text-white">
              ¿Eliminar esta ruta?
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Se borrarán de forma permanente el trazado publicado, todos los puntos, intentos, ranking, fotos y vídeos
              de intentos, comentarios y datos ligados a esta ruta. Los archivos en almacenamiento se eliminan en la
              medida de lo posible. Esta acción no se puede deshacer.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteRouteModalOpen(false)}
                disabled={deleteRouteBusy}
                className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/5 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDeleteRoute()}
                disabled={deleteRouteBusy}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
              >
                {deleteRouteBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default function RouteDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gdh-page flex items-center justify-center">
          <BrandLogoLoader label="Cargando ruta..." compact showRing />
        </div>
      }
    >
      <RouteDashboardContent />
    </Suspense>
  )
}
