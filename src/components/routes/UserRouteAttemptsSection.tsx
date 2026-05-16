'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/core/infrastructure/supabase/client'
import Link from 'next/link'
import {
  Upload,
  Clock,
  Gauge,
  TrendingUp,
  Mountain,
  Trophy,
  Video,
  ImageIcon,
  Sparkles,
  MapPin,
  Film,
} from 'lucide-react'
import { BrandSpinner } from '@/components/ui/BrandLogoLoader'
import { routePreviewIsVideo } from '@/lib/routePreviewMedia'
import { isReplayServiceConfigured, triggerServerReplayJob } from '@/lib/replay3d/triggerReplayJob'
import {
  getReplay3dPipelineStatus,
  isReplay3dProcessing,
  replay3dStatusLabel,
  replay3dUserFacingDetail,
} from '@/lib/replay3d/replay3dMeta'
import { useReplay3dMetaPolling } from '@/hooks/useReplay3dMetaPolling'
import { formatSpeedKmhFromStoredMps } from '@/lib/attemptSpeedDisplay'
import { optimizeMediaBeforeUpload } from '@/lib/mediaUploadOptimizer'
import { toast } from '@/lib/toast'
import { AttemptReelPreview } from '@/components/routes/AttemptReelPreview'

interface AttemptRow {
  id: string
  total_time: number
  moving_time: number
  max_speed: number
  avg_speed: number
  distance: number
  elevation_gain: number | null
  jumps_count: number | null
  overall_score: number | null
  completed_at: string
  video_url?: string | null
  video_gps_offset_ms?: number | null
  replay_3d_meta?: Record<string, unknown> | null
  gps_points?: unknown
  reel_plan_json?: unknown
  reel_status?: string | null
  reel_output_url?: string | null
  reel_error?: string | null
}

interface MediaRow {
  id: string
  attempt_id: string
  public_url: string
  kind: 'photo' | 'video'
}

function formatTime(seconds: number): string {
  const s = Number(seconds)
  const mins = Math.floor(s / 60)
  const secs = Math.floor(s % 60)
  const ms = Math.floor((s % 1) * 100)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
}

function formatSpeed(ms: number): string {
  return formatSpeedKmhFromStoredMps(ms)
}

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'file'
}

export function UserRouteAttemptsSection({ routeId }: { routeId: string }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [attempts, setAttempts] = useState<AttemptRow[]>([])
  const [mediaByAttempt, setMediaByAttempt] = useState<Record<string, MediaRow[]>>({})
  const [loading, setLoading] = useState(true)
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)
  const [uploadingLabel, setUploadingLabel] = useState<string>('Subiendo…')
  const [replayBusy, setReplayBusy] = useState<string | null>(null)
  const [reelBusy, setReelBusy] = useState<string | null>(null)
  const [videoDurationByAttempt, setVideoDurationByAttempt] = useState<Record<string, number>>({})

  const load = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setUserId(null)
      setAttempts([])
      setMediaByAttempt({})
      setLoading(false)
      return
    }
    setUserId(user.id)

    const { data: att, error: e1 } = await supabase
      .from('route_attempts')
      .select(
        'id, total_time, moving_time, max_speed, avg_speed, distance, elevation_gain, jumps_count, overall_score, completed_at, video_url, video_gps_offset_ms, replay_3d_meta, gps_points, reel_plan_json, reel_status, reel_output_url, reel_error'
      )
      .eq('route_id', routeId)
      .eq('user_id', user.id)
      .order('completed_at', { ascending: false })

    if (e1) {
      console.error(e1)
      setAttempts([])
      setMediaByAttempt({})
      setLoading(false)
      return
    }

    if (!att?.length) {
      setAttempts([])
      setMediaByAttempt({})
      setLoading(false)
      return
    }

    setAttempts(att as AttemptRow[])

    const ids = att.map((a) => a.id)
    const { data: med } = await supabase
      .from('route_attempt_media')
      .select('id, attempt_id, public_url, kind')
      .in('attempt_id', ids)
      .order('sort_order', { ascending: true })

    const map: Record<string, MediaRow[]> = {}
    for (const m of med || []) {
      const row = m as MediaRow
      if (!map[row.attempt_id]) map[row.attempt_id] = []
      map[row.attempt_id].push(row)
    }
    setMediaByAttempt(map)
    setLoading(false)
  }, [routeId])

  useEffect(() => {
    void load()
  }, [load])

  const pollReplay = attempts.some((a) => isReplay3dProcessing(a.replay_3d_meta))
  useReplay3dMetaPolling({
    shouldPoll: Boolean(userId && pollReplay),
    poll: load,
    intervalMs: 3500,
  })

  const onUpload = async (attemptId: string, files: FileList | null) => {
    if (!files?.length || !userId) return
    const supabase = createClient()
    setUploadingFor(attemptId)
    setUploadingLabel('Optimizando archivos…')
    try {
      let optimizedCount = 0
      let originalCount = 0
      for (let i = 0; i < files.length; i++) {
        const file = files[i]!
        const isVid = file.type.startsWith('video/')
        const isImg = file.type.startsWith('image/')
        if (!isVid && !isImg) continue

        const optimized = await optimizeMediaBeforeUpload(file)
        if (optimized.blocked) {
          throw new Error(
            optimized.reason || 'No se pudo preparar el vídeo para subir.'
          )
        }
        const uploadFile = optimized.file
        if (optimized.optimized) optimizedCount += 1
        else originalCount += 1
        setUploadingLabel(`Subiendo ${i + 1}/${files.length}…`)

        const path = `${userId}/${attemptId}/${Date.now()}-${i}-${safeFileName(uploadFile.name)}`
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
          user_id: userId,
          public_url: publicUrl,
          kind: isVid ? 'video' : 'photo',
          sort_order: i,
        })
        if (insErr) throw insErr

        if (isVid && i === 0) {
          await supabase.from('route_attempts').update({ video_url: publicUrl }).eq('id', attemptId).eq('user_id', userId)
        }
      }
      await load()
      if (optimizedCount > 0) {
        toast.success(
          'Multimedia optimizada y subida',
          `${optimizedCount} archivo(s) comprimidos antes de subir${originalCount > 0 ? ` · ${originalCount} sin cambios` : ''}.`
        )
      } else {
        toast.info('Archivos subidos', 'No fue necesario recomprimir los archivos seleccionados.')
      }
    } catch (e) {
      console.error(e)
      toast.error('No se pudo subir la multimedia', e instanceof Error ? e.message : undefined)
    } finally {
      setUploadingFor(null)
      setUploadingLabel('Subiendo…')
    }
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-white/10 bg-gdh-card p-5 flex items-center gap-3 text-slate-400">
        <BrandSpinner size={22} />
        Cargando tus bajadas en esta ruta…
      </section>
    )
  }

  if (!userId) {
    return (
      <section className="rounded-2xl border border-white/10 bg-gdh-card p-5 text-sm text-slate-500">
        Inicia sesión para ver tus intentos, estadísticas y subir fotos o vídeo de cada bajada.
      </section>
    )
  }

  if (attempts.length === 0) {
    return (
      <section className="rounded-2xl border border-white/10 bg-gdh-card p-5 space-y-2">
        <h3 className="text-lg font-bold text-white">Tus bajadas</h3>
        <p className="text-sm text-slate-500">
          Aún no registras un tiempo en esta ruta. Pulsa «Iniciar recorrido» y al guardar aparecerá aquí con la opción de
          adjuntar vídeo o fotos.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-gdh-card p-5 space-y-6">
      <div>
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Trophy size={20} className="text-amber-500" />
          Tus bajadas ({attempts.length})
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Cada registro incluye tus datos de esa pasada. Puedes añadir fotos o un vídeo del recorrido (se guardan en tu
          cuenta).
        </p>
      </div>

      <div className="space-y-4">
        {attempts.map((a) => {
          const gallery = mediaByAttempt[a.id] || []
          const when = new Date(a.completed_at).toLocaleString('es', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })
          const busy = uploadingFor === a.id
          const hasVideo =
            Boolean(a.video_url) ||
            gallery.some((m) => m.kind === 'video' || routePreviewIsVideo(m.public_url))
          const gpsRaw = a.gps_points
          const hasGpsTrack = Array.isArray(gpsRaw) && gpsRaw.length >= 2
          const meta = a.replay_3d_meta
          const pipelineStatus = getReplay3dPipelineStatus(meta)
          const replayStatus =
            meta && typeof meta === 'object' && typeof meta.status === 'string'
              ? (meta.status as string)
              : null
          const replayEngine =
            meta && typeof meta === 'object' && typeof meta.engine === 'string'
              ? (meta.engine as string)
              : null
          const replayDetail = replay3dUserFacingDetail(meta)
          const primaryVideoUrlForReel =
            (typeof a.video_url === 'string' && a.video_url.trim() ? a.video_url.trim() : null) ||
            gallery.find((m) => m.kind === 'video' || routePreviewIsVideo(m.public_url))?.public_url ||
            null

          const onVideoMeta = (e: React.SyntheticEvent<HTMLVideoElement>) => {
            const d = e.currentTarget.duration
            if (!Number.isFinite(d) || d <= 0) return
            setVideoDurationByAttempt((prev) => ({
              ...prev,
              [a.id]: Math.max(prev[a.id] ?? 0, d),
            }))
          }

          return (
            <article
              key={a.id}
              className="rounded-xl border border-white/10 bg-gdh-canvas-2 overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-white/5 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-200">{when}</p>
                  <p className="text-[11px] text-slate-500 font-mono">ID · {a.id.slice(0, 8)}…</p>
                </div>
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-medium text-gdh-brand-highlight cursor-pointer disabled:opacity-50">
                  {busy ? <BrandSpinner size={14} /> : <Upload size={14} />}
                  {busy ? 'Subiendo…' : 'Fotos / vídeo'}
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                    disabled={busy}
                    onChange={(e) => {
                      void onUpload(a.id, e.target.files)
                      e.target.value = ''
                    }}
                  />
                </label>
              </div>

              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div className="flex items-start gap-2">
                  <Clock className="text-gdh-sun shrink-0 mt-0.5" size={16} />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Tiempo</p>
                    <p className="font-mono font-bold text-white">{formatTime(Number(a.total_time))}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Gauge className="text-amber-400 shrink-0 mt-0.5" size={16} />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">V. máx / media</p>
                    <p className="text-slate-200">
                      {formatSpeed(Number(a.max_speed))} · {formatSpeed(Number(a.avg_speed))}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <TrendingUp className="text-gdh-brand-highlight shrink-0 mt-0.5" size={16} />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Distancia</p>
                    <p className="text-slate-200">{(Number(a.distance) / 1000).toFixed(2)} km</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Mountain className="text-gdh-muted shrink-0 mt-0.5" size={16} />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Desnivel + / saltos</p>
                    <p className="text-slate-200">
                      {a.elevation_gain != null ? `+${Number(a.elevation_gain).toFixed(0)} m` : '—'} ·{' '}
                      {a.jumps_count ?? 0}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Trophy className="text-amber-500 shrink-0 mt-0.5" size={16} />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Score</p>
                    <p className="text-slate-200">{a.overall_score != null ? `${a.overall_score}/100` : '—'}</p>
                  </div>
                </div>
              </div>

              {(gallery.length > 0 || a.video_url) && (
                <div className="px-4 pb-4">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Multimedia</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {a.video_url && !gallery.some((g) => g.public_url === a.video_url) && (
                      <div className="relative aspect-video rounded-lg overflow-hidden bg-black border border-white/10">
                        {routePreviewIsVideo(a.video_url) ? (
                          <video
                            src={a.video_url}
                            className="w-full h-full object-cover"
                            controls
                            playsInline
                            preload="metadata"
                            onLoadedMetadata={onVideoMeta}
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.video_url} alt="" className="w-full h-full object-cover" />
                        )}
                        <span className="absolute top-1 left-1 text-[9px] px-1.5 py-0.5 rounded bg-black/70 text-white flex items-center gap-1">
                          <Video size={10} /> Principal
                        </span>
                      </div>
                    )}
                    {gallery.map((m) => (
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
                            onLoadedMetadata={onVideoMeta}
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
                </div>
              )}

              {hasVideo && primaryVideoUrlForReel && (
                <div className="px-4 pb-4 space-y-2 border-t border-white/5 pt-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Film size={12} className="text-gdh-muted" />
                    Reel automático (beta)
                  </p>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Plan de cortes + slow-mo en picos de velocidad GPS (y saltos si hace falta). Podés previsualizarlo;
                    exportar MP4 vendrá con un worker FFmpeg.
                  </p>
                  {a.reel_error ? (
                    <p className="text-[11px] text-amber-200/90">Último error reel: {a.reel_error}</p>
                  ) : null}
                  {typeof a.reel_output_url === 'string' && a.reel_output_url.trim() ? (
                    <div className="rounded-lg border border-gdh-brand/30 bg-gdh-brand/10 p-2 text-[11px]">
                      <span className="text-slate-200/90">Vídeo exportado: </span>
                      <a href={a.reel_output_url} className="text-gdh-brand-highlight underline break-all" target="_blank" rel="noreferrer">
                        abrir
                      </a>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    disabled={reelBusy === a.id}
                    onClick={() => {
                      void (async () => {
                        setReelBusy(a.id)
                        try {
                          const dur = videoDurationByAttempt[a.id]
                          const res = await fetch(
                            `/api/dashboard/attempts/${encodeURIComponent(a.id)}/reel-plan`,
                            {
                              method: 'POST',
                              credentials: 'include',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify(
                                typeof dur === 'number' && Number.isFinite(dur) ? { videoDurationSec: dur } : {}
                              ),
                            }
                          )
                          const json = (await res.json().catch(() => ({}))) as { error?: string }
                          if (!res.ok) throw new Error(json.error || res.statusText)
                          toast.success('Plan de reel generado', 'Reproducí el preview abajo.')
                          await load()
                        } catch (e) {
                          console.error(e)
                          toast.error(
                            'No se pudo generar el plan',
                            e instanceof Error ? e.message : undefined
                          )
                        } finally {
                          setReelBusy(null)
                        }
                      })()
                    }}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gdh-brand hover:bg-gdh-brand-highlight text-xs font-medium text-white disabled:opacity-45"
                  >
                    {reelBusy === a.id ? <BrandSpinner size={14} /> : <Film size={14} />}
                    {reelBusy === a.id ? 'Generando…' : a.reel_plan_json ? 'Regenerar plan de reel' : 'Generar plan de reel'}
                  </button>
                  {a.reel_plan_json ? (
                    <AttemptReelPreview
                      videoUrl={primaryVideoUrlForReel}
                      planRaw={a.reel_plan_json}
                      regenerateBusy={reelBusy === a.id}
                      onRegeneratePlan={(opts) => {
                        void (async () => {
                          setReelBusy(a.id)
                          try {
                            const dur = videoDurationByAttempt[a.id]
                            const body: Record<string, unknown> = {}
                            if (typeof dur === 'number' && Number.isFinite(dur)) body.videoDurationSec = dur
                            if (opts && 'musicUrl' in opts) {
                              body.musicUrl = opts.musicUrl
                              if (opts.musicAttribution != null) body.musicAttribution = opts.musicAttribution
                            }
                            const res = await fetch(
                              `/api/dashboard/attempts/${encodeURIComponent(a.id)}/reel-plan`,
                              {
                                method: 'POST',
                                credentials: 'include',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(body),
                              }
                            )
                            const json = (await res.json().catch(() => ({}))) as { error?: string }
                            if (!res.ok) throw new Error(json.error || res.statusText)
                            toast.success('Plan actualizado', 'Música y cortes guardados.')
                            await load()
                          } catch (e) {
                            console.error(e)
                            toast.error(
                              'No se pudo actualizar el plan',
                              e instanceof Error ? e.message : undefined
                            )
                          } finally {
                            setReelBusy(null)
                          }
                        })()
                      }}
                    />
                  ) : null}
                </div>
              )}

              <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-2">
                {uploadingFor === a.id && (
                  <p className="text-[11px] text-gdh-brand-highlight/90 flex items-center gap-1.5">
                    <BrandSpinner size={12} />
                    {uploadingLabel}
                  </p>
                )}
                {hasGpsTrack && (
                  <Link
                    href={`/dashboard/routes/attempt-replay?attemptId=${encodeURIComponent(a.id)}&routeId=${encodeURIComponent(routeId)}`}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gdh-brand hover:bg-gdh-brand-highlight text-xs font-medium text-white mb-1"
                  >
                    <MapPin size={14} />
                    Replay mapa + vídeo (GPS)
                  </Link>
                )}
                <p className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Sparkles size={12} className="text-gdh-muted" />
                  Replay 3D (servidor / LingBot cuando lo integres)
                </p>
                {(replayStatus || replayEngine || pipelineStatus !== 'none') && (
                  <div className="text-xs text-slate-400 space-y-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      {pipelineStatus === 'processing' && (
                        <BrandSpinner className="shrink-0" size={14} />
                      )}
                      <span>
                        Estado LingBot / servidor:{' '}
                        <span className="text-slate-200 font-medium">
                          {replay3dStatusLabel(pipelineStatus)}
                        </span>
                        {replayStatus && replayStatus !== pipelineStatus ? (
                          <span className="text-slate-500 font-mono text-[10px] ml-1">({replayStatus})</span>
                        ) : null}
                      </span>
                      {replayEngine ? (
                        <span>
                          · motor <code className="text-amber-200/90">{replayEngine}</code>
                        </span>
                      ) : null}
                    </p>
                    {replayDetail ? (
                      <p className="text-[11px] text-slate-500 leading-snug">{replayDetail}</p>
                    ) : null}
                  </div>
                )}
                {isReplayServiceConfigured() ? (
                  <button
                    type="button"
                    disabled={!hasVideo || replayBusy === a.id || replayStatus === 'processing'}
                    onClick={() => {
                      void (async () => {
                        setReplayBusy(a.id)
                        try {
                          const r = await triggerServerReplayJob(a.id)
                          if (!r.ok) {
                            alert(r.skipped ? 'Servidor de replay no disponible' : r.error || 'Error')
                          }
                          await load()
                        } finally {
                          setReplayBusy(null)
                        }
                      })()
                    }}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gdh-brand hover:bg-gdh-brand-highlight text-xs font-medium text-white disabled:opacity-40 disabled:pointer-events-none"
                  >
                    {replayBusy === a.id ? (
                      <BrandSpinner size={14} />
                    ) : (
                      <Sparkles size={14} />
                    )}
                    {replayBusy === a.id ? 'Procesando…' : 'Enviar a procesar (servidor)'}
                  </button>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    Configura <code className="text-slate-400">NEXT_PUBLIC_REPLAY_SERVICE_URL</code> con la URL pública del
                    servicio en <code className="text-slate-400">replay-service/</code> (Docker). Ahí podrás enchufar
                    LingBot-Map o inferencia nativa vía el mismo contrato.
                  </p>
                )}
                {!hasVideo && isReplayServiceConfigured() && (
                  <p className="text-[11px] text-amber-200/80">Sube un vídeo de esta bajada para poder procesarlo.</p>
                )}
                {meta && typeof meta === 'object' && Object.keys(meta).length > 0 && (
                  <details className="text-[10px] text-slate-500">
                    <summary className="cursor-pointer text-slate-400 hover:text-slate-300">
                      Ver metadatos raw (replay_3d_meta)
                    </summary>
                    <pre className="mt-2 p-2 rounded-lg bg-black/40 overflow-x-auto max-h-40 text-slate-400">
                      {JSON.stringify(meta, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </article>
          )
        })}
      </div>

      <div className="rounded-xl border border-gdh-brand/20 bg-gdh-brand/5 p-4 text-xs text-slate-400 leading-relaxed space-y-2">
        <p className="font-semibold text-gdh-brand-highlight/90">Sobre visión 3D tipo LingBot-Map</p>
        <p>
          <strong className="text-slate-300">LingBot-Map</strong> es un modelo de investigación (reconstrucción 3D con IA a
          partir de vídeo), no un componente que se instala en la app: requiere inferencia pesada (GPU) y un pipeline en
          servidor. En la app móvil/WebView lo razonable es:{' '}
          <strong className="text-slate-300">mapa 3D con terreno</strong> (p. ej. MapLibre GL + DEM) y un{' '}
          <strong className="text-slate-300">avatar</strong> que recorre el GPS usando los timestamps de cada punto,
          sincronizado con el reloj del vídeo mediante un <strong className="text-slate-300">desfase</strong> (
          <code className="text-amber-200/90">video_gps_offset_ms</code> en BD).
        </p>
        <p>
          Los <strong className="text-slate-300">saltos</strong> ya pueden estimarse desde el análisis de GPS (picos de
          aceleración vertical / tu <code className="text-amber-200/90">jumps_count</code>); combinarlos con el vídeo es
          calibración (mismo instante en la línea de tiempo). El campo <code className="text-amber-200/90">replay_3d_meta</code>{' '}
          lo actualiza el worker en <code className="text-amber-200/90">replay-service/</code> (stub listo para sustituir por
          LingBot u otro pipeline con GPU).
        </p>
        <p>
          Proyectos oficiales Robbyant (modelos y licencia):{' '}
          <a
            href="https://github.com/robbyant/lingbot-world"
            className="text-gdh-brand-highlight underline hover:text-gdh-brand-highlight/80"
            target="_blank"
            rel="noreferrer"
          >
            GitHub lingbot-world
          </a>
          ,{' '}
          <a
            href="https://www.lingbot-world.com/"
            className="text-gdh-brand-highlight underline hover:text-gdh-brand-highlight/80"
            target="_blank"
            rel="noreferrer"
          >
            lingbot-world.com
          </a>
          .
        </p>
      </div>
    </section>
  )
}
