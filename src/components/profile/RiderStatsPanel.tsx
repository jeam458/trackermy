'use client'

import { useEffect, useState, useMemo, useRef, type ReactNode } from 'react'
import { fadeSlideIn } from '@/lib/animeUi'
import { Activity, Gauge, Mountain, Timer, TrendingUp, Flame } from 'lucide-react'
import { ProfileRepository, UserRideAttemptRow } from '@/core/infrastructure/repositories/ProfileRepository'
import { speedStatsFromGpsJson } from '@/lib/attemptSpeedDisplay'
import {
  estimateRideCaloriesKcal,
  formatDurationSeconds,
  kmhFromStoredSpeedMps,
  minMovingSpeedMpsFromGps,
  msToKmh,
} from '@/lib/rideStats'
import { useLocale } from '@/lib/i18n/LocaleProvider'

const repo = new ProfileRepository()

/** Preferir velocidades derivadas de GPS (filtro anti-outliers); si no hay trazo, valores guardados acotados. */
function attemptDisplaySpeedKmh(a: UserRideAttemptRow): { maxKmh: number; avgKmh: number } {
  const d = speedStatsFromGpsJson(a.gps_points)
  if (d) return { maxKmh: d.maxKmh, avgKmh: d.avgKmh }
  return {
    maxKmh: kmhFromStoredSpeedMps(a.max_speed),
    avgKmh: kmhFromStoredSpeedMps(a.avg_speed),
  }
}

function num(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v)
  return Number.isFinite(n) ? n : 0
}

type PerRouteAgg = {
  routeId: string
  routeName: string
  attempts: number
  bestTimeSec: number
  bestMaxSpeedKmh: number
  totalDistanceM: number
  sumElevationGain: number
}

export function RiderStatsPanel({
  userId,
  riderWeightKg,
}: {
  userId: string | null
  riderWeightKg: number | null
}) {
  const { messages } = useLocale()
  const s = messages.profile.riderStats
  const wrapRef = useRef<HTMLDivElement>(null)
  const [attempts, setAttempts] = useState<UserRideAttemptRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const rows = await repo.getUserRideAttempts(userId)
        if (!cancelled) setAttempts(rows)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  useEffect(() => {
    if (loading) return
    const id = requestAnimationFrame(() => {
      const el = wrapRef.current
      if (el) fadeSlideIn(el, { duration: 480, y: [18, 0] })
    })
    return () => cancelAnimationFrame(id)
  }, [loading, attempts.length])

  const global = useMemo(() => {
    if (attempts.length === 0) return null
    let totalDist = 0
    let sumMoving = 0
    let maxKmh = 0
    let minMovingKmh: number | null = null
    let sumAvg = 0
    let elevGain = 0
    let elevLoss = 0
    let kcalSum = 0
    let kcalCount = 0

    for (const a of attempts) {
      const d = num(a.distance)
      const mov = num(a.moving_time)
      const spd = attemptDisplaySpeedKmh(a)
      totalDist += d
      sumMoving += mov
      maxKmh = Math.max(maxKmh, spd.maxKmh)
      sumAvg += spd.avgKmh
      elevGain += num(a.elevation_gain)
      elevLoss += num(a.elevation_loss)

      const minM = minMovingSpeedMpsFromGps(a.gps_points)
      if (minM != null) {
        const kmh = msToKmh(minM)
        minMovingKmh = minMovingKmh == null ? kmh : Math.min(minMovingKmh, kmh)
      }

      const k = estimateRideCaloriesKcal({
        movingTimeSec: mov,
        weightKg: riderWeightKg,
      })
      if (k != null) {
        kcalSum += k
        kcalCount += 1
      }
    }

    return {
      count: attempts.length,
      totalDistKm: totalDist / 1000,
      avgTimeSec: attempts.reduce((s, a) => s + num(a.total_time), 0) / attempts.length,
      bestTimeSec: Math.min(...attempts.map((a) => num(a.total_time))),
      maxSpeedKmh: maxKmh,
      minMovingSpeedKmh: minMovingKmh,
      avgSpeedKmh: sumAvg / attempts.length,
      elevationGainM: elevGain,
      elevationLossM: elevLoss,
      caloriesEstimate: kcalCount > 0 ? kcalSum : null,
    }
  }, [attempts, riderWeightKg])

  const byRoute = useMemo(() => {
    const map = new Map<string, PerRouteAgg>()
    for (const a of attempts) {
      const routeId = a.route_id
      const routeName = a.routes?.name || `${s.routeFallbackPrefix} ${routeId.slice(0, 8)}…`
      const t = num(a.total_time)
      const mx = attemptDisplaySpeedKmh(a).maxKmh
      const d = num(a.distance)
      const g = num(a.elevation_gain)

      const cur =
        map.get(routeId) ||
        ({
          routeId,
          routeName,
          attempts: 0,
          bestTimeSec: Infinity,
          bestMaxSpeedKmh: 0,
          totalDistanceM: 0,
          sumElevationGain: 0,
        } as PerRouteAgg)

      cur.attempts += 1
      cur.bestTimeSec = Math.min(cur.bestTimeSec, t)
      cur.bestMaxSpeedKmh = Math.max(cur.bestMaxSpeedKmh, mx)
      cur.totalDistanceM += d
      cur.sumElevationGain += g
      map.set(routeId, cur)
    }
    return [...map.values()].sort((a, b) => b.attempts - a.attempts)
  }, [attempts, s.routeFallbackPrefix])

  if (!userId) return null

  if (loading) {
    return (
      <section className="bg-gdh-card border border-white/10 rounded-[1.5rem] p-6 text-slate-500 text-sm">
        {s.loading}
      </section>
    )
  }

  if (attempts.length === 0) {
    return (
      <section
        ref={wrapRef}
        className="bg-gdh-card border border-white/10 rounded-[1.5rem] p-6 text-center text-slate-500 text-sm opacity-0"
      >
        <Activity className="mx-auto mb-2 opacity-50" size={26} />
        {s.empty}
      </section>
    )
  }

  const g = global!

  return (
    <div ref={wrapRef} className="space-y-4 opacity-0">
      <div className="bg-gdh-card border border-white/10 rounded-[1.5rem] p-5 shadow-lg">
        <h3 className="font-semibold text-lg text-slate-100 mb-4 flex items-center gap-2">
          <TrendingUp size={20} className="text-amber-400" />
          {s.summaryTitle}
        </h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <StatChip icon={<Timer size={16} />} label={s.runs} value={String(g.count)} />
          <StatChip icon={<Gauge size={16} />} label={s.maxSpeed} value={g.maxSpeedKmh.toFixed(1)} />
          <StatChip
            icon={<Gauge size={16} />}
            label={s.avgSpeed}
            value={g.avgSpeedKmh.toFixed(1)}
          />
          <StatChip
            icon={<Gauge size={16} />}
            label={s.minMovingSpeed}
            value={g.minMovingSpeedKmh != null ? g.minMovingSpeedKmh.toFixed(1) : s.caloriesDash}
          />
          <StatChip
            icon={<Timer size={16} />}
            label={s.bestTime}
            value={formatDurationSeconds(g.bestTimeSec)}
          />
          <StatChip
            icon={<Activity size={16} />}
            label={s.totalDistance}
            value={`${g.totalDistKm.toFixed(2)} km`}
          />
          <StatChip
            icon={<Mountain size={16} />}
            label={s.elevGain}
            value={`${g.elevationGainM.toFixed(0)} m`}
          />
          <StatChip
            icon={<Mountain size={16} />}
            label={s.elevLoss}
            value={`${g.elevationLossM.toFixed(0)} m`}
          />
          <StatChip
            icon={<Flame size={16} />}
            label={s.caloriesEst}
            value={
              g.caloriesEstimate != null
                ? `${g.caloriesEstimate} kcal`
                : riderWeightKg
                  ? s.caloriesDash
                  : s.caloriesNeedWeight
            }
            className="col-span-2"
          />
        </div>
        {!riderWeightKg && (
          <p className="text-[11px] text-slate-500 mt-3">
            {s.weightHint}
          </p>
        )}
      </div>

      <div className="bg-gdh-card border border-white/10 rounded-[1.5rem] p-5 shadow-lg">
        <h3 className="font-semibold text-lg text-slate-100 mb-3">{s.byRouteTitle}</h3>
        <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
          {byRoute.map((r) => (
            <div
              key={r.routeId}
              className="rounded-xl border border-white/10 bg-gdh-canvas-2 p-3 text-xs text-slate-300"
            >
              <p className="font-medium text-slate-100 text-sm mb-2 truncate">{r.routeName}</p>
              <div className="grid grid-cols-2 gap-2">
                <span className="text-slate-500">{s.attempts}</span>
                <span className="text-right">{r.attempts}</span>
                <span className="text-slate-500">{s.bestTimeShort}</span>
                <span className="text-right font-mono">
                  {formatDurationSeconds(r.bestTimeSec === Infinity ? 0 : r.bestTimeSec)}
                </span>
                <span className="text-slate-500">{s.maxSpeedRecord}</span>
                <span className="text-right">{r.bestMaxSpeedKmh.toFixed(1)} km/h</span>
                <span className="text-slate-500">{s.distAccum}</span>
                <span className="text-right">{(r.totalDistanceM / 1000).toFixed(2)} km</span>
                <span className="text-slate-500">{s.elevPlusAccum}</span>
                <span className="text-right">{r.sumElevationGain.toFixed(0)} m</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatChip({
  icon,
  label,
  value,
  className = '',
}: {
  icon: ReactNode
  label: string
  value: string
  className?: string
}) {
  return (
    <div
      className={`rounded-xl bg-gdh-canvas-2 border border-white/10 px-3 py-2 flex flex-col gap-0.5 ${className}`}
    >
      <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </span>
      <span className="text-slate-100 font-semibold">{value}</span>
    </div>
  )
}
