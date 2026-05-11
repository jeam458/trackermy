/**
 * Velocidades en BD: `route_attempts.max_speed` / `avg_speed` están en m/s.
 * Los GPS pueden devolver picos irreales; aquí acotamos y, si hay `gps_points`,
 * preferimos métricas derivadas de tramos razonables.
 */

import { haversineMeters } from './attemptReplayGps'

/**
 * Tope duro (m/s) para descartar picos GPS/ruido. Incluye BTT y **motos** (autopista / circuito);
 * por encima = casi siempre error (p. ej. ~1700 km/h). ~95 m/s ≈ 342 km/h.
 */
export const PLAUSIBLE_MAX_MPS = 95

export function clampMps(mps: number): number {
  if (!Number.isFinite(mps)) return 0
  return Math.min(Math.max(0, mps), PLAUSIBLE_MAX_MPS)
}

export function mpsToKmh(mps: number): number {
  return mps * 3.6
}

/** m/s almacenados → km/h para UI, con tope anti-outliers */
export function formatSpeedKmhFromStoredMps(mps: number | null | undefined): string {
  if (mps == null || !Number.isFinite(Number(mps))) return '—'
  return `${mpsToKmh(clampMps(Number(mps))).toFixed(1)} km/h`
}

export type GpsDerivedSpeedStats = {
  minKmh: number
  maxKmh: number
  avgKmh: number
  /** km/h desde el valor agregado guardado, solo referencia */
  storedMaxKmh: number
  storedAvgKmh: number
}

function parseGpsTimestamps(raw: unknown): { lat: number; lng: number; t: number; speed?: number }[] {
  if (!Array.isArray(raw)) return []
  const out: { lat: number; lng: number; t: number; speed?: number }[] = []
  for (const p of raw) {
    if (!p || typeof p !== 'object') continue
    const o = p as Record<string, unknown>
    const lat = Number(o.latitude)
    const lng = Number(o.longitude)
    const ts = o.timestamp
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    let t: number
    if (typeof ts === 'string') t = Date.parse(ts)
    else if (typeof ts === 'number') t = ts
    else continue
    if (!Number.isFinite(t)) continue
    const sp = o.speed
    const row: { lat: number; lng: number; t: number; speed?: number } = { lat, lng, t }
    if (typeof sp === 'number' && Number.isFinite(sp)) row.speed = sp
    out.push(row)
  }
  out.sort((a, b) => a.t - b.t)
  return out
}

/**
 * min / max / avg en km/h desde tramos GPS (excluye tramos > PLAUSIBLE_MAX_MPS).
 * avg = distancia total / tiempo total del track.
 */
export function speedStatsFromGpsJson(gps: unknown): Omit<GpsDerivedSpeedStats, 'storedMaxKmh' | 'storedAvgKmh'> | null {
  const pts = parseGpsTimestamps(gps)
  if (pts.length < 2) return null

  let totalM = 0
  const segMps: number[] = []
  const MIN_DT = 0.04

  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!
    const b = pts[i]!
    const dt = (b.t - a.t) / 1000
    if (dt < MIN_DT) continue
    const d = haversineMeters(a.lat, a.lng, b.lat, b.lng)
    totalM += d
    const v = d / dt
    if (Number.isFinite(v) && v <= PLAUSIBLE_MAX_MPS) segMps.push(v)
  }

  for (const p of pts) {
    if (p.speed != null && p.speed > 0 && p.speed <= PLAUSIBLE_MAX_MPS) {
      segMps.push(p.speed)
    }
  }

  const t0 = pts[0]!.t
  const t1 = pts[pts.length - 1]!.t
  const totalSec = Math.max(0.001, (t1 - t0) / 1000)
  const avgMps = totalM / totalSec
  const avgKmh = mpsToKmh(Math.min(avgMps, PLAUSIBLE_MAX_MPS))

  if (segMps.length === 0) {
    return {
      minKmh: avgKmh,
      maxKmh: avgKmh,
      avgKmh,
    }
  }

  const moving = segMps.filter((s) => s >= 0.5)
  const minM = moving.length > 0 ? Math.min(...moving) : Math.min(...segMps)
  const maxM = Math.max(...segMps)
  return {
    minKmh: mpsToKmh(minM),
    maxKmh: mpsToKmh(maxM),
    avgKmh,
  }
}

/** Preferir stats GPS; si no, solo acotar agregados de BD */
export function displaySpeedTriple(
  gps: unknown,
  storedMaxMps: number | null | undefined,
  storedAvgMps: number | null | undefined
): {
  minKmh: string
  maxKmh: string
  avgKmh: string
  source: 'gps' | 'stored'
} {
  const derived = speedStatsFromGpsJson(gps)
  if (derived) {
    return {
      minKmh: `${derived.minKmh.toFixed(1)} km/h`,
      maxKmh: `${derived.maxKmh.toFixed(1)} km/h`,
      avgKmh: `${derived.avgKmh.toFixed(1)} km/h`,
      source: 'gps',
    }
  }
  const maxK = formatSpeedKmhFromStoredMps(storedMaxMps ?? null)
  const avgK = formatSpeedKmhFromStoredMps(storedAvgMps ?? null)
  return {
    minKmh: '—',
    maxKmh: maxK,
    avgKmh: avgK,
    source: 'stored',
  }
}

/** Para estadísticas agregadas (RPC) donde solo hay un escalar en m/s */
export function formatAggregatedMaxRecordedSpeedMps(mps: number | null | undefined): string {
  return formatSpeedKmhFromStoredMps(mps)
}
