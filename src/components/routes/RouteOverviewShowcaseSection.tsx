'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { animate } from 'animejs'
import { createClient } from '@/core/infrastructure/supabase/client'
import { useRouter } from 'next/navigation'
import { DASHBOARD_BOTTOM_NAV_Z_INDEX } from '@/app/dashboard/components/DashboardBottomNav'
import { Play, Image as ImageIcon, Maximize2, X, ChevronRight, Trash2, Film } from 'lucide-react'
import { BrandSpinner } from '@/components/ui/BrandLogoLoader'
import { routePreviewIsVideo } from '@/lib/routePreviewMedia'
import { objectPathFromSupabasePublicUrl } from '@/lib/supabasePublicStoragePath'
import { toast } from '@/lib/toast'
import { RouteTraceThumbnail } from '@/components/routes/RouteTraceThumbnail'
import type { RouteTrackPoint } from '@/core/domain/Route'
import type { RouteViewFrom } from '@/lib/routeViewNavigation'

type RankingPreviewRow = {
  attemptId: string
  rank: number
  userId: string
  userName: string
  avatarUrl: string | null
  totalTime: number
}

type GalleryItem = {
  id: string
  attemptId: string
  url: string
  kind: 'photo' | 'video'
  key: string
}

/** Por encima del nav y del CTA en portal (evita quedar recortado por overflow/transform del layout). */
const GALLERY_MAXIMIZE_Z = DASHBOARD_BOTTOM_NAV_Z_INDEX + 80
const GALLERY_MEDIA_VIEWER_Z = DASHBOARD_BOTTOM_NAV_Z_INDEX + 90
const GALLERY_DELETE_CONFIRM_Z = DASHBOARD_BOTTOM_NAV_Z_INDEX + 120

function collageSpanClass(index: number): string {
  if (index === 0) return 'col-span-2 row-span-2'
  if (index === 1) return 'col-span-2 row-span-1'
  if (index === 2) return 'col-span-1 row-span-1'
  return 'col-span-1 row-span-1'
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function RiderThumb({ name, url }: { name: string; url: string | null }) {
  const initial = (name?.trim()?.[0] || '?').toUpperCase()
  if (url?.trim()) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url.trim()}
        alt=""
        width={28}
        height={28}
        className="h-7 w-7 rounded-full object-cover border border-white/15 bg-slate-700 shrink-0"
      />
    )
  }
  return (
    <div className="h-7 w-7 rounded-full bg-slate-600 border border-white/15 text-[11px] font-bold flex items-center justify-center shrink-0">
      {initial}
    </div>
  )
}

export function RouteOverviewShowcaseSection({
  routeId,
  routeName,
  routeTrackPoints = [],
  /** Origen de la ficha de ruta (`?from=`) para volver correctamente desde el replay del ranking semanal. */
  replayReturnFrom = null,
  /** Contenido entre el ranking semanal y la galería extendida + tarjeta «Galería de la ruta» (al final). */
  renderBeforeGallery = null,
  /** Dueño de la ruta o admin de plataforma: puede quitar fotos/vídeos de la galería (tabla + storage). */
  canManageGallery = false,
}: {
  routeId: string
  routeName: string
  routeTrackPoints?: RouteTrackPoint[]
  replayReturnFrom?: RouteViewFrom | null
  renderBeforeGallery?: ReactNode
  canManageGallery?: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [rankingRows, setRankingRows] = useState<RankingPreviewRow[]>([])
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([])
  const [deletingMediaId, setDeletingMediaId] = useState<string | null>(null)
  /** Solo collage ampliado (botón maximizar). */
  const [collageMaximizeOpen, setCollageMaximizeOpen] = useState(false)
  /** Un solo foto o vídeo a pantalla completa (clic en celda del collage). */
  const [mediaViewer, setMediaViewer] = useState<{
    kind: 'photo' | 'video'
    url: string
    attemptId: string | null
  } | null>(null)
  /** Intentos de esta ruta que son del usuario actual (puede generar reel en galería). */
  const [myAttemptIdsOnRoute, setMyAttemptIdsOnRoute] = useState<Set<string>>(() => new Set())
  const [reelBusyAttemptId, setReelBusyAttemptId] = useState<string | null>(null)
  const [galleryDeleteConfirm, setGalleryDeleteConfirm] = useState<GalleryItem | null>(null)
  /** Plan recién generado desde la galería (evita recargar toda la página). */
  const collageRef = useRef<HTMLDivElement | null>(null)
  const mediaViewerVideoRef = useRef<HTMLVideoElement | null>(null)
  const [portalReady, setPortalReady] = useState(false)
  useEffect(() => {
    setPortalReady(true)
  }, [])

  useEffect(() => {
    let cancelled = false
    const week = (() => {
      const now = new Date()
      const day = now.getDay()
      const diffToMonday = (day + 6) % 7
      const start = new Date(now)
      start.setDate(now.getDate() - diffToMonday)
      start.setHours(0, 0, 0, 0)
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      end.setHours(23, 59, 59, 999)
      return { startIso: start.toISOString(), endIso: end.toISOString() }
    })()

    const thirtyDaysStartIso = (() => {
      const d = new Date()
      d.setDate(d.getDate() - 30)
      d.setHours(0, 0, 0, 0)
      return d.toISOString()
    })()

    const run = async () => {
      setLoading(true)
      try {
        const supabase = createClient()

        const { data: attempts } = await supabase
          .from('route_attempts')
          .select('id, user_id, total_time')
          .eq('route_id', routeId)
          .eq('is_public', true)
          .gte('completed_at', week.startIso)
          .lte('completed_at', week.endIso)
          .order('total_time', { ascending: true })
          .limit(6)

        const userIds = [...new Set((attempts || []).map((a) => String(a.user_id)))]
        const { data: profiles } = userIds.length
          ? await supabase.from('profiles').select('id, full_name, avatar_url').in('id', userIds)
          : { data: [] as Array<{ id: string; full_name: string | null; avatar_url: string | null }> }
        const profileMap = new Map<string, { name: string; avatar: string | null }>()
        for (const p of profiles || []) {
          profileMap.set(String(p.id), {
            name: p.full_name?.trim() || 'Rider',
            avatar: p.avatar_url ?? null,
          })
        }

        const ranking = (attempts || []).map((a, idx) => {
          const uid = String(a.user_id)
          const prof = profileMap.get(uid)
          return {
            attemptId: String(a.id),
            rank: idx + 1,
            userId: uid,
            userName: prof?.name || 'Rider',
            avatarUrl: prof?.avatar || null,
            totalTime: Number(a.total_time),
          }
        })

        // Galería: todos los intentos públicos de los últimos 30 días (fotos/vídeos de cualquier rider).
        const { data: attempts30 } = await supabase
          .from('route_attempts')
          .select('id')
          .eq('route_id', routeId)
          .eq('is_public', true)
          .gte('completed_at', thirtyDaysStartIso)
          .order('completed_at', { ascending: false })
          .limit(500)

        const attemptIds30 = (attempts30 || []).map((a) => String(a.id))
        const mediaRows: Array<{ id: string; attempt_id: string; public_url: string; kind: string }> = []
        const chunkSize = 80
        for (let i = 0; i < attemptIds30.length; i += chunkSize) {
          const chunk = attemptIds30.slice(i, i + chunkSize)
          if (chunk.length === 0) break
          const { data: medChunk } = await supabase
            .from('route_attempt_media')
            .select('id, attempt_id, public_url, kind')
            .in('attempt_id', chunk)
            .order('sort_order', { ascending: true })
            .limit(2000)
          if (medChunk?.length)
            mediaRows.push(
              ...(medChunk as Array<{ id: string; attempt_id: string; public_url: string; kind: string }>)
            )
        }

        const seen = new Set<string>()
        const gallery: GalleryItem[] = []
        for (const m of mediaRows) {
          const url = String(m.public_url)
          if (seen.has(url)) continue
          seen.add(url)
          gallery.push({
            id: String(m.id),
            attemptId: String(m.attempt_id),
            url,
            kind: m.kind === 'video' ? 'video' : 'photo',
            key: `media:${m.id}`,
          })
        }

        const {
          data: { user: authUser },
        } = await supabase.auth.getUser()
        const attemptIdsInGallery = [...new Set(gallery.map((g) => g.attemptId))]
        let myOnRoute = new Set<string>()
        if (authUser?.id && attemptIdsInGallery.length) {
          const { data: mine } = await supabase
            .from('route_attempts')
            .select('id')
            .eq('route_id', routeId)
            .eq('user_id', authUser.id)
            .in('id', attemptIdsInGallery)
          myOnRoute = new Set((mine || []).map((r) => String(r.id)))
        }

        if (!cancelled) {
          setRankingRows(ranking)
          setGalleryItems(gallery)
          setMyAttemptIdsOnRoute(myOnRoute)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [routeId])

  const collageItems = useMemo(() => galleryItems.slice(0, 6), [galleryItems])
  const galleryScrollItems = useMemo(() => galleryItems.slice(6), [galleryItems])
  const openAttemptDetail = (attemptId: string) => {
    const q = new URLSearchParams()
    q.set('attemptId', attemptId)
    q.set('routeId', routeId)
    q.set('from', 'route-view')
    if (replayReturnFrom) q.set('parentFrom', replayReturnFrom)
    router.push(`/dashboard/routes/attempt-replay?${q.toString()}`)
  }

  useEffect(() => {
    if (collageItems.length === 0) return
    const wrap = collageRef.current
    if (!wrap) return
    const nodes = wrap.querySelectorAll<HTMLElement>('[data-collage-item]')
    if (!nodes.length) return
    void animate(nodes, {
      opacity: [0, 1],
      scale: [0.96, 1],
      duration: 380,
      delay: (_, i) => i * 70,
      ease: 'outCubic',
    })
  }, [collageItems.length])

  useEffect(() => {
    if (!collageMaximizeOpen && !mediaViewer && !galleryDeleteConfirm) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (galleryDeleteConfirm) {
        setGalleryDeleteConfirm(null)
        return
      }
      if (mediaViewer) setMediaViewer(null)
      else setCollageMaximizeOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [collageMaximizeOpen, mediaViewer, galleryDeleteConfirm])

  const openMediaFromCollage = useCallback((item: GalleryItem) => {
    const isVid = item.kind === 'video' || routePreviewIsVideo(item.url)
    setMediaViewer({ kind: isVid ? 'video' : 'photo', url: item.url, attemptId: item.attemptId })
  }, [])

  const generateReelForAttempt = useCallback(
    async (
      attemptId: string,
      videoEl: HTMLVideoElement | null,
      opts?: { musicUrl?: string | null; musicAttribution?: string | null }
    ) => {
    setReelBusyAttemptId(attemptId)
    try {
      let videoDurationSec: number | undefined
      if (videoEl && Number.isFinite(videoEl.duration) && videoEl.duration > 0) {
        videoDurationSec = videoEl.duration
      }
      const body: Record<string, unknown> = {}
      if (typeof videoDurationSec === 'number') body.videoDurationSec = videoDurationSec
      if (opts && 'musicUrl' in opts) {
        body.musicUrl = opts.musicUrl
        if (opts.musicAttribution != null) body.musicAttribution = opts.musicAttribution
      }
      const res = await fetch(`/api/dashboard/attempts/${encodeURIComponent(attemptId)}/reel-plan`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string; plan?: unknown }
      if (!res.ok) throw new Error(json.error || res.statusText)
      toast.success('Plan de reel listo', 'Abrí «Tus bajadas» en la ruta para previsualizarlo y ajustar música si usás IA.')
    } catch (err) {
      toast.error(
        'No se pudo generar el reel',
        err instanceof Error ? err.message : 'Reintentá o usá la sección «Tus bajadas».'
      )
    } finally {
      setReelBusyAttemptId(null)
    }
  }, [])

  const closeCollageMaximize = useCallback(() => setCollageMaximizeOpen(false), [])

  const requestDeleteGalleryItem = useCallback(
    (item: GalleryItem, e?: MouseEvent) => {
      e?.preventDefault()
      e?.stopPropagation()
      if (!canManageGallery) return
      setGalleryDeleteConfirm(item)
    },
    [canManageGallery]
  )

  const executeGalleryDelete = useCallback(async () => {
    const item = galleryDeleteConfirm
    if (!item || !canManageGallery) return
    setGalleryDeleteConfirm(null)
    setDeletingMediaId(item.id)
    try {
      const supabase = createClient()
      const path = objectPathFromSupabasePublicUrl(item.url, 'attempt-media')
      if (path) {
        const { error: se } = await supabase.storage.from('attempt-media').remove([path])
        if (se) console.warn('[gallery] storage remove', se.message)
      }
      const { error } = await supabase.from('route_attempt_media').delete().eq('id', item.id)
      if (error) throw error
      setGalleryItems((prev) => prev.filter((g) => g.id !== item.id))
      setMediaViewer((v) => (v?.url === item.url ? null : v))
      toast.success('Medio eliminado', 'La galería se ha actualizado.')
    } catch (err) {
      toast.error(
        'No se pudo eliminar',
        err instanceof Error ? err.message : 'Comprueba permisos o conexión.'
      )
    } finally {
      setDeletingMediaId(null)
    }
  }, [galleryDeleteConfirm, canManageGallery])

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-slate-900/45 p-5 flex items-center justify-center">
          <BrandSpinner size={24} />
        </div>
      ) : (
        <section className="rounded-2xl border border-white/10 bg-gdh-card p-3">
          <h3 className="text-2xl font-semibold text-white leading-tight">Ranking Semanal</h3>
          <p className="text-3xl font-bold text-white/90 leading-tight">{routeName}</p>
          <div className="mt-2 space-y-1.5">
            {rankingRows.map((row) => (
              <div
                key={row.attemptId}
                className={`rounded-xl border px-2.5 py-2 flex items-center gap-2 w-full ${
                  row.rank === 1
                    ? 'border-sky-400/70 bg-violet-500/15'
                    : 'border-white/10 bg-slate-700/50'
                }`}
              >
                <span className="w-8 shrink-0 text-xl font-black text-white/85">#{row.rank}</span>
                <RiderThumb name={row.userName} url={row.avatarUrl} />
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-sm text-white truncate">{row.userName}</p>
                  <p className="text-xs text-slate-300 font-mono">{formatTime(row.totalTime)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => openAttemptDetail(row.attemptId)}
                  className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-black/25 text-teal-300 hover:bg-white/10 hover:text-white transition"
                  aria-label={`Ver detalle del recorrido de ${row.userName}`}
                >
                  <ChevronRight size={18} className="opacity-90" aria-hidden />
                </button>
              </div>
            ))}
            {rankingRows.length === 0 && (
              <p className="text-xs text-slate-500 py-2">Aún sin tiempos esta semana.</p>
            )}
          </div>
        </section>
      )}

      {renderBeforeGallery}

      {!loading && (
        <section className="rounded-2xl border border-white/10 bg-gdh-card p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-2xl font-semibold text-white leading-tight">Galería de la ruta</h3>
              <p className="text-xs text-slate-500 mt-1 leading-snug">
                Fotos y vídeos de intentos públicos en los últimos 30 días.{' '}
                <span className="text-slate-600">
                  En <strong className="text-slate-500">tus</strong> vídeos aparece el botón violeta «Reel»; también
                  podés generarlo desde «Tus bajadas» más abajo.
                </span>
              </p>
            </div>
            {galleryItems.length > 0 && (
              <button
                type="button"
                onClick={() => setCollageMaximizeOpen(true)}
                className="shrink-0 h-8 w-8 rounded-lg border border-white/15 bg-white/5 flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10"
                aria-label="Maximizar collage"
              >
                <Maximize2 size={14} />
              </button>
            )}
          </div>
          <div className="mt-2 space-y-2">
            {collageItems.length > 0 ? (
              <div
                ref={collageRef}
                className="h-[180px] rounded-xl border border-white/10 bg-[#0f1520] p-2 grid grid-cols-4 grid-rows-2 gap-2"
              >
                {collageItems.map((item, index) => {
                  const spanClass = collageSpanClass(index)
                  const isVid = item.kind === 'video' || routePreviewIsVideo(item.url)
                  const busy = deletingMediaId === item.id
                  return (
                    <div
                      data-collage-item
                      key={item.key}
                      className={`relative overflow-hidden rounded-lg border border-white/10 bg-slate-900 ${spanClass}`}
                    >
                      <button
                        type="button"
                        onClick={() => openMediaFromCollage(item)}
                        disabled={busy}
                        className="absolute inset-0 z-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/80 disabled:opacity-50"
                      >
                        {isVid ? (
                          <video src={item.url} className="h-full w-full object-cover pointer-events-none" muted playsInline preload="metadata" />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.url} alt="" className="h-full w-full object-cover pointer-events-none" />
                        )}
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none">
                          {isVid ? (
                            <span className="h-8 w-8 rounded-full border border-white/80 bg-black/35 flex items-center justify-center text-white">
                              <Play size={14} className="ml-0.5" />
                            </span>
                          ) : (
                            <span className="h-7 w-7 rounded-full border border-white/80 bg-black/35 flex items-center justify-center text-white">
                              <ImageIcon size={12} />
                            </span>
                          )}
                        </div>
                      </button>
                      {canManageGallery && (
                        <button
                          type="button"
                          onClick={(ev) => requestDeleteGalleryItem(item, ev)}
                          disabled={busy}
                          className="absolute right-1 top-1 z-20 flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/40 bg-black/70 text-red-300 hover:bg-red-950/80 hover:text-white disabled:opacity-40"
                          aria-label="Eliminar de la galería"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      {isVid && myAttemptIdsOnRoute.has(item.attemptId) && (
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.preventDefault()
                            ev.stopPropagation()
                            void generateReelForAttempt(item.attemptId, null)
                          }}
                          disabled={reelBusyAttemptId === item.attemptId}
                          className="absolute bottom-1.5 left-1.5 z-30 inline-flex items-center gap-1 rounded-md border border-violet-400/55 bg-black/80 px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-violet-100 hover:bg-violet-950/95 disabled:opacity-45"
                        >
                          {reelBusyAttemptId === item.attemptId ? (
                            <BrandSpinner size={10} className="shrink-0" />
                          ) : (
                            <Film size={10} className="shrink-0" aria-hidden />
                          )}
                          Reel
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="h-[180px] rounded-lg border border-white/10 bg-[#0f1520] p-2 relative overflow-hidden">
                <RouteTraceThumbnail trackPoints={routeTrackPoints} />
                <p className="text-[10px] text-slate-500 mt-1 absolute left-2 bottom-1 bg-[#0f1520]/70 px-1 rounded">
                  Sin media todavía · mostrando trazado de la ruta
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {portalReady &&
        typeof document !== 'undefined' &&
        (collageMaximizeOpen || mediaViewer) &&
        createPortal(
          <>
            {collageMaximizeOpen && (
        <div
          className="fixed inset-0 flex flex-col bg-[#0b0f14]"
          style={{ zIndex: GALLERY_MAXIMIZE_Z }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="route-collage-max-title"
        >
          <div className="shrink-0 flex items-center justify-between gap-3 border-b border-white/10 bg-[#121826] px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <h3 id="route-collage-max-title" className="text-lg font-semibold text-white truncate pr-2">
              Galería de la ruta
            </h3>
            <button
              type="button"
              onClick={closeCollageMaximize}
              className="shrink-0 h-10 w-10 rounded-xl border border-white/15 bg-white/5 flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10"
              aria-label="Cerrar galería"
            >
              <X size={18} />
            </button>
          </div>

          {/* Pantalla completa: la barra de scroll solo aparece dentro del recuadro (collage + más medios). */}
          <div className="min-h-0 flex-1 flex flex-col px-3 sm:px-4 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto w-full max-w-3xl min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain rounded-2xl border border-white/10 bg-[#121826] p-3 sm:p-4 shadow-inner">
              <div className="h-[180px] sm:h-[200px] shrink-0 rounded-xl border border-white/10 bg-[#0f1520] p-2 grid grid-cols-4 grid-rows-2 gap-2">
                {collageItems.map((item, index) => {
                  const spanClass = collageSpanClass(index)
                  const isVid = item.kind === 'video' || routePreviewIsVideo(item.url)
                  const busy = deletingMediaId === item.id
                  return (
                    <div key={`max-collage-${item.key}`} className={`relative overflow-hidden rounded-lg border border-white/10 bg-slate-900 ${spanClass}`}>
                      <button
                        type="button"
                        onClick={() => openMediaFromCollage(item)}
                        disabled={busy}
                        className="absolute inset-0 z-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/80 disabled:opacity-50"
                      >
                        {isVid ? (
                          <video
                            src={item.url}
                            className="h-full w-full object-cover pointer-events-none"
                            muted
                            playsInline
                            preload="metadata"
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.url} alt="" className="h-full w-full object-cover pointer-events-none" />
                        )}
                        <div className="absolute inset-0 bg-black/15 flex items-center justify-center pointer-events-none">
                          {isVid ? (
                            <span className="h-8 w-8 rounded-full border border-white/80 bg-black/35 flex items-center justify-center text-white">
                              <Play size={14} className="ml-0.5" />
                            </span>
                          ) : (
                            <span className="h-7 w-7 rounded-full border border-white/80 bg-black/35 flex items-center justify-center text-white">
                              <ImageIcon size={12} />
                            </span>
                          )}
                        </div>
                      </button>
                      {canManageGallery && (
                        <button
                          type="button"
                          onClick={(ev) => requestDeleteGalleryItem(item, ev)}
                          disabled={busy}
                          className="absolute right-1 top-1 z-20 flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/40 bg-black/70 text-red-300 hover:bg-red-950/80 hover:text-white disabled:opacity-40"
                          aria-label="Eliminar de la galería"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      {isVid && myAttemptIdsOnRoute.has(item.attemptId) && (
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.preventDefault()
                            ev.stopPropagation()
                            void generateReelForAttempt(item.attemptId, null)
                          }}
                          disabled={reelBusyAttemptId === item.attemptId}
                          className="absolute bottom-1.5 left-1.5 z-30 inline-flex items-center gap-1 rounded-md border border-violet-400/55 bg-black/80 px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-violet-100 hover:bg-violet-950/95 disabled:opacity-45"
                        >
                          {reelBusyAttemptId === item.attemptId ? (
                            <BrandSpinner size={10} className="shrink-0" />
                          ) : (
                            <Film size={10} className="shrink-0" aria-hidden />
                          )}
                          Reel
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              {galleryScrollItems.length > 0 ? (
                <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
                  <div className="space-y-4">
                    {galleryScrollItems.map((item) => {
                      const isVid = item.kind === 'video' || routePreviewIsVideo(item.url)
                      const busy = deletingMediaId === item.id
                      return (
                        <div
                          key={`scroll-${item.key}`}
                          className="relative rounded-xl border border-white/10 bg-[#0f1520] overflow-hidden"
                        >
                          {isVid ? (
                            <video
                              src={item.url}
                              controls
                              playsInline
                              preload="metadata"
                              className="w-full max-h-[min(50vh,400px)] bg-black object-contain"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => openMediaFromCollage(item)}
                              disabled={busy}
                              className="block w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/80 disabled:opacity-50"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={item.url}
                                alt=""
                                className="w-full max-h-[min(50vh,400px)] object-contain bg-black"
                              />
                            </button>
                          )}
                          {canManageGallery && (
                            <button
                              type="button"
                              onClick={(ev) => requestDeleteGalleryItem(item, ev)}
                              disabled={busy}
                              className="absolute right-2 top-2 z-20 flex h-9 w-9 items-center justify-center rounded-lg border border-red-500/40 bg-black/75 text-red-300 hover:bg-red-950/80 hover:text-white disabled:opacity-40"
                              aria-label="Eliminar de la galería"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                          {isVid && myAttemptIdsOnRoute.has(item.attemptId) && (
                            <div className="flex items-center justify-end border-t border-white/10 bg-[#121826] px-3 py-2">
                              <button
                                type="button"
                                onClick={() => void generateReelForAttempt(item.attemptId, null)}
                                disabled={reelBusyAttemptId === item.attemptId}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-400/50 bg-violet-600/25 px-3 py-1.5 text-[11px] font-semibold text-violet-100 hover:bg-violet-600/40 disabled:opacity-45"
                              >
                                {reelBusyAttemptId === item.attemptId ? (
                                  <BrandSpinner size={12} className="shrink-0" />
                                ) : (
                                  <Film size={12} className="shrink-0" aria-hidden />
                                )}
                                Generar plan de reel
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
            )}

            {mediaViewer && (
        <div
          className="fixed inset-0 relative flex flex-col bg-black"
          style={{ zIndex: GALLERY_MEDIA_VIEWER_Z }}
          role="dialog"
          aria-modal="true"
          aria-label={mediaViewer.kind === 'video' ? 'Reproducir vídeo' : 'Ver foto'}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setMediaViewer(null)
          }}
        >
          {canManageGallery &&
            (() => {
              const item = galleryItems.find((g) => g.url === mediaViewer.url)
              if (!item) return null
              return (
                <button
                  type="button"
                  onClick={() => requestDeleteGalleryItem(item)}
                  disabled={deletingMediaId === item.id}
                  className="absolute left-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 flex h-11 items-center gap-2 rounded-xl border border-red-500/45 bg-black/70 px-3 text-sm font-semibold text-red-100 shadow-lg backdrop-blur-sm hover:bg-red-950/80 disabled:opacity-40 sm:left-4"
                >
                  <Trash2 size={18} />
                  Eliminar
                </button>
              )
            })()}
          <button
            type="button"
            onClick={() => setMediaViewer(null)}
            className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 flex h-11 w-11 items-center justify-center rounded-xl border border-white/25 bg-black/70 text-white shadow-lg backdrop-blur-sm hover:bg-white/15 sm:right-4"
            aria-label="Cerrar"
          >
            <X size={22} />
          </button>
          <div className="flex min-h-0 flex-1 items-center justify-center px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(3.5rem,env(safe-area-inset-top))]">
            {mediaViewer.kind === 'video' ? (
              <video
                ref={mediaViewerVideoRef}
                key={mediaViewer.url}
                src={mediaViewer.url}
                controls
                playsInline
                preload="metadata"
                muted={false}
                className="max-h-full max-w-full rounded-lg bg-black object-contain"
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget
                  v.muted = false
                  if (v.volume === 0) v.volume = 1
                }}
                onPlay={(e) => {
                  e.currentTarget.muted = false
                }}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaViewer.url}
                alt=""
                className="max-h-[min(85vh,calc(100vh-5rem))] max-w-full object-contain rounded-lg shadow-2xl"
              />
            )}
          </div>
        </div>
            )}
          </>,
          document.body
        )}

      {portalReady &&
        galleryDeleteConfirm &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 flex items-center justify-center bg-black/75 px-4"
            style={{ zIndex: GALLERY_DELETE_CONFIRM_Z }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="gallery-delete-title"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setGalleryDeleteConfirm(null)
            }}
          >
            <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-gdh-card p-5 shadow-2xl shadow-black/60">
              <h3 id="gallery-delete-title" className="text-lg font-semibold text-white">
                ¿Eliminar este medio?
              </h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Se borrará de la galería, del intento y del almacenamiento. Esta acción no se puede deshacer.
              </p>
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setGalleryDeleteConfirm(null)}
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/10"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void executeGalleryDelete()}
                  className="rounded-xl border border-red-500/50 bg-red-600/90 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
