import type { RecordedTrackPointRow } from '@/lib/recordedTrackOverviewRows'

export interface SpeedSegment {
  index: number
  label: string
  maxSpeedKmh: number
  /** 0–1, centro del tramo a lo largo del recorrido */
  centerProgress: number
}

export interface DetailedRideSegment {
  index: number
  startDistanceM: number
  endDistanceM: number
  distanceM: number
  elevationDeltaM: number
  slopePct: number
  avgSpeedKmh: number
  maxSpeedKmh: number
  targetMinKmh: number
  targetMaxKmh: number
  safeMaxKmh: number
  segmentTimeSec: number
  points: Array<{ latitude: number; longitude: number }>
}

function speedRangeForSlope(slopePct: number) {
  if (slopePct <= -12) return { min: 35, max: 55 }
  if (slopePct <= -8) return { min: 28, max: 45 }
  if (slopePct <= -4) return { min: 22, max: 35 }
  return { min: 15, max: 28 }
}

function safeMaxForSlope(slopePct: number) {
  if (slopePct <= -16) return 62
  if (slopePct <= -12) return 58
  if (slopePct <= -8) return 52
  if (slopePct <= -4) return 42
  return 34
}

/**
 * Recorre el trazado en `count` tramos por distancia acumulada y toma V máx. en cada tramo.
 */
export function buildSpeedSegments(rows: RecordedTrackPointRow[], count: number): SpeedSegment[] {
  if (rows.length < 2 || count < 1) return []
  const last = rows[rows.length - 1]!
  const totalD = last.cumDistanceM
  if (totalD <= 0) return []

  const segments: SpeedSegment[] = []
  for (let s = 0; s < count; s++) {
    const t0 = (s / count) * totalD
    const t1 = ((s + 1) / count) * totalD
    let maxV = 0
    for (const r of rows) {
      if (r.cumDistanceM - t0 >= -0.01 && r.cumDistanceM <= t1 + 0.05 && r.speedKmh != null) {
        if (r.speedKmh > maxV) maxV = r.speedKmh
      }
    }
    segments.push({
      index: s,
      label: `T${s + 1}`,
      maxSpeedKmh: maxV,
      centerProgress: (s + 0.5) / count,
    })
  }
  return segments
}

export function scaleForSegmentBars(segments: SpeedSegment[]): number {
  return Math.max(30, ...segments.map((s) => s.maxSpeedKmh), 1)
}

/**
 * Segmentación detallada por distancia para análisis técnico accionable.
 */
export function buildDetailedRideSegments(
  rows: RecordedTrackPointRow[],
  count: number
): DetailedRideSegment[] {
  if (rows.length < 2 || count < 1) return []
  const totalD = rows[rows.length - 1]!.cumDistanceM
  if (totalD <= 0) return []
  const segLen = totalD / count
  const out: DetailedRideSegment[] = []

  for (let s = 0; s < count; s++) {
    const d0 = s * segLen
    const d1 = (s + 1) * segLen
    const inSeg = rows.filter((r) => r.cumDistanceM >= d0 - 0.05 && r.cumDistanceM <= d1 + 0.05)
    if (inSeg.length < 2) continue

    const first = inSeg[0]!
    const last = inSeg[inSeg.length - 1]!
    const distM = Math.max(1, last.cumDistanceM - first.cumDistanceM)
    const elevA = first.altitudeM ?? 0
    const elevB = last.altitudeM ?? elevA
    const dAlt = elevB - elevA
    const slopePct = (dAlt / distM) * 100

    let speedSum = 0
    let speedN = 0
    let maxV = 0
    let segMs = 0
    for (const r of inSeg) {
      if (r.speedKmh != null && Number.isFinite(r.speedKmh)) {
        speedSum += r.speedKmh
        speedN += 1
        if (r.speedKmh > maxV) maxV = r.speedKmh
      }
      segMs += Math.max(0, r.segmentDtMs ?? 0)
    }
    const avgV = speedN > 0 ? speedSum / speedN : 0
    const target = speedRangeForSlope(slopePct)

    out.push({
      index: s,
      startDistanceM: d0,
      endDistanceM: d1,
      distanceM: distM,
      elevationDeltaM: dAlt,
      slopePct,
      avgSpeedKmh: avgV,
      maxSpeedKmh: maxV,
      targetMinKmh: target.min,
      targetMaxKmh: target.max,
      safeMaxKmh: safeMaxForSlope(slopePct),
      segmentTimeSec: segMs / 1000,
      points: inSeg.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
    })
  }

  return out
}
