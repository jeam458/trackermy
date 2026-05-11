import { haversineMeters } from '@/lib/gpsRecordingMath'
import type { MapPoint } from '@/hooks/useGPSRecorder'

export interface RecordedTrackPointRow {
  index: number
  /** Segundos desde el primer punto */
  timeOffsetSec: number | null
  /** Metros recorridos desde el inicio (polilínea) */
  cumDistanceM: number
  /** Metros del tramo previo → este */
  segmentM: number
  /** Velocidad del tramo (m/s), null en índice 0 */
  speedMps: number | null
  /** Velocidad en km/h */
  speedKmh: number | null
  precisiónM: number | null
  altitudeM: number | null
  latitude: number
  longitude: number
  /** 0–360, null en índice 0 */
  bearingDeg: number | null
  /** Etiqueta N / NE / E … */
  directionLabel: string | null
  /** ms entre el punto anterior y este */
  segmentDtMs: number | null
}

const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const

export function directionFromBearing(deg: number | null): string | null {
  if (deg === null || Number.isNaN(deg)) return null
  const idx = Math.round(deg / 45) % 8
  return DIRS[idx]!
}

/**
 * Rumbo (acimut) de (lat1,lng1) a (lat2,lng2) en grados [0,360)
 */
function bearingBetween(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  const θ = Math.atan2(y, x)
  return ((θ * 180) / Math.PI + 360) % 360
}

/**
 * Construye filas con métricas por muestra a partir del array grabado.
 */
export function buildRecordedTrackRows(points: MapPoint[]): RecordedTrackPointRow[] {
  if (points.length === 0) return []

  const t0 = points[0]!.timestamp?.getTime() ?? null
  const rows: RecordedTrackPointRow[] = []
  let cum = 0

  for (let i = 0; i < points.length; i++) {
    const p = points[i]!
    const prev = i > 0 ? points[i - 1]! : null

    let segmentM = 0
    let speedMps: number | null = null
    let segmentDtMs: number | null = null
    let bearingDeg: number | null = null

    if (prev) {
      segmentM = haversineMeters(
        prev.latitude,
        prev.longitude,
        p.latitude,
        p.longitude
      )
      cum += segmentM
      if (p.timestamp && prev.timestamp) {
        segmentDtMs = p.timestamp.getTime() - prev.timestamp.getTime()
        if (segmentDtMs > 0) {
          speedMps = segmentM / (segmentDtMs / 1000)
        }
      }
      bearingDeg = bearingBetween(
        prev.latitude,
        prev.longitude,
        p.latitude,
        p.longitude
      )
    }

    const timeOffsetSec =
      t0 !== null && p.timestamp
        ? (p.timestamp.getTime() - t0) / 1000
        : null

    const fromSegKmh = speedMps != null ? speedMps * 3.6 : null
    const fromDeviceKmh =
      p.speed != null && p.speed > 0 ? p.speed * 3.6 : null
    let speedKmh: number | null
    if (i === 0) {
      speedKmh = fromDeviceKmh
    } else if (fromSegKmh != null && fromDeviceKmh != null) {
      speedKmh = Math.max(fromSegKmh, fromDeviceKmh)
    } else {
      speedKmh = fromSegKmh ?? fromDeviceKmh ?? null
    }

    rows.push({
      index: i,
      timeOffsetSec,
      cumDistanceM: cum,
      segmentM,
      speedMps,
      speedKmh,
      precisiónM: p.accuracy ?? null,
      altitudeM: p.altitude ?? null,
      latitude: p.latitude,
      longitude: p.longitude,
      bearingDeg,
      directionLabel: directionFromBearing(bearingDeg),
      segmentDtMs,
    })
  }

  return rows
}

export function maxSpeedKmhFromRows(rows: RecordedTrackPointRow[]): number | null {
  let m = 0
  let any = false
  for (const r of rows) {
    if (r.speedKmh != null && r.speedKmh > m) {
      m = r.speedKmh
      any = true
    }
  }
  return any ? m : null
}

export function avgSpeedKmhFromTrack(distanceM: number, elapsedSec: number): number | null {
  if (elapsedSec <= 0 || distanceM <= 0) return null
  const mps = distanceM / elapsedSec
  return mps * 3.6
}
