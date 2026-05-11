import { parseReplayGpsPoints, type ReplayGpsPoint } from '@/lib/attemptReplayGps'
import type { ReelClipSegmentV1, ReelPlanV1 } from '@/lib/reel/reelPlanTypes'

export type BuildReelPlanInput = {
  videoSourceUrl: string
  videoGpsOffsetMs: number
  gpsPointsRaw: unknown
  jumpsCount: number | null
  /** Tiempo total de bajada (s), desde BD */
  totalTimeSec: number
  /** Si el cliente conoce la duración del archivo (metadata), sirve como tope físico del archivo */
  videoDurationSec?: number | null
}

/** Inversa de gpsTimeMsFromVideoTime: instante en el vídeo (s) ↔ instante GPS (epoch ms). */
function videoSecFromGpsTimeMs(tGpsMs: number, t0Ms: number, offsetMs: number): number {
  return (tGpsMs - t0Ms + offsetMs) / 1000
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = clamp(Math.floor((sorted.length - 1) * p), 0, sorted.length - 1)
  return sorted[idx]!
}

/**
 * Tope de línea de tiempo en el archivo de vídeo: no usar solo `videoDuration` del primer frame
 * si el GPS sugiere un tramo más largo (mal sync), ni `total_time` enorme si el archivo es corto.
 */
function computeMaxVideoTimelineSec(
  points: ReplayGpsPoint[],
  offsetMs: number,
  totalTimeSec: number,
  videoDurationSec: number | null | undefined
): number {
  const fromAttempt = Math.max(4, Number(totalTimeSec) || 0)
  let fromGps = 0
  if (points.length >= 2) {
    const t0 = points[0]!.t
    const t1 = points[points.length - 1]!.t
    fromGps = Math.max(0.01, videoSecFromGpsTimeMs(t1, t0, offsetMs))
  }
  let cap = Math.min(900, Math.max(fromAttempt * 1.08, fromGps, fromGps + 1))
  if (videoDurationSec != null && Number.isFinite(videoDurationSec) && videoDurationSec > 0.5) {
    cap = Math.min(cap, videoDurationSec)
  }
  return Math.max(1, cap)
}

function pickSpeedPeakTimes(points: ReplayGpsPoint[], t0Ms: number, offsetMs: number, maxPeaks: number): number[] {
  const withSpeed = points.filter((p) => p.speedMps != null && Number.isFinite(p.speedMps) && p.speedMps > 0)
  if (withSpeed.length < 3) return []

  const speeds = withSpeed.map((p) => p.speedMps!).sort((a, b) => a - b)
  const thr = percentile(speeds, 0.68)

  const peaks: { t: number; v: number }[] = []
  for (let i = 1; i < withSpeed.length - 1; i++) {
    const a = withSpeed[i - 1]!
    const b = withSpeed[i]!
    const c = withSpeed[i + 1]!
    const vb = b.speedMps ?? 0
    if (vb < thr) continue
    if (vb >= (a.speedMps ?? 0) && vb >= (c.speedMps ?? 0)) {
      peaks.push({ t: b.t, v: vb })
    }
  }
  peaks.sort((x, y) => y.v - x.v)

  const videoTimes: number[] = []
  const minGapVideoSec = 2.4
  for (const pk of peaks) {
    const vs = videoSecFromGpsTimeMs(pk.t, t0Ms, offsetMs)
    if (!Number.isFinite(vs)) continue
    if (videoTimes.every((existing) => Math.abs(existing - vs) >= minGapVideoSec)) {
      videoTimes.push(vs)
      if (videoTimes.length >= maxPeaks) break
    }
  }
  return videoTimes
}

/** Picos por cambio brusco de velocidad entre muestras (proxy de aceleración / “eventos”). */
function pickEnergyPeakVideoTimes(
  points: ReplayGpsPoint[],
  t0Ms: number,
  offsetMs: number,
  maxVideoSec: number,
  maxPeaks: number
): number[] {
  const scores: { t: number; s: number }[] = []
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    const dt = (b.t - a.t) / 1000
    if (dt < 0.04) continue
    const va = a.speedMps ?? 0
    const vb = b.speedMps ?? 0
    const jerk = Math.abs(vb - va) / dt
    if (jerk < 1.2) continue
    scores.push({ t: b.t, s: jerk })
  }
  scores.sort((x, y) => y.s - x.s)
  const out: number[] = []
  for (const row of scores) {
    const vs = clamp(videoSecFromGpsTimeMs(row.t, t0Ms, offsetMs), 0, maxVideoSec)
    if (!Number.isFinite(vs)) continue
    if (out.every((x) => Math.abs(x - vs) >= 2.1)) {
      out.push(vs)
      if (out.length >= maxPeaks) break
    }
  }
  return out
}

function syntheticJumpVideoTimes(
  jumps: number,
  t0Ms: number,
  t1Ms: number,
  offsetMs: number,
  maxExtra: number,
  maxVideoSec: number
): number[] {
  if (jumps <= 0 || maxExtra <= 0) return []
  const n = Math.min(jumps, maxExtra, 6)
  const out: number[] = []
  const g0 = clamp(videoSecFromGpsTimeMs(t0Ms, t0Ms, offsetMs), 0, maxVideoSec)
  const g1 = clamp(videoSecFromGpsTimeMs(t1Ms, t0Ms, offsetMs), 0, maxVideoSec)
  const span = Math.max(0.15, g1 - g0)
  const lo = g0 + span * 0.12
  const hi = g0 + span * 0.9
  for (let i = 0; i < n; i++) {
    const f = (i + 1) / (n + 1)
    out.push(clamp(lo + (hi - lo) * f, 0, maxVideoSec))
  }
  return out
}

function mergeUniqueSortedTimes(times: number[], minGap: number, maxVideoSec: number): number[] {
  const s = [...new Set(times.map((t) => clamp(t, 0, maxVideoSec)))]
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b)
  const out: number[] = []
  for (const t of s) {
    if (out.length === 0 || t - out[out.length - 1]! >= minGap) out.push(t)
  }
  return out
}

function fillStrategicGaps(
  existing: number[],
  maxVideoSec: number,
  targetCount: number,
  minGap: number
): number[] {
  const sorted = mergeUniqueSortedTimes(existing, minGap, maxVideoSec)
  if (sorted.length >= targetCount) return sorted.slice(0, targetCount)
  const extra: number[] = [...sorted]
  const slots = Math.max(2, targetCount - sorted.length)
  for (let k = 1; k <= slots; k++) {
    const t = (maxVideoSec * k) / (slots + 1)
    if (extra.every((e) => Math.abs(e - t) >= minGap * 0.85)) extra.push(t)
  }
  return mergeUniqueSortedTimes(extra, minGap * 0.85, maxVideoSec).slice(0, targetCount)
}

/**
 * Heurística v2: tope de tiempo alineado GPS + archivo; picos de velocidad + “energía” + saltos;
 * reparto extra en el eje del vídeo si hacen falta momentos. Listo para enriquecer con IA de visión en servidor.
 */
export function buildReelPlanFromAttempt(input: BuildReelPlanInput): ReelPlanV1 {
  const notes: string[] = []
  const offsetMs = Number.isFinite(input.videoGpsOffsetMs) ? Math.round(input.videoGpsOffsetMs) : 0
  const points = parseReplayGpsPoints(input.gpsPointsRaw)
  const maxVideoSec = computeMaxVideoTimelineSec(points, offsetMs, input.totalTimeSec, input.videoDurationSec)

  const segments: ReelClipSegmentV1[] = []
  let id = 0
  const nextId = () => `c${++id}`

  const pushClip = (label: string, start: number, end: number, rate: number) => {
    const a = clamp(Math.min(start, end), 0, maxVideoSec)
    const b = clamp(Math.max(start, end), 0, maxVideoSec)
    if (b - a < 0.12) return
    segments.push({
      type: 'clip',
      id: nextId(),
      label,
      srcStartSec: a,
      srcEndSec: b,
      playbackRate: clamp(rate, 0.2, 2),
    })
  }

  if (points.length >= 4) {
    const t0 = points[0]!.t
    const t1 = points[points.length - 1]!.t

    const speedPeaks = pickSpeedPeakTimes(points, t0, offsetMs, 6)
    const energyPeaks = pickEnergyPeakVideoTimes(points, t0, offsetMs, maxVideoSec, 6)
    let merged = mergeUniqueSortedTimes([...speedPeaks, ...energyPeaks], 2.2, maxVideoSec)

    if (merged.length < 3 && (input.jumpsCount ?? 0) > 0) {
      merged = mergeUniqueSortedTimes(
        [...merged, ...syntheticJumpVideoTimes(input.jumpsCount ?? 0, t0, t1, offsetMs, 5, maxVideoSec)],
        2.2,
        maxVideoSec
      )
      notes.push('Momentos sintéticos a partir de jumps_count (pocos picos en GPS).')
    }

    merged = fillStrategicGaps(merged, maxVideoSec, Math.min(8, Math.max(4, Math.ceil(maxVideoSec / 22))), 2.1)
    merged.sort((a, b) => a - b)

    notes.push(
      'Eventos por telemetría (velocidad + cambios bruscos + reparto en el eje del vídeo). IA de visión puede sustituir esta heurística en backend.'
    )

    const introEnd = clamp(Math.min(2.2, maxVideoSec * 0.08), 0.2, maxVideoSec * 0.14)
    pushClip('Apertura', 0, introEnd, 1)

    const half = clamp(1.15 + maxVideoSec * 0.02, 1.05, 2.2)
    const slowRate = clamp(0.38 + 0.08 / Math.max(8, merged.length), 0.28, 0.48)
    for (let i = 0; i < merged.length; i++) {
      const center = merged[i]!
      pushClip(`Evento ${i + 1}`, center - half, center + half, slowRate)
    }

    const outroLen = clamp(2.8, 0.4, maxVideoSec * 0.12)
    const outStart = clamp(maxVideoSec - outroLen, introEnd + 0.35, maxVideoSec - 0.15)
    pushClip('Cierre', outStart, maxVideoSec, 1)
  } else {
    notes.push('GPS insuficiente: plan por duración del archivo / intento.')
    const intro = Math.min(2.4, maxVideoSec * 0.09)
    const midCount = Math.min(4, Math.max(1, Math.floor(maxVideoSec / 25)))
    pushClip('Apertura', 0, intro, 1)
    for (let m = 0; m < midCount; m++) {
      const slice = maxVideoSec / (midCount + 1)
      const lo = intro + m * slice * 0.85
      const hi = Math.min(maxVideoSec - 2.5, lo + slice * 0.55)
      if (hi > lo + 0.2) pushClip(`Tramo ${m + 1}`, lo, hi, m % 2 === 0 ? 0.5 : 1)
    }
    pushClip('Cierre', Math.max(intro + 0.15, maxVideoSec - 2.6), maxVideoSec, 1)
  }

  let totalPlayback = 0
  for (const s of segments) {
    totalPlayback += (s.srcEndSec - s.srcStartSec) / s.playbackRate
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    videoSourceUrl: input.videoSourceUrl,
    planSource: 'gps_heuristic',
    totalPlaybackEstimateSec: Math.round(totalPlayback * 10) / 10,
    segments,
    notes: notes.length ? notes : undefined,
  }
}
