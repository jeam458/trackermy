import type { RecordedTrackPointRow } from '@/lib/recordedTrackOverviewRows'

export interface RideMentorSegmentInsight {
  segment: number
  slopePct: number
  avgSpeedKmh: number
  recommendedMinKmh: number
  recommendedMaxKmh: number
  message: string
  priority: 'high' | 'medium' | 'low'
}

export interface RideMentorReport {
  stopRatio: number
  stopEvents: number
  avgDownhillSpeedKmh: number
  consistencyScore: number
  insights: RideMentorSegmentInsight[]
  summary: string
}

function speedRangeForSlope(slopePct: number) {
  if (slopePct <= -12) return { min: 35, max: 55 }
  if (slopePct <= -8) return { min: 28, max: 45 }
  if (slopePct <= -4) return { min: 22, max: 35 }
  return { min: 15, max: 28 }
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}

export function buildRideMentorReport(rows: RecordedTrackPointRow[], segmentsCount = 6): RideMentorReport {
  if (rows.length < 2) {
    return {
      stopRatio: 0,
      stopEvents: 0,
      avgDownhillSpeedKmh: 0,
      consistencyScore: 0,
      insights: [],
      summary: 'No hay suficientes puntos para analizar la bajada.',
    }
  }

  const totalDistance = rows[rows.length - 1]!.cumDistanceM
  const segmentSize = totalDistance > 0 ? totalDistance / segmentsCount : 0

  let stoppedMs = 0
  let movingMs = 0
  let stopEvents = 0
  let wasStopped = false
  let downhillSpeedSum = 0
  let downhillCount = 0

  for (const r of rows) {
    const dt = r.segmentDtMs ?? 0
    const speed = r.speedKmh ?? 0
    if (dt <= 0) continue
    if (speed < 3) {
      stoppedMs += dt
      if (!wasStopped) stopEvents += 1
      wasStopped = true
    } else {
      movingMs += dt
      wasStopped = false
    }
  }

  type Bucket = {
    dist: number
    dAlt: number
    speedSum: number
    speedN: number
  }

  const buckets: Bucket[] = Array.from({ length: segmentsCount }, () => ({
    dist: 0,
    dAlt: 0,
    speedSum: 0,
    speedN: 0,
  }))

  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1]!
    const curr = rows[i]!
    const segDist = Math.max(0, curr.segmentM)
    if (segDist <= 0 || segmentSize <= 0) continue
    const idx = Math.min(segmentsCount - 1, Math.floor(curr.cumDistanceM / segmentSize))

    const prevAlt = prev.altitudeM
    const currAlt = curr.altitudeM
    const dAlt =
      prevAlt != null && currAlt != null && Number.isFinite(prevAlt) && Number.isFinite(currAlt)
        ? currAlt - prevAlt
        : 0
    buckets[idx]!.dist += segDist
    buckets[idx]!.dAlt += dAlt

    if (curr.speedKmh != null && Number.isFinite(curr.speedKmh)) {
      buckets[idx]!.speedSum += curr.speedKmh
      buckets[idx]!.speedN += 1
    }

    const slopePct = segDist > 0 ? (dAlt / segDist) * 100 : 0
    if (slopePct < -2 && curr.speedKmh != null) {
      downhillSpeedSum += curr.speedKmh
      downhillCount += 1
    }
  }

  const insights: RideMentorSegmentInsight[] = []
  const segmentAverages: number[] = []

  for (let i = 0; i < buckets.length; i++) {
    const b = buckets[i]!
    if (b.dist <= 0) continue
    const slopePct = (b.dAlt / b.dist) * 100
    const avgSpeed = b.speedN > 0 ? b.speedSum / b.speedN : 0
    const { min, max } = speedRangeForSlope(slopePct)
    segmentAverages.push(avgSpeed)

    if (avgSpeed < min - 2) {
      insights.push({
        segment: i + 1,
        slopePct,
        avgSpeedKmh: avgSpeed,
        recommendedMinKmh: min,
        recommendedMaxKmh: max,
        priority: 'high',
        message: `Tramo ${i + 1}: estás por debajo de velocidad objetivo para la pendiente (${avgSpeed.toFixed(1)} km/h). Trabaja salida de curva y frenada tardía progresiva.`,
      })
    } else if (avgSpeed > max + 4) {
      insights.push({
        segment: i + 1,
        slopePct,
        avgSpeedKmh: avgSpeed,
        recommendedMinKmh: min,
        recommendedMaxKmh: max,
        priority: 'medium',
        message: `Tramo ${i + 1}: velocidad por encima del rango recomendado (${avgSpeed.toFixed(1)} km/h). Ajusta líneas y control de frenado para mantener estabilidad.`,
      })
    }
  }

  if (stopEvents >= 3 || stoppedMs > 12000) {
    insights.push({
      segment: 0,
      slopePct: 0,
      avgSpeedKmh: 0,
      recommendedMinKmh: 0,
      recommendedMaxKmh: 0,
      priority: 'high',
      message: `Detecté ${stopEvents} paradas. Reduce microfrenadas, anticipa trazada y mantén pedaleo/suelta en enlaces para conservar inercia.`,
    })
  }

  const stopRatio = stoppedMs / Math.max(1, stoppedMs + movingMs)
  const avg = segmentAverages.length
    ? segmentAverages.reduce((a, b) => a + b, 0) / segmentAverages.length
    : 0
  const variance = segmentAverages.length
    ? segmentAverages.reduce((acc, s) => acc + (s - avg) * (s - avg), 0) / segmentAverages.length
    : 0
  const stdev = Math.sqrt(variance)
  const consistencyScore = Math.round(
    100 * clamp01(1 - stdev / 18) * clamp01(1 - stopRatio * 1.6)
  )
  const avgDownhillSpeedKmh = downhillCount ? downhillSpeedSum / downhillCount : 0

  let summary = 'Bajada estable.'
  if (insights.some((i) => i.priority === 'high')) {
    summary = 'Hay oportunidades claras de mejora en tramos clave y control de ritmo.'
  } else if (insights.length > 0) {
    summary = 'Buen rendimiento general; ajusta algunos tramos para bajar tiempo.'
  }

  return {
    stopRatio,
    stopEvents,
    avgDownhillSpeedKmh,
    consistencyScore,
    insights: insights.slice(0, 6),
    summary,
  }
}
