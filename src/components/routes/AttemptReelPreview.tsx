'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Clapperboard, Play, Square, Music2, ChevronDown, ChevronUp, X } from 'lucide-react'
import type { ReelPlanV1 } from '@/lib/reel/reelPlanTypes'
import { isReelPlanV1 } from '@/lib/reel/reelPlanTypes'
import { REEL_MUSIC_PRESETS } from '@/lib/reel/reelMusicPresets'
import { ReelYoutubeMusicPicker } from '@/components/routes/ReelYoutubeMusicPicker'
import { extractYoutubeVideoId, formatYoutubeMusicLabel, isLikelyYoutubeMusicUrl } from '@/lib/youtubeVideoId'
import { ensureYoutubeIframeApiLoaded, type YTPlayerInstance } from '@/lib/youtubeIframeApi'

type Props = {
  videoUrl: string
  planRaw: unknown
  /** Si existe, permite volver a POST el plan con música / URL personalizada. */
  onRegeneratePlan?: (opts: { musicUrl: string | null; musicAttribution: string | null }) => void
  /** Mientras se guarda el plan con música */
  regenerateBusy?: boolean
}

export function AttemptReelPreview({ videoUrl, planRaw, onRegeneratePlan, regenerateBusy }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const bgAudioRef = useRef<HTMLAudioElement | null>(null)
  const ytMountRef = useRef<HTMLDivElement | null>(null)
  const ytPlayerRef = useRef<YTPlayerInstance | null>(null)
  const cancelRef = useRef(false)
  const [busy, setBusy] = useState(false)
  const [label, setLabel] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [noAudioTrackHint, setNoAudioTrackHint] = useState(false)
  const [musicUrlInput, setMusicUrlInput] = useState('')
  const [musicAttribution, setMusicAttribution] = useState('')
  const [selectedPresetId, setSelectedPresetId] = useState<string>('')
  /** Si es false y la música es YouTube, ocultamos URL/atribución/guardar (ya se guarda al tocar Agregar). */
  const [musicDetailsOpen, setMusicDetailsOpen] = useState(false)

  const plan: ReelPlanV1 | null = isReelPlanV1(planRaw) ? planRaw : null

  const effectiveMusicUrl = musicUrlInput.trim() || plan?.backgroundMusicUrl?.trim() || ''
  const effectiveYoutube = effectiveMusicUrl ? extractYoutubeVideoId(effectiveMusicUrl) : null

  useEffect(() => {
    if (!plan?.backgroundMusicUrl) return
    setMusicUrlInput(plan.backgroundMusicUrl)
    setMusicAttribution(plan.backgroundMusicAttribution ?? '')
    if (isLikelyYoutubeMusicUrl(plan.backgroundMusicUrl)) setMusicDetailsOpen(false)
  }, [plan?.backgroundMusicUrl, plan?.backgroundMusicAttribution])

  useEffect(() => {
    setNoAudioTrackHint(false)
    const syncAudio = () => {
      const el = videoRef.current
      if (!el) return
      el.muted = false
      if (el.volume === 0) el.volume = 1
      try {
        const at = (el as HTMLVideoElement & { audioTracks?: { length: number } }).audioTracks
        if (at && typeof at.length === 'number' && at.length === 0) setNoAudioTrackHint(true)
      } catch {
        /* audioTracks no disponible en todos los motores */
      }
    }
    const id = requestAnimationFrame(() => {
      const el = videoRef.current
      if (!el) return
      el.addEventListener('loadedmetadata', syncAudio)
      el.addEventListener('play', syncAudio)
      el.addEventListener('canplay', syncAudio)
      syncAudio()
    })
    return () => {
      cancelAnimationFrame(id)
      const el = videoRef.current
      if (el) {
        el.removeEventListener('loadedmetadata', syncAudio)
        el.removeEventListener('play', syncAudio)
        el.removeEventListener('canplay', syncAudio)
      }
    }
  }, [videoUrl, planRaw])

  useEffect(() => {
    return () => {
      cancelRef.current = true
      const v = videoRef.current
      if (v) {
        v.pause()
        v.playbackRate = 1
      }
      bgAudioRef.current?.pause()
      try {
        ytPlayerRef.current?.destroy()
      } catch {
        /* noop */
      }
      ytPlayerRef.current = null
    }
  }, [])

  const stopBg = useCallback(() => {
    const a = bgAudioRef.current
    if (a) {
      a.pause()
      a.currentTime = 0
    }
    try {
      ytPlayerRef.current?.pauseVideo()
    } catch {
      /* noop */
    }
  }, [])

  const stop = useCallback(() => {
    cancelRef.current = true
    const v = videoRef.current
    if (v) {
      v.pause()
      v.playbackRate = 1
    }
    stopBg()
    setBusy(false)
    setLabel(null)
  }, [stopBg])

  const ensureYoutubeBgPlaying = useCallback(async (videoId: string) => {
    await ensureYoutubeIframeApiLoaded()
    const el = ytMountRef.current
    const YT = typeof window !== 'undefined' ? window.YT : undefined
    if (!el || !YT?.Player) throw new Error('Reproductor YouTube no disponible')

    if (!ytPlayerRef.current) {
      await new Promise<void>((resolve, reject) => {
        try {
          new YT.Player(el, {
            videoId,
            width: 1,
            height: 1,
            playerVars: { controls: 0, modestbranding: 1, playsinline: 1 },
            events: {
              onReady: (e: { target: YTPlayerInstance }) => {
                ytPlayerRef.current = e.target
                resolve()
              },
              onError: () => reject(new Error('No se pudo cargar el audio de YouTube (¿embed deshabilitado?)')),
            },
          })
        } catch (e) {
          reject(e instanceof Error ? e : new Error('YouTube Player'))
        }
      })
    } else {
      ytPlayerRef.current.loadVideoById(videoId)
    }
    const pl = ytPlayerRef.current
    if (!pl) return
    pl.setVolume(38)
    pl.seekTo(0, true)
    pl.playVideo()
  }, [])

  const playReel = useCallback(async () => {
    if (!plan?.segments.length) return
    const v = videoRef.current
    if (!v) return
    cancelRef.current = false
    setErr(null)
    setBusy(true)

    const bgUrl = musicUrlInput.trim() || plan.backgroundMusicUrl?.trim() || ''
    const a = bgAudioRef.current
    const ytId = bgUrl ? extractYoutubeVideoId(bgUrl) : null

    try {
      v.muted = false
      if (v.volume === 0) v.volume = 1
      if (ytId) {
        v.volume = 0.42
        await ensureYoutubeBgPlaying(ytId)
      } else if (bgUrl && a) {
        a.src = bgUrl
        a.loop = true
        a.volume = 0.35
        v.volume = 0.45
        a.currentTime = 0
        await a.play().catch(() => undefined)
      } else {
        v.volume = 1
      }

      for (const seg of plan.segments) {
        if (cancelRef.current) break
        setLabel(seg.label)
        const start = seg.srcStartSec
        const end = seg.srcEndSec
        if (!(end > start)) continue
        v.playbackRate = seg.playbackRate
        v.currentTime = start
        await v.play().catch(() => undefined)

        await new Promise<void>((resolve) => {
          const tick = () => {
            if (cancelRef.current || v.currentTime >= end - 0.04) {
              v.removeEventListener('timeupdate', tick)
              resolve()
            }
          }
          v.addEventListener('timeupdate', tick)
        })
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error de reproducción')
    } finally {
      v.pause()
      v.playbackRate = 1
      v.muted = false
      v.volume = 1
      stopBg()
      setBusy(false)
      setLabel(null)
    }
  }, [plan, musicUrlInput, stopBg, ensureYoutubeBgPlaying])

  const applyPreset = (id: string) => {
    setSelectedPresetId(id)
    const p = REEL_MUSIC_PRESETS.find((x) => x.id === id)
    if (p) {
      setMusicUrlInput(p.url)
      setMusicAttribution(p.attribution)
      setMusicDetailsOpen(true)
    }
  }

  const persistMusicToPlan = () => {
    if (!onRegeneratePlan) return
    const url = musicUrlInput.trim()
    onRegeneratePlan({
      musicUrl: url || null,
      musicAttribution: url ? musicAttribution.trim() || 'Música de fondo (atribución pendiente).' : null,
    })
    if (extractYoutubeVideoId(url)) setMusicDetailsOpen(false)
  }

  const clearMusic = () => {
    setSelectedPresetId('')
    setMusicUrlInput('')
    setMusicAttribution('')
    setMusicDetailsOpen(false)
    onRegeneratePlan?.({ musicUrl: null, musicAttribution: null })
  }

  if (!plan) {
    return <p className="text-[11px] text-slate-500">Plan de reel no disponible o formato antiguo.</p>
  }

  /** Panel YouTube / presets / URL solo si el plan fue marcado como generado por IA (`planSource: 'ai'`). */
  const showMusicPanel = plan.planSource === 'ai'
  const hideMusicBecauseHeuristic = plan.planSource !== 'ai'

  return (
    <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-3 space-y-2">
      <div className="flex items-center gap-2 text-[11px] font-medium text-violet-200/95">
        <Clapperboard size={14} className="shrink-0" />
        Preview reel (mismo vídeo, cortes + slow-mo)
      </div>
      <p className="text-[10px] text-slate-500 leading-snug">
        ~{plan.totalPlaybackEstimateSec}s estimados · {plan.segments.length} clips. Exportación MP4 con FFmpeg en
        servidor (mux + música).
      </p>
      {plan.notes?.length ? (
        <ul className="text-[10px] text-slate-500 list-disc pl-4 space-y-0.5">
          {plan.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}

      <audio ref={bgAudioRef} preload="none" className="hidden" playsInline />

      <div
        ref={ytMountRef}
        className="pointer-events-none fixed left-0 top-0 -z-10 h-px w-px overflow-hidden opacity-0"
        aria-hidden
      />

      <div className="space-y-2">
        <p className="text-[10px] font-medium text-slate-300">Tu vídeo + reel</p>
        <div className="relative aspect-video rounded-lg overflow-hidden bg-black border border-white/10">
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-contain"
            playsInline
            controls
            preload="metadata"
            muted={false}
          />
        </div>
        {noAudioTrackHint ? (
          <p className="text-[10px] text-amber-200/90 leading-snug">
            El navegador no detecta pista de audio en este archivo (común en vídeos recodificados viejos). Re-subí el
            clip original o grabá de nuevo para tener sonido.
          </p>
        ) : (
          <p className="text-[10px] text-slate-500 leading-snug">
            Usá <strong className="text-slate-400">Reproducir reel</strong> para ver tu vídeo con los cortes del plan
            {showMusicPanel ? ' y la música de fondo (YouTube o MP3).' : '.'} En el reproductor, comprobá que el volumen
            no esté silenciado.
            {hideMusicBecauseHeuristic ? (
              <span className="block mt-1 text-slate-600">
                La música de fondo (búsqueda YouTube, presets…) solo aparece cuando el plan tiene{' '}
                <code className="text-slate-500">planSource: &quot;ai&quot;</code> (generación con IA en servidor).
              </span>
            ) : null}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void playReel()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600/85 hover:bg-violet-500 text-[11px] font-medium text-white disabled:opacity-45"
          >
            {busy ? <Square size={12} /> : <Play size={12} />}
            {busy ? 'Reproduciendo…' : 'Reproducir reel'}
          </button>
          {busy ? (
            <button
              type="button"
              onClick={stop}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/15 text-[11px] text-slate-200 hover:bg-white/5"
            >
              Detener
            </button>
          ) : null}
          {label ? <span className="text-[10px] text-slate-400 truncate max-w-[10rem]">{label}</span> : null}
        </div>
        {err ? <p className="text-[11px] text-red-300/90">{err}</p> : null}
      </div>

      {showMusicPanel ? (
        <div className="rounded-lg border border-white/10 bg-[#121826]/80 p-2 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1">
            <Music2 size={12} className="text-violet-400" />
            Música de fondo
          </p>
          <p className="text-[9px] text-slate-500 leading-snug">
            Buscá en YouTube o elegí un preset MP3. Al tocar <span className="text-slate-400">Agregar</span> en YouTube
            se guarda solo en el plan (sin formulario largo). «Reproducir reel» arriba mezcla tu vídeo con esa música.
          </p>

          <ReelYoutubeMusicPicker
            onPick={({ watchUrl, attribution }) => {
              setSelectedPresetId('')
              setMusicUrlInput(watchUrl)
              setMusicAttribution(attribution)
              if (onRegeneratePlan) {
                setMusicDetailsOpen(false)
                onRegeneratePlan({
                  musicUrl: watchUrl,
                  musicAttribution: attribution.trim() || 'Música de fondo (atribución pendiente).',
                })
              } else {
                setMusicDetailsOpen(true)
              }
            }}
          />

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => clearMusic()}
              className={`rounded-md border px-2 py-1 text-[9px] ${selectedPresetId === '' && !effectiveMusicUrl ? 'border-teal-500/60 bg-teal-500/15' : 'border-white/10 bg-black/30'}`}
            >
              Sin música
            </button>
            {REEL_MUSIC_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id)}
                className={`rounded-md border px-2 py-1 text-[9px] max-w-[9rem] truncate ${
                  selectedPresetId === p.id ? 'border-violet-400/70 bg-violet-500/20' : 'border-white/10 bg-black/30'
                }`}
                title={p.attribution}
              >
                {p.label.replace(' (Kevin MacLeod)', '')}
              </button>
            ))}
          </div>

          {effectiveYoutube && !musicDetailsOpen ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-950/25 px-2 py-2">
              <Music2 size={14} className="shrink-0 text-emerald-300" />
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-emerald-200/90">YouTube en el plan</p>
                <p className="text-[10px] text-slate-200 leading-snug line-clamp-2">
                  {formatYoutubeMusicLabel(musicAttribution)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMusicDetailsOpen(true)}
                className="shrink-0 inline-flex items-center gap-0.5 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[9px] font-medium text-slate-200 hover:bg-white/10"
              >
                Editar
                <ChevronDown size={12} />
              </button>
              <button
                type="button"
                onClick={() => clearMusic()}
                className="shrink-0 inline-flex items-center gap-0.5 rounded-md border border-red-500/35 bg-red-950/40 px-2 py-1 text-[9px] font-medium text-red-200 hover:bg-red-950/60"
                aria-label="Quitar música"
              >
                <X size={12} />
                Quitar
              </button>
            </div>
          ) : (
            <>
              <input
                type="url"
                value={musicUrlInput}
                onChange={(e) => {
                  setMusicUrlInput(e.target.value)
                  setSelectedPresetId('')
                  if (!extractYoutubeVideoId(e.target.value)) setMusicDetailsOpen(true)
                }}
                placeholder="https://…/tema.mp3 o https://www.youtube.com/watch?v=…"
                className="w-full rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-[10px] text-slate-200 placeholder:text-slate-600"
              />
              <textarea
                value={musicAttribution}
                onChange={(e) => setMusicAttribution(e.target.value)}
                placeholder="Atribución / licencia (obligatorio si usás música de terceros)"
                rows={2}
                className="w-full rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-[10px] text-slate-200 placeholder:text-slate-600 resize-none"
              />
              {effectiveYoutube && musicDetailsOpen ? (
                <button
                  type="button"
                  onClick={() => setMusicDetailsOpen(false)}
                  className="w-full rounded-md border border-white/10 bg-black/30 py-1 text-[9px] text-slate-400 hover:bg-white/5 inline-flex items-center justify-center gap-1"
                >
                  <ChevronUp size={12} />
                  Ocultar detalles (seguís con YouTube guardado)
                </button>
              ) : null}
              {onRegeneratePlan ? (
                <button
                  type="button"
                  disabled={regenerateBusy}
                  onClick={() => persistMusicToPlan()}
                  className="w-full rounded-md border border-violet-400/40 bg-violet-600/30 py-1.5 text-[10px] font-semibold text-violet-50 hover:bg-violet-600/45 disabled:opacity-45"
                >
                  {regenerateBusy ? 'Guardando plan…' : 'Guardar música en el plan'}
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
