/** Punto GPS normalizado para replay (ms epoch). `speed` en m/s si existe. */
export type ReplayGpsPoint = {
  lat: number
  lng: number
  t: number
  altitudeM?: number
  /** m/s reportado por el dispositivo, si existe */
  speedMps?: number
}

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function mpsToKmh(mps: number | null | undefined): number | null {
  if (mps == null || !Number.isFinite(mps)) return null
  return mps * 3.6
}

export type InterpolatedReplayFrame = {
  lat: number
  lng: number
  /** Instante GPS (ms epoch), el mismo eje que los puntos del intento */
  tMs: number
  /** Segundos desde el primer muestreo del intento (t0) */
  elapsedSec: number
  altitudeM: number | null
  /** km/h (interpolada o por tramo) */
  speedKmh: number | null
}

export function parseReplayGpsPoints(raw: unknown): ReplayGpsPoint[] {
  if (!Array.isArray(raw)) return []
  const out: ReplayGpsPoint[] = []
  for (const p of raw) {
    if (!p || typeof p !== 'object') continue
    const o = p as Record<string, unknown>
    const lat = Number(o.latitude)
    const lng = Number(o.longitude)
    const ts = o.timestamp
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    let t: number
    if (typeof ts === 'string') {
      t = Date.parse(ts)
    } else if (typeof ts === 'number') {
      t = ts
    } else {
      continue
    }
    if (!Number.isFinite(t)) continue
    const rawAlt = o.altitude
    const rawSpd = o.speed
    const pt: ReplayGpsPoint = { lat, lng, t }
    if (typeof rawAlt === 'number' && Number.isFinite(rawAlt)) pt.altitudeM = rawAlt
    if (typeof rawSpd === 'number' && Number.isFinite(rawSpd)) pt.speedMps = rawSpd
    out.push(pt)
  }
  out.sort((a, b) => a.t - b.t)
  return out
}

/** Posición 2D en el instante tMs (ms epoch), interpolada entre muestreos. */
export function interpolateReplayPosition(points: ReplayGpsPoint[], tMs: number): [number, number] {
  const f = interpolateReplayFrame(points, tMs, points[0]?.t ?? tMs)
  return [f.lat, f.lng]
}

/**
 * Estado en el instante tMs: posición, tiempo de recorrido, velocidad y cota interpoladas
 * cuando el JSON trae `speed` / `altitude` por punto.
 */
export function interpolateReplayFrame(
  points: ReplayGpsPoint[],
  tMs: number,
  t0ForElapsed: number
): InterpolatedReplayFrame {
  const elapsedSec = Math.max(0, (tMs - t0ForElapsed) / 1000)

  if (points.length === 0) {
    return { lat: 0, lng: 0, tMs, elapsedSec, altitudeM: null, speedKmh: null }
  }
  if (points.length === 1) {
    const p = points[0]!
    return {
      lat: p.lat,
      lng: p.lng,
      tMs,
      elapsedSec,
      altitudeM: p.altitudeM != null ? p.altitudeM : null,
      speedKmh: mpsToKmh(p.speedMps),
    }
  }
  if (tMs <= points[0]!.t) {
    const p = points[0]!
    return {
      lat: p.lat,
      lng: p.lng,
      tMs,
      elapsedSec: 0,
      altitudeM: p.altitudeM != null ? p.altitudeM : null,
      speedKmh: mpsToKmh(p.speedMps),
    }
  }
  const last = points[points.length - 1]!
  if (tMs >= last.t) {
    return {
      lat: last.lat,
      lng: last.lng,
      tMs,
      elapsedSec: Math.max(0, (tMs - t0ForElapsed) / 1000),
      altitudeM: last.altitudeM != null ? last.altitudeM : null,
      speedKmh: mpsToKmh(last.speedMps),
    }
  }

  let lo = 0
  let hi = points.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (points[mid]!.t <= tMs) lo = mid
    else hi = mid
  }
  const a = points[lo]!
  const b = points[hi]!
  const dt = b.t - a.t
  const f = dt > 0 ? (tMs - a.t) / dt : 0
  const lat = a.lat + (b.lat - a.lat) * f
  const lng = a.lng + (b.lng - a.lng) * f

  let altitudeM: number | null = null
  if (a.altitudeM != null && b.altitudeM != null) {
    altitudeM = a.altitudeM + (b.altitudeM - a.altitudeM) * f
  } else if (a.altitudeM != null) {
    altitudeM = a.altitudeM
  } else if (b.altitudeM != null) {
    altitudeM = b.altitudeM
  }

  let speedKmh: number | null = null
  if (a.speedMps != null && b.speedMps != null && dt > 0) {
    speedKmh = mpsToKmh(a.speedMps + (b.speedMps - a.speedMps) * f)
  } else if (a.speedMps != null) {
    speedKmh = mpsToKmh(a.speedMps)
  } else if (b.speedMps != null) {
    speedKmh = mpsToKmh(b.speedMps)
  } else if (dt > 0) {
    const dM = haversineMeters(a.lat, a.lng, b.lat, b.lng)
    speedKmh = mpsToKmh((dM / (dt / 1000)) as number)
  }

  return { lat, lng, tMs, elapsedSec: Math.max(0, (tMs - t0ForElapsed) / 1000), altitudeM, speedKmh }
}

/** t_gps = t0 + videoSeconds * 1000 - offsetMs */
export function gpsTimeMsFromVideoTime(t0Ms: number, videoSeconds: number, offsetMs: number): number {
  return t0Ms + videoSeconds * 1000 - offsetMs
}
