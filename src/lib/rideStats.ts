/**
 * Métricas derivadas de intentos / puntos GPS (velocidades en m/s en BD).
 */

import { clampMps } from '@/lib/attemptSpeedDisplay'

export type GpsPointLike = {
  speed?: number
  latitude?: number
  longitude?: number
  altitude?: number
}

/** km/h desde m/s */
export function msToKmh(ms: number): number {
  return ms * 3.6
}

/**
 * BD guarda max_speed / avg_speed en m/s (puede haber picos espurios). Acota antes de mostrar o agregar.
 */
export function kmhFromStoredSpeedMps(raw: unknown): number {
  const n = typeof raw === 'string' ? parseFloat(raw) : Number(raw)
  if (!Number.isFinite(n)) return 0
  return msToKmh(clampMps(n))
}

/**
 * Estimación muy aproximada de calorías (DH / MTB intenso).
 * MET ~10, sin desnivel explícito en la fórmula.
 */
export function estimateRideCaloriesKcal(params: {
  movingTimeSec: number
  weightKg?: number | null
  met?: number
}): number | null {
  const w = params.weightKg
  if (w == null || !Number.isFinite(w) || w <= 0) return null
  const hours = params.movingTimeSec / 3600
  if (!Number.isFinite(hours) || hours <= 0) return null
  const met = params.met ?? 10
  return Math.round(met * w * hours)
}

/** Mínima velocidad “en movimiento” a partir de GPS (m/s). */
export function minMovingSpeedMpsFromGps(
  gpsPoints: unknown,
  movingThresholdMps = 0.5
): number | null {
  if (!Array.isArray(gpsPoints) || gpsPoints.length === 0) return null
  const speeds: number[] = []
  for (const p of gpsPoints) {
    if (typeof p !== 'object' || !p) continue
    const s = clampMps(Number((p as GpsPointLike).speed))
    if (Number.isFinite(s) && s >= movingThresholdMps) speeds.push(s)
  }
  if (speeds.length === 0) return null
  return Math.min(...speeds)
}

export function formatDurationSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '—'
  const s = Math.floor(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
  return `${m}:${String(r).padStart(2, '0')}`
}
