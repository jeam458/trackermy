import type { GuideAttemptSummary } from '@/lib/guide-ai/types'

export type GuideAttemptDbRow = {
  id: string
  route_id: string
  user_id: string
  total_time: number
  avg_speed: number
  max_speed: number
  distance: number
}

export function buildGuideAttemptSummaryFromRow(
  att: GuideAttemptDbRow,
  routeName: string | null
): GuideAttemptSummary {
  const mpsToKmh = (v: number) => (Number.isFinite(v) ? Math.round(v * 3.6 * 10) / 10 : null)
  const distM = Number(att.distance)
  return {
    attemptId: String(att.id),
    routeId: String(att.route_id),
    routeName: routeName && routeName.trim() ? routeName.trim() : null,
    totalTimeSec: Number(att.total_time),
    avgSpeedKmh: mpsToKmh(Number(att.avg_speed)),
    maxSpeedKmh: mpsToKmh(Number(att.max_speed)),
    distanceKm: Number.isFinite(distM) ? Math.round((distM / 1000) * 100) / 100 : null,
  }
}
