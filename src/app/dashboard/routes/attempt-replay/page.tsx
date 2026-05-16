'use client'

import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/core/infrastructure/supabase/client'
import { ExternalLink, MapPin, BarChart3, Upload, Video, ImageIcon } from 'lucide-react'
import { RouteFlowStickyHeader } from '@/components/routes/RouteFlowStickyHeader'
import { BrandLogoLoader } from '@/components/ui/BrandLogoLoader'
import { MobileMain, MobileScreen, mobileStyles } from '@/components/ui/mobile-primitives'
import { routePreviewIsVideo } from '@/lib/routePreviewMedia'
import { parseReplayGpsPoints, type ReplayGpsPoint } from '@/lib/attemptReplayGps'
import { AttemptReplayViewerLoading } from '@/components/routes/AttemptReplayViewerLoading'
import { formatSpeedKmhFromStoredMps } from '@/lib/attemptSpeedDisplay'
import { gpsStartEndFromAttemptJson } from '@/lib/rankingGps'
import { normalizeRouteViewFrom, routeViewUrl } from '@/lib/routeViewNavigation'
import { optimizeMediaBeforeUpload } from '@/lib/mediaUploadOptimizer'
import { toast } from '@/lib/toast'
import { DashboardAppTopBarTrailingCluster } from '@/app/dashboard/components/DashboardAppTopBar'

const AttemptReplayViewer = dynamic(
  () =>
    import('@/components/routes/AttemptReplayViewer').then((mod) => ({
      default: mod.AttemptReplayViewer,
    })),
  { ssr: false, loading: () => <AttemptReplayViewerLoading /> }
)

function resolveAttemptVideoUrl(videoUrl: string | null, media: { public_url: string; kind: string }[]): string | null {
  if (videoUrl && routePreviewIsVideo(videoUrl)) return videoUrl
  const firstVid = media.find((m) => m.kind === 'video' || routePreviewIsVideo(m.public_url))
  return firstVid?.public_url ?? (videoUrl || null)
}

function formatSecs(n: number): string {
  const mins = Math.floor(n / 60)
  const secs = Math.floor(n % 60)
  const cs = Math.floor((n % 1) * 100)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

interface AttemptPayload {
  id: string
  route_id: string
  user_id: string
  total_time: number
  moving_time: number
  stopped_time: number
  max_speed: number
  avg_speed: number
  distance: number
  elevation_gain: number | null
  elevation_loss: number | null
  jumps_count: number | null
  sharp_movements_count: number | null
  hard_brakes_count: number | null
  stops_count: number | null
  rhythm_score: number | null
  intensity_score: number | null
  aggression_score: number | null
  overall_score: number | null
  is_public: boolean
  completed_at: string | null
  gps_points: unknown
  video_url: string | null
  video_gps_offset_ms: number | null
}

type AttemptMediaRow = {
  id: string
  public_url: string
  kind: 'photo' | 'video'
}

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'file'
}

function AttemptReplayInner() {
  const searchParams = useSearchParams()
  const attemptId = searchParams.get('attemptId')
  const routeIdParam = searchParams.get('routeId')
  const from = searchParams.get('from')
  const parentFromRaw = searchParams.get('parentFrom')
  const parentFromNormalized = useMemo(() => normalizeRouteViewFrom(parentFromRaw), [parentFromRaw])

  const [routeName, setRouteName] = useState<string | null>(null)
  const [routeDistanceKm, setRouteDistanceKm] = useState<number | null>(null)
  const [points, setPoints] = useState<ReplayGpsPoint[]>([])
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [offsetMs, setOffsetMs] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attemptRow, setAttemptRow] = useState<AttemptPayload | null>(null)
  const [riderName, setRiderName] = useState<string | null>(null)
  const [riderAvatarUrl, setRiderAvatarUrl] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [attemptMedia, setAttemptMedia] = useState<AttemptMediaRow[]>([])
  const [uploading, setUploading] = useState(false)

  const gpsExtra = useMemo(() => gpsStartEndFromAttemptJson(attemptRow?.gps_points), [attemptRow?.gps_points])

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      await Promise.resolve()
      if (cancelled) return

      if (!attemptId) {
        setLoading(false)
        setError('Falta attemptId en la URL (?attemptId=…)')
        return
      }

      setLoading(true)
      setError(null)

      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setCurrentUserId(user?.id ?? null)
      if (cancelled) return
      if (!user) {
        setLoading(false)
        setError('Inicia sesión para ver el replay.')
        return
      }

      const { data: row, error: e1 } = await supabase
        .from('route_attempts')
        .select(
          `
          id,
          route_id,
          user_id,
          total_time,
          moving_time,
          stopped_time,
          max_speed,
          avg_speed,
          distance,
          elevation_gain,
          elevation_loss,
          jumps_count,
          sharp_movements_count,
          hard_brakes_count,
          stops_count,
          rhythm_score,
          intensity_score,
          aggression_score,
          overall_score,
          is_public,
          completed_at,
          gps_points,
          video_url,
          video_gps_offset_ms
        `
        )
        .eq('id', attemptId)
        .maybeSingle()

      if (cancelled) return
      if (e1 || !row) {
        setLoading(false)
        setError(e1?.message || 'No se encontró el intento o no tienes permiso.')
        return
      }

      const ar = row as unknown as AttemptPayload
      setAttemptRow(ar)

      const [{ data: med }, profileRes] = await Promise.all([
        supabase
          .from('route_attempt_media')
          .select('id, public_url, kind')
          .eq('attempt_id', attemptId)
          .order('sort_order', { ascending: true }),
        supabase.from('profiles').select('full_name, avatar_url, map_avatar_url').eq('id', ar.user_id).maybeSingle(),
      ])

      if (cancelled) return

      let prof =
        profileRes.data as { full_name?: string | null; avatar_url?: string | null; map_avatar_url?: string | null } | null
      if (profileRes.error && !prof) {
        const retry = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', ar.user_id)
          .maybeSingle()
        if (!cancelled && !retry.error) prof = retry.data as typeof prof
      }

      const pname = (prof?.full_name as string | null)?.trim()
      setRiderName(pname || 'Rider')
      const forMap =
        (typeof prof?.map_avatar_url === 'string' && prof.map_avatar_url.trim() ? prof.map_avatar_url.trim() : null) ||
        (typeof prof?.avatar_url === 'string' && prof.avatar_url.trim() ? prof.avatar_url.trim() : null)
      setRiderAvatarUrl(forMap)

      if (process.env.NODE_ENV === 'development' && profileRes.error) {
        console.warn('[replay] profiles:', profileRes.error.message)
      }

      const vid = resolveAttemptVideoUrl((ar.video_url as string | null) ?? null, (med || []) as { public_url: string; kind: string }[])
      const parsed = parseReplayGpsPoints(ar.gps_points)
      setAttemptMedia(((med || []) as AttemptMediaRow[]).map((m) => ({
        id: String(m.id),
        public_url: String(m.public_url),
        kind: m.kind === 'video' ? 'video' : 'photo',
      })))

      setPoints(parsed)
      setVideoUrl(vid)
      setOffsetMs(Number(ar.video_gps_offset_ms) || 0)

      const rid = routeIdParam || ar.route_id
      if (rid) {
        const { data: r } = await supabase.from('routes').select('name, distance_km').eq('id', rid).maybeSingle()
        if (!cancelled) {
          setRouteName((r?.name as string) || null)
          const dkm = (r as { distance_km?: number } | null)?.distance_km
          setRouteDistanceKm(typeof dkm === 'number' && Number.isFinite(dkm) ? dkm : null)
        }
      } else if (!cancelled) {
        setRouteName(null)
        setRouteDistanceKm(null)
      }

      if (!cancelled) setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [attemptId, routeIdParam])

  const routeIdResolved = routeIdParam || attemptRow?.route_id
  const canUploadMedia = Boolean(currentUserId && attemptRow && currentUserId === attemptRow.user_id)

  const onUploadMedia = async (files: FileList | null) => {
    if (!files?.length || !attemptId || !attemptRow || !currentUserId || currentUserId !== attemptRow.user_id) return
    const supabase = createClient()
    setUploading(true)
    try {
      let optimizedCount = 0
      for (let i = 0; i < files.length; i++) {
        const file = files[i]!
        const isVid = file.type.startsWith('video/')
        const isImg = file.type.startsWith('image/')
        if (!isVid && !isImg) continue

        const optimized = await optimizeMediaBeforeUpload(file)
        if (optimized.blocked) {
          throw new Error(optimized.reason || 'No se pudo subir el archivo.')
        }
        const uploadFile = optimized.file
        if (optimized.optimized) optimizedCount += 1

        const path = `${currentUserId}/${attemptId}/${Date.now()}-${i}-${safeFileName(uploadFile.name)}`
        const { error: upErr } = await supabase.storage.from('attempt-media').upload(path, uploadFile, {
          upsert: false,
          contentType: uploadFile.type || undefined,
        })
        if (upErr) throw upErr

        const {
          data: { publicUrl },
        } = supabase.storage.from('attempt-media').getPublicUrl(path)

        const { error: insErr } = await supabase.from('route_attempt_media').insert({
          attempt_id: attemptId,
          user_id: currentUserId,
          public_url: publicUrl,
          kind: isVid ? 'video' : 'photo',
          sort_order: i,
        })
        if (insErr) throw insErr
      }

      const { data: medReload } = await supabase
        .from('route_attempt_media')
        .select('id, public_url, kind')
        .eq('attempt_id', attemptId)
        .order('sort_order', { ascending: true })
      setAttemptMedia(
        ((medReload || []) as AttemptMediaRow[]).map((m) => ({
          id: String(m.id),
          public_url: String(m.public_url),
          kind: m.kind === 'video' ? 'video' : 'photo',
        }))
      )
      toast.success(
        'Multimedia subida',
        optimizedCount > 0
          ? `${optimizedCount} archivo(s) optimizado(s) antes de subir.`
          : 'Archivos subidos correctamente.'
      )
    } catch (e) {
      toast.error('No se pudo subir la multimedia', e instanceof Error ? e.message : undefined)
    } finally {
      setUploading(false)
    }
  }

  const backHref = useMemo(() => {
    if (!routeIdResolved) return '/dashboard/routes'
    if (from === 'route-view') {
      return routeViewUrl(routeIdResolved, parentFromNormalized)
    }
    if (from === 'ranking') {
      return `/dashboard/routes/route-ranking?id=${encodeURIComponent(routeIdResolved)}`
    }
    if (from === 'activity') {
      return '/dashboard/activity'
    }
    return routeViewUrl(routeIdResolved, 'discover')
  }, [from, routeIdResolved, parentFromNormalized])

  const statsHref = useMemo(() => {
    if (!attemptId) return null
    return `/dashboard/routes/attempt-stats?attemptId=${encodeURIComponent(attemptId)}${routeIdResolved ? `&routeId=${encodeURIComponent(routeIdResolved)}` : ''}${from ? `&from=${encodeURIComponent(from)}` : ''}${parentFromNormalized ? `&parentFrom=${encodeURIComponent(parentFromNormalized)}` : ''}`
  }, [attemptId, routeIdResolved, from, parentFromNormalized])

  if (loading) {
    return (
      <MobileScreen>
        <div className="min-h-[50vh] flex items-center justify-center">
          <BrandLogoLoader label="Cargando intento..." compact showRing />
        </div>
      </MobileScreen>
    )
  }

  if (error) {
    return (
      <MobileScreen>
        <MobileMain>
          <RouteFlowStickyHeader bleedInline backHref={backHref} backLabel="Volver" />
          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        </MobileMain>
      </MobileScreen>
    )
  }

  const fmtM = (m: number | null | undefined) =>
    m != null && Number.isFinite(m) ? `${Math.round(Number(m))} m` : '—'

  const detailRows: { label: string; value: ReactNode }[] = attemptRow
    ? [
        { label: 'Rider', value: riderName || '—' },
        {
          label: 'Ruta',
          value:
            routeName && routeIdResolved && attemptId ? (
              <Link
                href={routeViewUrl(routeIdResolved, 'attempt-replay', {
                  attemptId,
                  replayFrom: from || 'ranking',
                })}
                className="text-gdh-brand-highlight hover:text-gdh-brand-highlight/85"
              >
                {routeName}
              </Link>
            ) : (
              routeName || '—'
            ),
        },
        {
          label: 'Distancia ruta (catálogo)',
          value:
            routeDistanceKm != null ? `${routeDistanceKm.toFixed(2)} km` : '—',
        },
        {
          label: 'Distancia recorrida (intento)',
          value: `${(Number(attemptRow.distance) / 1000).toFixed(2)} km`,
        },
        { label: 'Tiempo total', value: `${formatSecs(Number(attemptRow.total_time))} (${Number(attemptRow.total_time).toFixed(3)} s)` },
        {
          label: 'Tiempo en movimiento / parado',
          value: `${formatSecs(Number(attemptRow.moving_time))} / ${formatSecs(Number(attemptRow.stopped_time))}`,
        },
        {
          label: 'Vel. máxima / media',
          value: `${formatSpeedKmhFromStoredMps(Number(attemptRow.max_speed))} / ${formatSpeedKmhFromStoredMps(Number(attemptRow.avg_speed))}`,
        },
        {
          label: 'Ganancia / pérdida de elevación',
          value:
            `${fmtM(attemptRow.elevation_gain)} / ${fmtM(attemptRow.elevation_loss)}`,
        },
        {
          label: 'Saltos · giros · frenadas · paradas',
          value: `${attemptRow.jumps_count ?? '—'} · ${attemptRow.sharp_movements_count ?? '—'} · ${attemptRow.hard_brakes_count ?? '—'} · ${attemptRow.stops_count ?? '—'}`,
        },
        {
          label: 'Puntuación (ritmo / intensidad / agresividad / global)',
          value: `${attemptRow.rhythm_score ?? '—'} / ${attemptRow.intensity_score ?? '—'} / ${attemptRow.aggression_score ?? '—'} / ${attemptRow.overall_score ?? '—'}`,
        },
        {
          label: 'Inicio GPS (intento)',
          value: gpsExtra.startLabel ? (
            <a
              href={gpsExtra.mapsStartUrl || '#'}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-gdh-sun hover:text-gdh-brand-highlight font-mono text-xs break-all"
            >
              <MapPin size={12} className="shrink-0" />
              {gpsExtra.startLabel}
              <ExternalLink size={10} className="shrink-0 opacity-70" />
            </a>
          ) : (
            '—'
          ),
        },
        {
          label: 'Meta GPS (intento)',
          value: gpsExtra.endLabel ? (
            <a
              href={gpsExtra.mapsEndUrl || '#'}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-gdh-muted hover:text-slate-200 font-mono text-xs break-all"
            >
              <MapPin size={12} className="shrink-0" />
              {gpsExtra.endLabel}
              <ExternalLink size={10} className="shrink-0 opacity-70" />
            </a>
          ) : (
            '—'
          ),
        },
        {
          label: 'Fecha de finalización',
          value:
            attemptRow.completed_at != null
              ? formatDate(String(attemptRow.completed_at))
              : '—',
        },
        {
          label: 'Público en ranking',
          value: attemptRow.is_public ? 'Sí' : 'No',
        },
      ]
    : []

  const backLabel =
    from === 'ranking'
      ? 'Volver al ranking'
      : from === 'activity'
        ? 'Volver a actividad'
        : 'Volver a la ruta'

  return (
    <MobileScreen>
      <MobileMain>
        <RouteFlowStickyHeader
          bleedInline
          backHref={backHref}
          backLabel={backLabel}
          title="Detalle del recorrido"
          subtitle={routeName ? <span>{routeName}</span> : undefined}
          meta={
            <>
              Intento · {attemptId?.slice(0, 8)}…{riderName ? ` · ${riderName}` : ''}
            </>
          }
          trailing={
            <DashboardAppTopBarTrailingCluster className="gap-2">
              {statsHref ? (
                <Link
                  href={statsHref}
                  className="inline-flex items-center gap-2 rounded-lg border border-gdh-brand/40 bg-gdh-brand/12 px-3 py-1.5 text-xs font-semibold text-gdh-brand-highlight hover:bg-gdh-brand/18"
                >
                  <BarChart3 size={14} aria-hidden />
                  Ver estadísticas
                </Link>
              ) : null}
            </DashboardAppTopBarTrailingCluster>
          }
        />

        <section className="rounded-2xl border border-white/10 bg-gdh-card p-3">
          {points.length >= 2 ? (
            <AttemptReplayViewer
              key={`${attemptId}-${points[0]!.t}`}
              points={points}
              videoUrl={videoUrl}
              videoGpsOffsetMs={offsetMs}
              riderAvatarUrl={riderAvatarUrl}
              riderDisplayName={riderName}
            />
          ) : (
            <p className="text-sm text-slate-500 text-center py-8">
              Este intento no tiene suficientes puntos GPS para dibujar el recorrido.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-gdh-card p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white">Multimedia del recorrido</h2>
            {canUploadMedia ? (
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-medium text-gdh-brand-highlight cursor-pointer disabled:opacity-50">
                {uploading ? <span className="h-2.5 w-2.5 rounded-full bg-gdh-brand-highlight animate-pulse" /> : <Upload size={14} />}
                {uploading ? 'Subiendo...' : 'Subir fotos / vídeo'}
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    void onUploadMedia(e.target.files)
                    e.target.value = ''
                  }}
                />
              </label>
            ) : (
              <p className="text-[11px] text-slate-500">
                Solo el rider que realizó este recorrido puede subir multimedia.
              </p>
            )}
          </div>
          {attemptMedia.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {attemptMedia.map((m) => (
                <div
                  key={m.id}
                  className="relative aspect-video rounded-lg overflow-hidden bg-black border border-white/10"
                >
                  {m.kind === 'video' || routePreviewIsVideo(m.public_url) ? (
                    <video
                      src={m.public_url}
                      className="w-full h-full object-cover"
                      controls
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.public_url} alt="" className="w-full h-full object-cover" />
                  )}
                  <span className="absolute top-1 left-1 text-[9px] px-1.5 py-0.5 rounded bg-black/70 text-white flex items-center gap-1">
                    {m.kind === 'video' ? <Video size={10} /> : <ImageIcon size={10} />}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">Aún no hay fotos o vídeos para este recorrido.</p>
          )}
        </section>

        <section className={`${mobileStyles.card} overflow-hidden`}>
          <div className="px-4 py-3 border-b border-white/10 bg-slate-900/60">
            <h2 className="text-sm font-semibold text-white">Datos del recorrido</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Todas las métricas registradas en este recorrido.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3">
            {detailRows.map((row) => (
              <div key={row.label} className="rounded-xl border border-white/10 bg-slate-900/40 p-3">
                <p className="text-[11px] text-slate-500 mb-1">{row.label}</p>
                <div className="text-sm text-slate-100">{row.value}</div>
              </div>
            ))}
          </div>
        </section>
      </MobileMain>
    </MobileScreen>
  )
}

export default function AttemptReplayPage() {
  return (
    <Suspense
      fallback={
        <MobileScreen>
          <div className="min-h-[40vh] flex items-center justify-center text-slate-400">
            <BrandLogoLoader label="Cargando replay..." compact showRing />
          </div>
        </MobileScreen>
      }
    >
      <AttemptReplayInner />
    </Suspense>
  )
}
