import { haversineMeters } from '@/lib/gpsRecordingMath'

export type MapPathNode = { latitude: number; longitude: number }

/** Acumulados en metros: cum[i] = distancia a lo largo de la ruta al nodo i */
export function cumulativeMeters(pts: MapPathNode[]): number[] {
  if (pts.length === 0) return []
  const cum: number[] = [0]
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!
    const b = pts[i]!
    const d = haversineMeters(a.latitude, a.longitude, b.latitude, b.longitude)
    cum[i] = cum[i - 1]! + d
  }
  return cum
}

export type PathSnap = {
  arclengthM: number
  distanceToPathM: number
  projected: MapPathNode
  segmentIndex: number
}

/**
 * Proyecta un punto a la polilínea: devuelve arco, distancia a la pista e índice de tramo.
 */
export function snapToPath(lat: number, lng: number, path: MapPathNode[], cum: number[]): PathSnap | null {
  if (path.length < 2 || path.length !== cum.length) return null
  let best: PathSnap | null = null
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!
    const b = path[i + 1]!
    const { segM, t, clat, clng, distM } = closestPointOnSegmentMeters(a, b, lat, lng)
    if (!best || distM < best.distanceToPathM) {
      best = {
        arclengthM: cum[i]! + segM * t,
        distanceToPathM: distM,
        projected: { latitude: clat, longitude: clng },
        segmentIndex: i,
      }
    }
  }
  return best
}

/**
 * t en [0,1] sobre el segmento; proyección aprox. en plano local (tramos < ~5 km, autopista por tramo OK).
 * Exportada para map-matching a la red vial.
 */
export function closestPointOnSegmentMeters(
  a: MapPathNode,
  b: MapPathNode,
  lat: number,
  lng: number
): { segM: number; t: number; clat: number; clng: number; distM: number } {
  const segM = haversineMeters(a.latitude, a.longitude, b.latitude, b.longitude)
  if (segM < 0.01) {
    const d0 = haversineMeters(a.latitude, a.longitude, lat, lng)
    return { segM, t: 0, clat: a.latitude, clng: a.longitude, distM: d0 }
  }
  const mPerDegLat = 111_320
  const mPerDegLng = 111_320 * Math.cos((lat * Math.PI) / 180)
  const ax = 0
  const ay = 0
  const bx =
    (b.longitude - a.longitude) * mPerDegLng
  const by = (b.latitude - a.latitude) * mPerDegLat
  const px = (lng - a.longitude) * mPerDegLng
  const py = (lat - a.latitude) * mPerDegLat
  const len2 = bx * bx + by * by
  let t = (px * bx + py * by) / len2
  t = Math.max(0, Math.min(1, t))
  const clat = a.latitude + (t * (b.latitude - a.latitude))
  const clng = a.longitude + (t * (b.longitude - a.longitude))
  const distM = haversineMeters(clat, clng, lat, lng)
  return { segM, t, clat, clng, distM }
}

/** Interpola {lat, lng} a s metros de arco desde el inicio. */
export function pointAtArclength(s: number, path: MapPathNode[], cum: number[]): MapPathNode | null {
  if (path.length < 2 || path.length !== cum.length) return null
  const total = cum[cum.length - 1]!
  if (s <= 0) return { ...path[0]! }
  if (s >= total) return { ...path[path.length - 1]! }
  let lo = 0
  let hi = cum.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (cum[mid]! <= s) lo = mid
    else hi = mid
  }
  const i = lo
  const s0 = cum[i]!
  const s1 = cum[i + 1]!
  const a = path[i]!
  const b = path[i + 1]!
  if (s1 <= s0 + 0.0001) return { ...a }
  const u = (s - s0) / (s1 - s0)
  return {
    latitude: a.latitude + u * (b.latitude - a.latitude),
    longitude: a.longitude + u * (b.longitude - a.longitude),
  }
}

export function pathTotalMeters(cum: number[]): number {
  if (cum.length === 0) return 0
  return cum[cum.length - 1]!
}
