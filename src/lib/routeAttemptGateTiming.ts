import { haversineMeters, impliedSpeedMps } from '@/lib/gpsRecordingMath'
import type { GPSPoint } from '@/services/RoutePerformanceService'

/** Puntos con tiempo para medir aproximación a meta (compatible con MapPoint). */
export type GateTimingPoint = {
  latitude: number
  longitude: number
  timestamp?: Date
  speed?: number
}

/** Metadatos de desfase salida / aproximación meta al grabar un intento. */
export type RouteAttemptGateTiming = {
  /** ms desde `startRecording()` hasta cruzar el radio de salida (reloj de pared). */
  startOffsetWallMs: number
  /** ms desde `startRecording()` hasta el timestamp GPS del fix que abrió la salida. */
  startOffsetGpsMs: number
  /**
   * ms desde el último fix fuera del radio de meta hasta el cruce estimado en la meta exacta:
   * último timestamp + (distancia restante / velocidad), acotado.
   */
  finishApproachMs: number | null
}

const MIN_SPEED_MPS = 0.45
const MAX_SPEED_MPS = 42
const MAX_EXTRAP_SEC = 14

function inferApproachSpeedMps(points: GateTimingPoint[]): number {
  if (points.length < 2) return MIN_SPEED_MPS
  const last = points[points.length - 1]!
  const prev = points[points.length - 2]!
  const impl = impliedSpeedMps(
    {
      latitude: prev.latitude,
      longitude: prev.longitude,
      timestamp: prev.timestamp,
    },
    {
      latitude: last.latitude,
      longitude: last.longitude,
      timestamp: last.timestamp,
    }
  )
  if (impl != null && Number.isFinite(impl) && impl >= MIN_SPEED_MPS && impl <= MAX_SPEED_MPS) {
    return impl
  }
  if (typeof last.speed === 'number' && Number.isFinite(last.speed) && last.speed >= MIN_SPEED_MPS) {
    return Math.min(MAX_SPEED_MPS, last.speed)
  }
  return MIN_SPEED_MPS
}

export function computeFinishApproachMs(
  points: GateTimingPoint[],
  endLat: number,
  endLng: number,
  radiusM: number
): number | null {
  if (points.length < 2) return null
  let lastOutsideIdx = -1
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!
    const d = haversineMeters(p.latitude, p.longitude, endLat, endLng)
    if (d > radiusM) lastOutsideIdx = i
  }
  if (lastOutsideIdx < 0) return null
  const last = points[points.length - 1]!
  const out = points[lastOutsideIdx]!
  const outTs = out.timestamp?.getTime()
  const lastTs = last.timestamp?.getTime()
  if (lastTs == null || outTs == null) return null

  const dLast = haversineMeters(last.latitude, last.longitude, endLat, endLng)
  const v = inferApproachSpeedMps(points)
  const extrapSec = Math.min(MAX_EXTRAP_SEC, dLast / v)
  const virtualEndTs = lastTs + extrapSec * 1000
  const span = virtualEndTs - outTs
  return span >= 0 ? span : null
}

/**
 * Añade un punto sintético en la meta publicada con timestamp extrapolado (distancia/v)
 * para que `total_time` y velocidades medias reflejen el cierre hasta la meta exacta.
 */
export function appendExtrapolatedFinishMetaGps(
  points: GPSPoint[],
  endLat: number,
  endLng: number,
  radiusM: number
): GPSPoint[] {
  if (points.length < 1) return points
  const last = points[points.length - 1]!
  const dLast = haversineMeters(last.latitude, last.longitude, endLat, endLng)
  if (dLast <= 0.35 || dLast > radiusM) return points

  const gatePts: GateTimingPoint[] = points.map((p) => ({
    latitude: p.latitude,
    longitude: p.longitude,
    timestamp: p.timestamp,
    speed: p.speed ?? undefined,
  }))
  const v = inferApproachSpeedMps(gatePts)
  const extrapSec = Math.min(MAX_EXTRAP_SEC, dLast / v)
  const nextTs = new Date(last.timestamp.getTime() + extrapSec * 1000)

  return [
    ...points,
    {
      latitude: endLat,
      longitude: endLng,
      altitude: last.altitude,
      speed: v,
      timestamp: nextTs,
      accuracy: last.accuracy,
    },
  ]
}
