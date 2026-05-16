'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { Play, Pause, Mountain, Timer, Zap } from 'lucide-react'
import { APP_MAP_CANVAS_HEX, MAP_AVATAR_THUMB_IMG_CLASS } from '@/components/routes/mapTheme'
import {
  Map,
  MapControls,
  MapMarker,
  MarkerContent,
  MapRoute,
  useMap,
} from '@/components/ui/map'
import {
  type ReplayGpsPoint,
  interpolateReplayFrame,
  gpsTimeMsFromVideoTime,
} from '@/lib/attemptReplayGps'
import { replayRiderIconPulse } from '@/lib/animeUi'
import { publishPetReplayTick, publishReplayGuideSignal } from '@/lib/guide-ai/guideUiTelemetry'
import { computeReplayVerticalContext } from '@/lib/replay/replayVerticalContext'

const CARTO_DARK_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

const RIDER_MARKER_PX = 40

function FitReplayBounds({ coords }: { coords: [number, number][] }) {
  const { map } = useMap()
  useEffect(() => {
    if (!map || coords.length < 2) return
    const b = new maplibregl.LngLatBounds(coords[0]!, coords[0]!)
    for (const c of coords) b.extend(c)
    map.fitBounds(b, { padding: 50, maxZoom: 16, duration: 0 })
  }, [map, coords])
  return null
}

/** URL usable en <img src> (foto de perfil / map_avatar), alineado con la grabación de ruta. */
function normalizeReplayAvatarUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  let s = raw.trim()
  if (s.startsWith('//')) s = `https:${s}`
  if (s.startsWith('/') && typeof window !== 'undefined' && window.location?.origin) {
    s = `${window.location.origin}${s}`
  }
  try {
    const u = new URL(s)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    return u.href
  } catch {
    return null
  }
}

function formatKmh(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${n.toFixed(1)} km/h`
}

function formatAlt(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${Math.round(n)} m`
}

function formatElapsedHhMmSsMmm(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00:00:000'
  const totalMs = Math.max(0, Math.round(seconds * 1000))
  const hours = Math.floor(totalMs / 3_600_000)
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000)
  const secs = Math.floor((totalMs % 60_000) / 1000)
  const millis = totalMs % 1000
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(millis).padStart(3, '0')}`
}

export interface AttemptReplayViewerProps {
  points: ReplayGpsPoint[]
  videoUrl: string | null
  videoGpsOffsetMs: number
  /** URL de avatar del usuario que realizó el recorrido (se muestra en el mapa). */
  riderAvatarUrl?: string | null
  /** Nombre visible; si no hay foto, se muestra la inicial. */
  riderDisplayName?: string | null
}

export function AttemptReplayViewer({
  points,
  videoUrl,
  videoGpsOffsetMs,
  riderAvatarUrl,
  riderDisplayName,
}: AttemptReplayViewerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const riderWrapRef = useRef<HTMLDivElement | null>(null)
  const t0 = points[0]?.t ?? 0
  const tEnd = points[points.length - 1]?.t ?? t0
  const gpsSpanSec = Math.max(0.001, (tEnd - t0) / 1000)

  const [tGpsMs, setTGpsMs] = useState(() => t0)
  const [sliderSec, setSliderSec] = useState(0)
  const [durationSec, setDurationSec] = useState(0)
  const [playing, setPlaying] = useState(false)
  const playingRef = useRef(playing)
  playingRef.current = playing
  const gpsOnlyAnchorRef = useRef<{ wall: number; gpsMs: number } | null>(null)
  const rafGpsOnlyRef = useRef<number | null>(null)
  const lastRiderPulseAtRef = useRef(0)
  const prevPlayingForGuideRef = useRef(playing)
  const didMountGuideRef = useRef(false)
  const seekGuideTimerRef = useRef<number | null>(null)

  const lineLngLat = useMemo<[number, number][]>(
    () => points.map((p) => [p.lng, p.lat] as [number, number]),
    [points]
  )

  const flushSeekGuideSignal = useCallback(
    (sec: number) => {
      if (videoUrl) {
        const tMs = gpsTimeMsFromVideoTime(t0, sec, videoGpsOffsetMs)
        const fr = interpolateReplayFrame(points, tMs, t0)
        publishReplayGuideSignal({
          action: 'seek',
          elapsed_sec: fr.elapsedSec,
          speed_kmh: fr.speedKmh,
          altitude_m: fr.altitudeM ?? null,
          playing: playingRef.current,
        })
      } else {
        const fr = interpolateReplayFrame(points, t0 + sec * 1000, t0)
        publishReplayGuideSignal({
          action: 'seek',
          elapsed_sec: fr.elapsedSec,
          speed_kmh: fr.speedKmh,
          altitude_m: fr.altitudeM ?? null,
          playing: playingRef.current,
        })
      }
    },
    [videoUrl, t0, videoGpsOffsetMs, points]
  )

  const scheduleSeekGuideSignal = useCallback(
    (sec: number) => {
      if (seekGuideTimerRef.current != null) window.clearTimeout(seekGuideTimerRef.current)
      seekGuideTimerRef.current = window.setTimeout(() => {
        seekGuideTimerRef.current = null
        flushSeekGuideSignal(sec)
      }, 700)
    },
    [flushSeekGuideSignal]
  )

  useEffect(() => {
    return () => {
      if (seekGuideTimerRef.current != null) window.clearTimeout(seekGuideTimerRef.current)
    }
  }, [])

  const frame = useMemo(() => interpolateReplayFrame(points, tGpsMs, t0), [points, tGpsMs, t0])

  useEffect(() => {
    if (!didMountGuideRef.current) {
      didMountGuideRef.current = true
      prevPlayingForGuideRef.current = playing
      return
    }
    if (prevPlayingForGuideRef.current === playing) return
    prevPlayingForGuideRef.current = playing
    publishReplayGuideSignal({
      action: playing ? 'play' : 'pause',
      elapsed_sec: frame.elapsedSec,
      speed_kmh: frame.speedKmh,
      altitude_m: frame.altitudeM ?? null,
      playing,
    })
  }, [playing, frame.elapsedSec, frame.speedKmh, frame.altitudeM])

  const lastPetTickWallRef = useRef(0)
  const prevPlayingForPetTickRef = useRef(playing)

  useEffect(() => {
    const now = Date.now()
    const vert = computeReplayVerticalContext(points, tGpsMs, t0)
    if (playing) {
      if (now - lastPetTickWallRef.current < 400) return
      lastPetTickWallRef.current = now
      publishPetReplayTick({
        speed_kmh: frame.speedKmh,
        altitude_m: frame.altitudeM ?? null,
        elapsed_sec: frame.elapsedSec,
        playing: true,
        grade_pct_est: vert.grade_pct_est,
        vertical_mode: vert.vertical_mode,
        uphill_pedaling_likely: vert.uphill_pedaling_likely,
      })
      prevPlayingForPetTickRef.current = true
      return
    }
    if (prevPlayingForPetTickRef.current) {
      prevPlayingForPetTickRef.current = false
      lastPetTickWallRef.current = now
      publishPetReplayTick({
        speed_kmh: frame.speedKmh,
        altitude_m: frame.altitudeM ?? null,
        elapsed_sec: frame.elapsedSec,
        playing: false,
        grade_pct_est: vert.grade_pct_est,
        vertical_mode: vert.vertical_mode,
        uphill_pedaling_likely: vert.uphill_pedaling_likely,
      })
    }
  }, [playing, frame.speedKmh, frame.altitudeM, frame.elapsedSec, points, tGpsMs, t0])

  useEffect(() => {
    const wrap = riderWrapRef.current
    if (!wrap || !playing) return
    const now = performance.now()
    if (now - lastRiderPulseAtRef.current < 340) return
    lastRiderPulseAtRef.current = now
    replayRiderIconPulse(wrap)
  }, [frame.lat, frame.lng, frame.elapsedSec, playing])

  const avatarResolved = useMemo(() => normalizeReplayAvatarUrl(riderAvatarUrl ?? null), [riderAvatarUrl])
  const initialLetter = riderDisplayName?.trim()?.[0]?.toUpperCase() ?? null

  const applyVideoTime = useCallback(
    (videoSeconds: number) => {
      const tGps = gpsTimeMsFromVideoTime(t0, videoSeconds, videoGpsOffsetMs)
      setTGpsMs(tGps)
      setSliderSec(Math.max(0, videoSeconds))
    },
    [t0, videoGpsOffsetMs]
  )

  const applyGpsOnlyElapsed = useCallback(
    (elapsedSecFromStart: number) => {
      const tGps = t0 + elapsedSecFromStart * 1000
      setTGpsMs(tGps)
      setSliderSec(Math.max(0, Math.min(elapsedSecFromStart, gpsSpanSec)))
    },
    [t0, gpsSpanSec]
  )

  useEffect(() => {
    const vid = videoRef.current
    if (!vid || !videoUrl) return

    const onTime = () => {
      applyVideoTime(vid.currentTime)
    }
    const onMeta = () => {
      setDurationSec(Number.isFinite(vid.duration) ? vid.duration : 0)
    }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)

    vid.addEventListener('timeupdate', onTime)
    vid.addEventListener('loadedmetadata', onMeta)
    vid.addEventListener('durationchange', onMeta)
    vid.addEventListener('play', onPlay)
    vid.addEventListener('pause', onPause)
    onMeta()
    applyVideoTime(vid.currentTime)

    return () => {
      vid.removeEventListener('timeupdate', onTime)
      vid.removeEventListener('loadedmetadata', onMeta)
      vid.removeEventListener('durationchange', onMeta)
      vid.removeEventListener('play', onPlay)
      vid.removeEventListener('pause', onPause)
    }
  }, [videoUrl, applyVideoTime])

  useEffect(() => {
    if (videoUrl) return
    if (!playing) {
      if (rafGpsOnlyRef.current != null) {
        cancelAnimationFrame(rafGpsOnlyRef.current)
        rafGpsOnlyRef.current = null
      }
      return
    }

    const loop = () => {
      const anchor = gpsOnlyAnchorRef.current
      if (anchor) {
        const elapsed = (performance.now() - anchor.wall) / 1000
        let nextSec = (anchor.gpsMs - t0) / 1000 + elapsed
        if (nextSec >= gpsSpanSec) {
          nextSec = gpsSpanSec
          setPlaying(false)
          gpsOnlyAnchorRef.current = null
        }
        applyGpsOnlyElapsed(nextSec)
      }
      rafGpsOnlyRef.current = requestAnimationFrame(loop)
    }
    rafGpsOnlyRef.current = requestAnimationFrame(loop)
    return () => {
      if (rafGpsOnlyRef.current != null) cancelAnimationFrame(rafGpsOnlyRef.current)
      rafGpsOnlyRef.current = null
    }
  }, [playing, videoUrl, t0, gpsSpanSec, applyGpsOnlyElapsed])

  const maxSlider = videoUrl ? Math.max(durationSec, 0.01) : gpsSpanSec

  const togglePlay = () => {
    if (videoUrl) {
      const v = videoRef.current
      if (!v) return
      if (v.paused) void v.play()
      else v.pause()
      return
    }
    if (playing) {
      setPlaying(false)
      gpsOnlyAnchorRef.current = null
      return
    }
    const currentGpsMs = t0 + sliderSec * 1000
    gpsOnlyAnchorRef.current = { wall: performance.now(), gpsMs: currentGpsMs }
    setPlaying(true)
  }

  const onSliderChange = (sec: number) => {
    const s = Math.max(0, Math.min(sec, maxSlider))
    if (videoUrl) {
      const v = videoRef.current
      if (v) {
        v.currentTime = s
        applyVideoTime(s)
      }
    } else {
      setPlaying(false)
      gpsOnlyAnchorRef.current = null
      applyGpsOnlyElapsed(s)
    }
    scheduleSeekGuideSignal(s)
  }

  if (lineLngLat.length < 2) {
    return (
      <p className="text-sm text-slate-500 text-center py-8">
        No hay suficientes puntos GPS para el replay.
      </p>
    )
  }

  const mapCenter: [number, number] = lineLngLat[0] ?? [0, 0]

  return (
    <div className="space-y-3">
      <div
        className="relative h-[min(52vh,420px)] w-full overflow-hidden rounded-xl border border-white/10"
        style={{ background: APP_MAP_CANVAS_HEX }}
      >
        <div className="absolute left-3 top-3 z-10 max-w-[min(92%,280px)] rounded-xl border border-white/10 bg-slate-950/92 px-3 py-2.5 text-xs shadow-lg backdrop-blur-sm pointer-events-none">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gdh-brand-highlight/90 mb-1.5">Posición actual</p>
          <ul className="space-y-1.5 text-slate-100">
            <li className="flex items-center gap-2">
              <Timer className="shrink-0 text-amber-400" size={14} />
              <span className="text-slate-400">Tiempo recorrido</span>
              <span className="ml-auto font-mono tabular-nums text-amber-200/95">
                {formatElapsedHhMmSsMmm(frame.elapsedSec)}
              </span>
            </li>
            <li className="flex items-center gap-2">
              <Zap className="shrink-0 text-gdh-sun" size={14} />
              <span className="text-slate-400">Velocidad</span>
              <span className="ml-auto font-mono tabular-nums text-gdh-sun">{formatKmh(frame.speedKmh)}</span>
            </li>
            <li className="flex items-center gap-2">
              <Mountain className="shrink-0 text-gdh-muted" size={14} />
              <span className="text-slate-400">Altitud</span>
              <span className="ml-auto font-mono tabular-nums text-slate-300">{formatAlt(frame.altitudeM)}</span>
            </li>
          </ul>
        </div>

        <Map
          className="map-dark-ui h-full min-h-[280px] w-full [&_.maplibregl-ctrl-attrib]:!text-[10px] [&_.maplibregl-ctrl-attrib]:!text-slate-400"
          theme="dark"
          forceStyle={CARTO_DARK_STYLE}
          center={mapCenter}
          zoom={13}
        >
          <FitReplayBounds coords={lineLngLat} />
          <MapRoute id="replay-track" coordinates={lineLngLat} color="#e37845" width={4} opacity={0.88} />
          <MapControls position="bottom-right" showZoom showCompass showLocate={false} showFullscreen />
          <MapMarker
            key={`rider-${avatarResolved ?? 'n'}-${initialLetter ?? 'x'}`}
            longitude={frame.lng}
            latitude={frame.lat}
            anchor="center"
          >
            <MarkerContent>
              <div
                ref={riderWrapRef}
                className="replay-rider-wrap flex items-center justify-center"
                style={{
                  width: RIDER_MARKER_PX,
                  height: RIDER_MARKER_PX,
                  filter: 'drop-shadow(0 2px 8px rgba(0,0,0,.55))',
                }}
              >
                {avatarResolved ? (
                  <div
                    className="box-border overflow-hidden rounded-full border-[3px] border-[#0f172a] bg-slate-800 shadow-lg"
                    style={{ width: RIDER_MARKER_PX, height: RIDER_MARKER_PX }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={encodeURI(avatarResolved)}
                      alt=""
                      width={RIDER_MARKER_PX}
                      height={RIDER_MARKER_PX}
                      className={MAP_AVATAR_THUMB_IMG_CLASS}
                      decoding="async"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
                ) : initialLetter ? (
                  <div
                    className="box-border flex items-center justify-center rounded-full border-[3px] border-[#0f172a] bg-slate-600 text-lg font-bold text-white shadow-lg"
                    style={{ width: RIDER_MARKER_PX, height: RIDER_MARKER_PX }}
                  >
                    {initialLetter}
                  </div>
                ) : (
                  <svg
                    width={RIDER_MARKER_PX}
                    height={RIDER_MARKER_PX}
                    viewBox="0 0 48 48"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden
                  >
                    <circle cx="24" cy="24" r="20" fill="#fbbf24" stroke="#0f172a" strokeWidth="3" />
                    <path
                      d="M24 12v10l6 3.5"
                      stroke="#0f172a"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle cx="24" cy="24" r="3" fill="#0f172a" />
                  </svg>
                )}
              </div>
            </MarkerContent>
          </MapMarker>
        </Map>
      </div>

      {videoUrl ? (
        <video
          ref={videoRef}
          src={videoUrl}
          playsInline
          preload="metadata"
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none fixed left-0 top-0 h-px w-px opacity-0"
        />
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <div
          className="grid grid-cols-3 gap-2 rounded-xl border border-white/5 bg-slate-900/50 px-3 py-2 text-[11px] sm:contents pointer-events-auto"
          data-guide-domain="replay_data"
          data-guide-action="hud_metrics"
          data-guide-subject="elapsed_speed_alt"
        >
          <div className="text-center sm:text-left sm:min-w-[4rem]">
            <p className="text-slate-500">Recorrido</p>
            <p className="font-mono text-amber-200/90 tabular-nums">
              {formatElapsedHhMmSsMmm(frame.elapsedSec)}
            </p>
          </div>
          <div className="text-center sm:text-left">
            <p className="text-slate-500">v</p>
            <p className="font-mono text-gdh-sun tabular-nums">{formatKmh(frame.speedKmh)}</p>
          </div>
          <div className="text-center sm:text-left">
            <p className="text-slate-500">z</p>
            <p className="font-mono text-slate-300 tabular-nums">{formatAlt(frame.altitudeM)}</p>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={togglePlay}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gdh-brand text-white hover:bg-gdh-brand-highlight"
            aria-label={playing ? 'Pausa' : 'Reproducir'}
          >
            {playing ? <Pause size={22} /> : <Play size={22} className="ml-0.5" />}
          </button>
          <input
            type="range"
            min={0}
            max={maxSlider}
            step={0.05}
            value={Math.min(sliderSec, maxSlider)}
            onChange={(e) => onSliderChange(Number(e.target.value))}
            className="min-w-[120px] flex-1 accent-[var(--gdh-brand)]"
          />
          <span className="shrink-0 font-mono text-xs text-slate-400 tabular-nums">
            {formatElapsedHhMmSsMmm(sliderSec)} / {formatElapsedHhMmSsMmm(maxSlider)}
            {videoUrl ? ' (vídeo)' : ' (GPS)'}
          </span>
        </div>
      </div>

      {!videoUrl ? (
        <p className="text-center text-xs text-slate-500">
          Sin vídeo: la línea de tiempo recorre el GPS a velocidad real al pulsar play.
        </p>
      ) : null}

      <p className="text-[11px] text-slate-500">
        El mapa usa MapLibre (mapcn). Desfase vídeo–GPS:{' '}
        <span className="font-mono text-slate-400">{videoGpsOffsetMs} ms</span>
        {videoUrl ? (
          <>
            {' '}
            · el mapa sigue <code className="text-amber-200/80">currentTime</code> del vídeo ajustado por ese valor. El
            vídeo se reproduce en «Multimedia del recorrido».
          </>
        ) : null}
      </p>
    </div>
  )
}
