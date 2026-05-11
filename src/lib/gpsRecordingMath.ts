/**
 * Utilidades matemáticas para grabación GPS en movilidad.
 * - Haversine (esfera)
 * - Criterios de aceptación inspirados en filtrado por incertidumbre (gating) y anti-saltos
 */

export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export type MapPointLike = {
  latitude: number
  longitude: number
  accuracy?: number
  timestamp?: Date
}

/** Velocidad implícita entre dos puntos con timestamp (m/s), o null */
export function impliedSpeedMps(a: MapPointLike, b: MapPointLike): number | null {
  if (!a.timestamp || !b.timestamp) return null
  const dt = b.timestamp.getTime() - a.timestamp.getTime()
  if (dt <= 0) return null
  const d = haversineMeters(a.latitude, a.longitude, b.latitude, b.longitude)
  return d / (dt / 1000)
}

/**
 * Rumbo inicial (0–360°) de (lat1,lng1) hacia (lat2,lng2).
 */
export function initialBearingDegrees(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const λ = ((lng2 - lng1) * Math.PI) / 180
  const y = Math.sin(λ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ)
  const θ = Math.atan2(y, x)
  return ((θ * 180) / Math.PI + 360) % 360
}

/** Diferencia angular mínima entre dos rumbos, en grados (0–180). */
export function smallestBearingDiffDegrees(a: number, b: number): number {
  let d = Math.abs(a - b) % 360
  if (d > 180) d = 360 - d
  return d
}

export type MotionEnvelopeParams = {
  /** Velocidad (m/s) del último tramo aceptado; null = sin historial (muy permisivo) */
  vLastMps: number | null
  dtSec: number
  maxSpeedMps: number
  maxAccelMps2: number
  accLastM: number
  accNextM: number
  gpsMarginK: number
  gpsMarginBaseM: number
}

/**
 * Máxima distancia (m) plausible entre el último punto y el candidato, acotada por
 * · tope de velocidad global, · aceleración máxima, · cuerda nunca > arco ≳ v·dt
 * (sobreestimación segura) y · márgenes de error GPS. Sirve de “gating” estilo
 * innovación: lecturas lejos de la envolvente se consideran poco fiables.
 */
export function maxPlausibleStepMeters(p: MotionEnvelopeParams): number {
  const { dtSec, maxSpeedMps, maxAccelMps2, accLastM, accNextM, gpsMarginK, gpsMarginBaseM } = p
  const gpsM = gpsMarginK * (accLastM + accNextM) + gpsMarginBaseM
  if (!Number.isFinite(dtSec) || dtSec <= 0) {
    return Number.POSITIVE_INFINITY
  }

  // Sin dato de tramo previo, el estado podría ser casi el de cruce: no ser demasiado estricto
  const v0 =
    p.vLastMps != null && Number.isFinite(p.vLastMps) ? Math.max(0, p.vLastMps) : maxSpeedMps
  const vCap = Math.min(maxSpeedMps, v0 + maxAccelMps2 * dtSec)
  const along = vCap * dtSec + 0.5 * maxAccelMps2 * dtSec * dtSec
  const globalCap = maxSpeedMps * dtSec + 0.5 * maxAccelMps2 * dtSec * dtSec
  let raw = Math.min(along, globalCap) + gpsM
  if (dtSec < 0.12) {
    raw = Math.max(raw, 2.5 + gpsM * 0.4)
  }
  return raw
}

/**
 * Distancia mínima entre muestras en función de la velocidad implícita del segmento (m/s):
 * en recta, con más V se acepta más separación (menos ruido); el tope en alta V se mantiene
 * moderado porque las serpentines se reforzarán con el criterio de rumbo, no con metros enormes.
 */
export function adaptiveMinDistanceMeters(
  speedMps: number | null,
  baseMin: number
): number {
  if (speedMps == null || !Number.isFinite(speedMps)) {
    return baseMin
  }
  const v = Math.max(0, speedMps)
  if (v < 0.5) return Math.max(1.0, baseMin * 0.5)
  if (v < 2) return Math.max(1.2, baseMin * 0.6)
  if (v < 6) return Math.max(2, baseMin + v * 0.08)
  if (v < 15) return Math.max(2.5, 1.3 + v * 0.14)
  return Math.min(12, 2.4 + v * 0.22)
}

/**
 * Umbral de “salto” espurio: si el desplazamiento es mucho mayor que la suma de radios de error
 * (conservador), probablemente es un outlier de multirruta o un error.
 */
export function isLikelyGpsSpike(
  prev: MapPointLike,
  next: MapPointLike,
  timeWindowMs: number
): boolean {
  if (!prev.timestamp || !next.timestamp) return false
  const dt = next.timestamp.getTime() - prev.timestamp.getTime()
  if (dt <= 0 || dt > timeWindowMs) return false
  const d = haversineMeters(prev.latitude, prev.longitude, next.latitude, next.longitude)
  const acc1 = prev.accuracy ?? 12
  const acc2 = next.accuracy ?? 12
  const margin = 3.5 * (acc1 + acc2) + 8
  return d > Math.min(160, margin) && d / (dt / 1000) > 45
}

/**
 * Combina velocidad derivada (posición/tiempo) y la reportada por el GPS (m/s).
 * Toma el máximo razonable para no subestimar la lectura cuando una de las dos va retrasada.
 */
export function mergeSpeedReadingsMps(
  derivedMps: number | null,
  deviceMps: number | null,
  maxCapMps = 55
): number | null {
  const d = derivedMps != null && Number.isFinite(derivedMps) ? derivedMps : null
  const dev = deviceMps != null && Number.isFinite(deviceMps) && deviceMps >= 0 ? deviceMps : null
  if (d == null && dev == null) return null
  if (d == null) return Math.min(dev!, maxCapMps)
  if (dev == null) return Math.min(Math.max(0, d), maxCapMps)
  return Math.min(Math.max(d, dev), maxCapMps)
}
