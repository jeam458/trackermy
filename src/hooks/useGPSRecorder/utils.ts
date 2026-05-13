import { haversineMeters, impliedSpeedMps } from '@/lib/gpsRecordingMath'
import type { MapPoint } from './types'

export function calculateSpeed(point1: MapPoint, point2: MapPoint): number | null {
  return impliedSpeedMps(point1, point2)
}

export function mergeClosingFix(base: MapPoint[], final: MapPoint | null): MapPoint[] {
  if (!final) return base
  if (base.length === 0) {
    return [{ ...final, timestamp: final.timestamp ?? new Date() }]
  }
  const last = base[base.length - 1]
  const d = haversineMeters(last.latitude, last.longitude, final.latitude, final.longitude)
  const t = final.timestamp ?? new Date()
  if (d < 1) {
    return [...base.slice(0, -1), { ...final, timestamp: t }]
  }
  return [...base, { ...final, timestamp: t }]
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`
  }
  return `${meters.toFixed(0)} m`
}

export function formatSpeed(ms: number): string {
  return `${(ms * 3.6).toFixed(1)} km/h`
}
