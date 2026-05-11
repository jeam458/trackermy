/**
 * Map-matching tipo HMM (Viterbi en log-espacio) sobre segmentos OSM.
 * Emisión: distancia GPS → proyección. Transición: coherencia entre desplazamiento GPS y entre proyecciones.
 */

import { haversineMeters } from '@/lib/gpsRecordingMath'
import { closestPointOnSegmentMeters, type MapPathNode } from '@/lib/pathMapMatch'

export type HmmSegment = { a: MapPathNode; b: MapPathNode }

export type HmmPoint = { latitude: number; longitude: number }

export type MatchGpsToSegmentsOptions = {
  maxSnapMeters?: number
  maxCandidatesPerPoint?: number
  sigmaEmissionM?: number
  sigmaTransitionM?: number
}

function emissionLog(distM: number, sigma: number): number {
  const s = Math.max(1, sigma)
  return -(distM * distM) / (2 * s * s)
}

function transitionLog(
  prevProj: MapPathNode,
  curProj: MapPathNode,
  prevGps: HmmPoint,
  curGps: HmmPoint,
  sigma: number
): number {
  const dProj = haversineMeters(prevProj.latitude, prevProj.longitude, curProj.latitude, curProj.longitude)
  const dGps = haversineMeters(prevGps.latitude, prevGps.longitude, curGps.latitude, curGps.longitude)
  const diff = Math.abs(dProj - dGps)
  const s = Math.max(3, sigma)
  return -(diff * diff) / (2 * s * s)
}

function collectCandidates(
  lat: number,
  lng: number,
  segments: HmmSegment[],
  maxM: number,
  K: number
): Array<{ segIndex: number; projected: MapPathNode; distM: number }> {
  const hits: Array<{ segIndex: number; projected: MapPathNode; distM: number }> = []
  for (let i = 0; i < segments.length; i++) {
    const { a, b } = segments[i]!
    const { clat, clng, distM } = closestPointOnSegmentMeters(a, b, lat, lng)
    if (distM <= maxM) {
      hits.push({ segIndex: i, projected: { latitude: clat, longitude: clng }, distM })
    }
  }
  hits.sort((x, y) => x.distM - y.distM)
  return hits.slice(0, K)
}

/** Filtra segmentos cuyo punto medio cae cerca del bbox del trazo (+ margen). */
export function filterSegmentsNearTrack(
  segments: HmmSegment[],
  points: HmmPoint[],
  marginDeg = 0.0025
): HmmSegment[] {
  if (segments.length === 0 || points.length === 0) return segments
  let minLat = Infinity
  let maxLat = -Infinity
  let minLng = Infinity
  let maxLng = -Infinity
  for (const p of points) {
    minLat = Math.min(minLat, p.latitude)
    maxLat = Math.max(maxLat, p.latitude)
    minLng = Math.min(minLng, p.longitude)
    maxLng = Math.max(maxLng, p.longitude)
  }
  minLat -= marginDeg
  maxLat += marginDeg
  minLng -= marginDeg
  maxLng += marginDeg
  return segments.filter((s) => {
    const mlat = (s.a.latitude + s.b.latitude) / 2
    const mlng = (s.a.longitude + s.b.longitude) / 2
    return mlat >= minLat && mlat <= maxLat && mlng >= minLng && mlng <= maxLng
  })
}

/**
 * Ajusta una secuencia de puntos GPS a la red de segmentos dada (p. ej. OSM cacheado).
 * Si no hay candidatos en un instante, mantiene el GPS original en ese instante.
 */
export function matchGpsTraceToSegmentsHmm(
  points: HmmPoint[],
  segments: HmmSegment[],
  opts: MatchGpsToSegmentsOptions = {}
): { snapped: MapPathNode[]; offRouteFlags: boolean[] } {
  const maxM = opts.maxSnapMeters ?? 90
  const K = opts.maxCandidatesPerPoint ?? 8
  const sigmaE = opts.sigmaEmissionM ?? 14
  const sigmaT = opts.sigmaTransitionM ?? 28

  if (points.length === 0) return { snapped: [], offRouteFlags: [] }
  if (segments.length === 0) {
    return {
      snapped: points.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
      offRouteFlags: points.map(() => true),
    }
  }

  const candPerT: Array<Array<{ segIndex: number; projected: MapPathNode; distM: number }>> = []

  for (const p of points) {
    let c = collectCandidates(p.latitude, p.longitude, segments, maxM, K)
    if (c.length === 0) {
      c = [
        {
          segIndex: -1,
          projected: { latitude: p.latitude, longitude: p.longitude },
          distM: maxM * 2.5,
        },
      ]
    }
    candPerT.push(c)
  }

  const n = points.length
  const logInf = -1e300
  const dp: number[][] = []
  const back: number[][] = []

  for (let t = 0; t < n; t++) {
    const C = candPerT[t]!.length
    dp[t] = new Array(C).fill(logInf)
    back[t] = new Array(C).fill(0)
    if (t === 0) {
      for (let j = 0; j < C; j++) {
        dp[t]![j] = emissionLog(candPerT[t]![j]!.distM, sigmaE)
      }
      continue
    }
    const prevC = candPerT[t - 1]!.length
    for (let j = 0; j < C; j++) {
      const cur = candPerT[t]![j]!
      let best = logInf
      let bestK = 0
      for (let k = 0; k < prevC; k++) {
        const prev = candPerT[t - 1]![k]!
        let logTrans: number
        if (prev.segIndex < 0 || cur.segIndex < 0) {
          logTrans = -2
        } else {
          logTrans = transitionLog(prev.projected, cur.projected, points[t - 1]!, points[t]!, sigmaT)
        }
        const score = dp[t - 1]![k]! + logTrans + emissionLog(cur.distM, sigmaE)
        if (score > best) {
          best = score
          bestK = k
        }
      }
      dp[t]![j] = best
      back[t]![j] = bestK
    }
  }

  let bestJ = 0
  let bestScore = dp[n - 1]![0]!
  for (let j = 1; j < candPerT[n - 1]!.length; j++) {
    if (dp[n - 1]![j]! > bestScore) {
      bestScore = dp[n - 1]![j]!
      bestJ = j
    }
  }

  const pathChoice: number[] = new Array(n).fill(-1)
  let j = bestJ
  for (let t = n - 1; t >= 0; t--) {
    pathChoice[t] = j
    j = t > 0 ? back[t]![j]! : 0
  }

  const snapped: MapPathNode[] = []
  const off: boolean[] = []
  for (let t = 0; t < n; t++) {
    const c = candPerT[t]!
    const idx = pathChoice[t]!
    const chosen = c[idx]!
    snapped.push({ ...chosen.projected })
    off.push(chosen.segIndex < 0 || chosen.distM > maxM * 0.82)
  }

  return { snapped, offRouteFlags: off }
}
