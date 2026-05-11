import { clampMps, mpsToKmh, speedStatsFromGpsJson } from '@/lib/attemptSpeedDisplay'
import { interpolate } from '@/messages/interpolate'
import type { AppMessages } from '@/messages/types'

export type AttemptRowLite = {
  id: string
  route_id: string
  user_id: string
  total_time: number
  max_speed: number | null
  avg_speed: number | null
  overall_score: number | null
  distance: number
  gps_points: unknown
  completed_at: string
  is_public: boolean
}

export type TrendPoint = {
  label: string
  km: number
  avgKmh: number
}

export function mondayStartLocal(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = x.getDay()
  const diff = (day + 6) % 7
  x.setDate(x.getDate() - diff)
  x.setHours(0, 0, 0, 0)
  return x
}

export function filterAttemptsInWeek(attempts: AttemptRowLite[], weekStart: Date): AttemptRowLite[] {
  const end = new Date(weekStart)
  end.setDate(end.getDate() + 7)
  const t0 = weekStart.getTime()
  const t1 = end.getTime()
  return attempts.filter((a) => {
    const t = new Date(a.completed_at).getTime()
    return t >= t0 && t < t1
  })
}

function shortDateLabel(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-PE', { month: 'short', day: 'numeric' })
}

function fmtTime(totalSec: number) {
  const mins = Math.floor(totalSec / 60)
  const secs = Math.floor(totalSec % 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}

export function computeActivityWeekDerived(
  attempts: AttemptRowLite[],
  weekStart: Date,
  routeNameMap: Map<string, string>,
  messages: AppMessages
): {
  weeklyKm: number
  trend: TrendPoint[]
  maxSpeedKmh: number
  avgSpeedKmh: number
  avgPerformance: number
  activityItems: Array<{ id: string; title: string; route: string; time: string }>
  bestByRoute: Map<string, AttemptRowLite>
} {
  const m = messages.activity
  const weekly = filterAttemptsInWeek(attempts, weekStart)
  const weeklyKm = weekly.reduce((acc, a) => acc + (Number(a.distance) || 0), 0) / 1000

  const recentForChart = [...weekly].sort(
    (a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime()
  )
  const lastSix = recentForChart.slice(-6)
  const kmBarsRaw = lastSix.map((a) => Math.max(0, Number(a.distance) / 1000))
  const speedLineRaw = lastSix.map((a) => {
    const derived = speedStatsFromGpsJson(a.gps_points)
    if (derived) return Math.max(0, derived.avgKmh)
    return Math.max(0, mpsToKmh(clampMps(Number(a.avg_speed) || 0)))
  })
  const padToSix = <T,>(arr: T[], fallback: T): T[] => {
    if (arr.length >= 6) return arr
    return [...Array.from({ length: 6 - arr.length }, () => fallback), ...arr]
  }
  const kmBars = padToSix(kmBarsRaw, 0)
  const speedLine = padToSix(speedLineRaw, 0)
  const trend = kmBars.map((kmv, i) => ({
    label: lastSix[i]?.completed_at
      ? shortDateLabel(lastSix[i]!.completed_at)
      : `${m.chartSessionPrefix}${i + 1}`,
    km: kmv,
    avgKmh: speedLine[i] ?? 0,
  }))

  const maxKmhValues = weekly
    .map((a) => {
      const derived = speedStatsFromGpsJson(a.gps_points)
      if (derived) return derived.maxKmh
      return mpsToKmh(clampMps(Number(a.max_speed) || 0))
    })
    .filter((v) => Number.isFinite(v) && v > 0)
  const maxSpeedKmh = maxKmhValues.length ? Math.max(...maxKmhValues) : 0

  const avgKmhValues = weekly
    .map((a) => {
      const derived = speedStatsFromGpsJson(a.gps_points)
      if (derived) return derived.avgKmh
      return mpsToKmh(clampMps(Number(a.avg_speed) || 0))
    })
    .filter((v) => Number.isFinite(v) && v > 0)
  const avgSpeedKmh = avgKmhValues.length ? avgKmhValues.reduce((a, b) => a + b, 0) / avgKmhValues.length : 0

  const perfValues = weekly.map((a) => Number(a.overall_score)).filter((v) => Number.isFinite(v))
  const perf = perfValues.length ? perfValues.reduce((a, b) => a + b, 0) / perfValues.length : 0
  const avgPerformance = perf / 10

  const bestByRoute = new Map<string, AttemptRowLite>()
  for (const a of weekly) {
    const prev = bestByRoute.get(a.route_id)
    if (!prev || Number(a.total_time) < Number(prev.total_time)) bestByRoute.set(a.route_id, a)
  }

  const activityItems = Array.from(bestByRoute.values())
    .slice(0, 6)
    .map((a) => {
      const rn = routeNameMap.get(a.route_id) || messages.common.routeFallback
      return {
        id: a.id,
        title: m.personalRecordTitle,
        route: interpolate(m.personalRecordRouteLine, { routeName: rn }),
        time: interpolate(m.personalRecordTimeLine, {
          routeName: rn,
          time: fmtTime(Number(a.total_time)),
        }),
      }
    })

  return {
    weeklyKm,
    trend,
    maxSpeedKmh,
    avgSpeedKmh,
    avgPerformance,
    activityItems,
    bestByRoute,
  }
}
