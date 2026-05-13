'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/core/infrastructure/supabase/client'
import { Star, ChevronRight, MessageCircle, Heart, Sparkles, Route, Trophy, Menu } from 'lucide-react'
import { BrandLogoLoader } from '@/components/ui/BrandLogoLoader'
import { AnimeIconButton } from '@/components/ui/AnimeIconButton'
import {
  DashboardAppTopBar,
  DashboardAppTopBarHeading,
  DASHBOARD_APP_TOP_BAR_ICON_BUTTON_CLASS,
  DashboardCoachHeaderSlot,
} from '@/app/dashboard/components/DashboardAppTopBar'
import { useDashboardSidebar } from '@/lib/dashboard/DashboardSidebarContext'
import { cn } from '@/lib/utils'
import { ActivityCalendarMonth, type ActivityCalendarEntry } from '@/components/activity/ActivityCalendarMonth'
import { ActivityWeekStrip } from '@/components/activity/ActivityWeekStrip'
import {
  computeActivityWeekDerived,
  filterAttemptsInWeek,
  mondayStartLocal,
  type TrendPoint,
} from '@/lib/activity/activityWeekDerived'
import { interpolate } from '@/messages/interpolate'
import { useLocale } from '@/lib/i18n/LocaleProvider'
import type { AppMessages } from '@/messages/types'

type AttemptRow = {
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

type CommunityItem = {
  attemptId: string
  routeId: string
  routeName: string
  totalTime: number
  createdAt: string
  likesCount: number
  commentsCount: number
  latestComment: string
  commenterName: string
  commenterAvatar: string | null
}

function fmtTime(totalSec: number) {
  const mins = Math.floor(totalSec / 60)
  const secs = Math.floor(totalSec % 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}

function shortDateLabel(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-PE', { month: 'short', day: 'numeric' })
}

function buildAutoInsights(
  activity: AppMessages['activity'],
  input: {
    weeklyKm: number
    avgSpeedKmh: number
    maxSpeedKmh: number
    avgPerformance: number
    rankRows: Array<{ routeName: string; rank: number; time: number }>
    trend: TrendPoint[]
  }
) {
  const I = activity.insights
  const bullets: string[] = []
  const t = input.trend
  const last = t[t.length - 1]
  const prev = t[t.length - 2]
  if (last && prev) {
    const dKm = last.km - prev.km
    const dSpeed = last.avgKmh - prev.avgKmh
    bullets.push(
      dKm >= 0
        ? interpolate(I.recentKmMore, { km: dKm.toFixed(2) })
        : interpolate(I.recentKmLess, { km: Math.abs(dKm).toFixed(2) })
    )
    bullets.push(
      dSpeed >= 0
        ? interpolate(I.recentSpeedUp, { delta: dSpeed.toFixed(1) })
        : interpolate(I.recentSpeedDown, { delta: Math.abs(dSpeed).toFixed(1) })
    )
  }
  if (input.weeklyKm < 8) {
    bullets.push(I.weeklyVolumeLow)
  } else if (input.weeklyKm < 20) {
    bullets.push(I.weeklyVolumeMid)
  } else {
    bullets.push(I.weeklyVolumeHigh)
  }

  const topRank = input.rankRows.length ? input.rankRows[0] : null
  if (topRank) {
    bullets.push(
      interpolate(I.bestRankLine, {
        rank: topRank.rank,
        routeName: topRank.routeName,
        time: fmtTime(topRank.time),
      })
    )
  }
  bullets.push(
    interpolate(I.globalPaceLine, {
      avg: input.avgSpeedKmh.toFixed(1),
      max: input.maxSpeedKmh.toFixed(1),
      perf: input.avgPerformance.toFixed(1),
    })
  )
  return bullets.slice(0, 5)
}

function ActivityTrendChart({ points }: { points: TrendPoint[] }) {
  const { messages } = useLocale()
  const t = messages.activity
  if (points.length === 0) {
    return (
      <p className="text-sm text-slate-500 rounded-xl border border-white/10 bg-slate-700/30 p-3">
        {t.trendChartEmpty}
      </p>
    )
  }

  const maxKm = Math.max(1, ...points.map((p) => p.km))
  const maxSpeed = Math.max(1, ...points.map((p) => p.avgKmh))
  const n = points.length
  const step = 100 / n
  const barW = step * 0.62
  const linePath = points
    .map((p, i) => {
      const x = i * step + step / 2
      const y = 100 - (p.avgKmh / maxSpeed) * 88
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0f1520] p-3">
      <div className="mb-2 flex flex-wrap gap-2 text-[11px]">
        <span className="rounded-full border border-cyan-400/45 bg-cyan-400/10 px-2 py-0.5 text-cyan-200">{t.chartLegendDistance}</span>
        <span className="rounded-full border border-emerald-400/45 bg-emerald-400/10 px-2 py-0.5 text-emerald-200">{t.chartLegendAvgSpeed}</span>
      </div>
      <svg viewBox="0 0 100 120" className="w-full h-48">
        {[0.25, 0.5, 0.75, 1].map((f, i) => (
          <line key={`grid-${i}`} x1="0" y1={100 - f * 88} x2="100" y2={100 - f * 88} stroke="rgba(148,163,184,0.2)" strokeWidth="0.35" />
        ))}
        {points.map((p, i) => {
          const x = i * step + step / 2 - barW / 2
          const h = (p.km / maxKm) * 88
          const y = 100 - h
          return (
            <g key={`bar-${i}`}>
              <rect x={x} y={y} width={barW} height={Math.max(1.2, h)} rx={1.4} fill="rgba(34,211,238,0.82)" />
              <text x={x + barW / 2 - 1.8} y={114} fontSize="3.1" fill="rgba(148,163,184,0.9)">
                {`${t.chartSessionPrefix}${i + 1}`}
              </text>
            </g>
          )
        })}
        <path d={linePath} fill="none" stroke="rgba(16,185,129,0.95)" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => {
          const x = i * step + step / 2
          const y = 100 - (p.avgKmh / maxSpeed) * 88
          return (
            <g key={`dot-${i}`}>
              <circle cx={x} cy={y} r={1.05} fill="rgba(16,185,129,1)" />
              <text x={x - 2.6} y={Math.max(6, y - 1.4)} fontSize="2.8" fill="rgba(167,243,208,0.95)">
                {Math.round(p.avgKmh)}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="mt-1 grid grid-cols-3 gap-1 text-[11px] text-slate-400">
        {points.slice(-3).map((p, i) => (
          <span key={`lbl-${i}`} className="truncate">
            {p.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function ActivityPage() {
  const { messages, locale } = useLocale()
  const { openSidebar } = useDashboardSidebar()
  const [loading, setLoading] = useState(true)
  const [allAttempts, setAllAttempts] = useState<AttemptRow[]>([])
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => mondayStartLocal(new Date()))
  const [routeNameMap, setRouteNameMap] = useState<Map<string, string>>(() => new Map())
  const [userId, setUserId] = useState<string | null>(null)
  const [rankRows, setRankRows] = useState<Array<{ routeId: string; routeName: string; rank: number; time: number }>>([])
  const [community, setCommunity] = useState<CommunityItem[]>([])
  const [rankLoading, setRankLoading] = useState(false)
  const [communityLoading, setCommunityLoading] = useState(false)
  const [calendarEntries, setCalendarEntries] = useState<ActivityCalendarEntry[]>([])
  const supabase = useMemo(() => createClient(), [])

  const derived = useMemo(
    () => computeActivityWeekDerived(allAttempts, selectedWeekStart, routeNameMap, messages),
    [allAttempts, selectedWeekStart, routeNameMap, messages]
  )

  const autoInsights = useMemo(
    () =>
      buildAutoInsights(messages.activity, {
        weeklyKm: derived.weeklyKm,
        avgSpeedKmh: derived.avgSpeedKmh,
        maxSpeedKmh: derived.maxSpeedKmh,
        avgPerformance: derived.avgPerformance,
        rankRows,
        trend: derived.trend,
      }),
    [messages.activity, derived, rankRows]
  )

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          if (!cancelled) setLoading(false)
          return
        }
        if (!cancelled) setUserId(user.id)

        const [{ data: myAttempts }, { data: routeNames }] = await Promise.all([
          supabase
            .from('route_attempts')
            .select('id, route_id, user_id, total_time, max_speed, avg_speed, overall_score, distance, gps_points, completed_at, is_public')
            .eq('user_id', user.id)
            .order('completed_at', { ascending: false })
            .limit(200),
          supabase.from('routes').select('id, name'),
        ])
        if (cancelled) return
        const attempts = (myAttempts || []) as AttemptRow[]
        const names = new Map<string, string>((routeNames || []).map((r) => [String(r.id), String(r.name)]))

        setRouteNameMap(names)
        setAllAttempts(attempts)
        setCalendarEntries(
          attempts.map((a) => ({
            id: a.id,
            route_id: a.route_id,
            route_name: names.get(a.route_id) || messages.common.routeFallback,
            completed_at: a.completed_at,
            total_time: Number(a.total_time),
            distance_m: Math.max(0, Number(a.distance) || 0),
          }))
        )
        if (!cancelled) setLoading(false)
      } catch (e) {
        console.error('Activity dynamic load:', e)
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [supabase, messages])

  useEffect(() => {
    let cancelled = false
    if (!allAttempts.length) {
      setRankRows([])
      return
    }
    const d = computeActivityWeekDerived(allAttempts, selectedWeekStart, routeNameMap, messages)
    void (async () => {
      try {
        if (!cancelled) setRankLoading(true)
        const ranks = await Promise.all(
          Array.from(d.bestByRoute.values())
            .slice(0, 5)
            .map(async (a) => {
              const { count: faster } = await supabase
                .from('route_attempts')
                .select('*', { count: 'exact', head: true })
                .eq('route_id', a.route_id)
                .eq('is_public', true)
                .lt('total_time', a.total_time)
              return {
                routeId: a.route_id,
                routeName: routeNameMap.get(a.route_id) || messages.common.routeFallback,
                rank: (faster ?? 0) + 1,
                time: Number(a.total_time),
              }
            })
        )
        const sorted = ranks.sort((a, b) => a.rank - b.rank)
        if (!cancelled) setRankRows(sorted)
      } catch (e) {
        console.error('Activity rank load:', e)
      } finally {
        if (!cancelled) setRankLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [allAttempts, selectedWeekStart, routeNameMap, supabase, messages])

  useEffect(() => {
    let cancelled = false
    if (!userId || !allAttempts.length) {
      setCommunity([])
      return
    }
    void (async () => {
      try {
        if (!cancelled) setCommunityLoading(true)
        const weekAttempts = filterAttemptsInWeek(allAttempts, selectedWeekStart)
        const myPublicAttempts = weekAttempts.filter((a) => a.is_public)
        if (!myPublicAttempts.length) {
          if (!cancelled) {
            setCommunity([])
            setCommunityLoading(false)
          }
          return
        }
        const attemptIds = myPublicAttempts.map((a) => a.id)
        const attemptById = new Map(myPublicAttempts.map((a) => [a.id, a]))

        const { data: likesRes } = attemptIds.length
          ? await supabase.from('route_attempt_likes').select('attempt_id, user_id').in('attempt_id', attemptIds)
          : { data: [] as Array<{ attempt_id: string; user_id: string }> }

        const { data: commentsRes } = attemptIds.length
          ? await supabase
              .from('route_attempt_comments')
              .select('attempt_id, user_id, body, created_at')
              .in('attempt_id', attemptIds)
              .order('created_at', { ascending: false })
          : { data: [] as Array<{ attempt_id: string; user_id: string; body: string; created_at: string }> }

        const foreignComments = (commentsRes || []).filter((c) => c.user_id !== userId)
        const commenterIds = [...new Set(foreignComments.map((c) => c.user_id))]

        const { data: commenters } = commenterIds.length
          ? await supabase.from('profiles').select('id, full_name, avatar_url').in('id', commenterIds)
          : { data: [] as Array<{ id: string; full_name: string | null; avatar_url: string | null }> }

        const commenterMap = new Map<string, { name: string; avatar: string | null }>()
        for (const p of commenters || []) {
          commenterMap.set(String(p.id), {
            name: p.full_name?.trim() || messages.common.defaultRiderName,
            avatar: p.avatar_url ?? null,
          })
        }

        const likesByAttempt = new Map<string, number>()
        for (const l of likesRes || []) {
          const aid = String(l.attempt_id)
          likesByAttempt.set(aid, (likesByAttempt.get(aid) || 0) + 1)
        }

        const commentsCountByAttempt = new Map<string, number>()
        for (const c of commentsRes || []) {
          const aid = String(c.attempt_id)
          commentsCountByAttempt.set(aid, (commentsCountByAttempt.get(aid) || 0) + 1)
        }

        const latestForeignByAttempt = new Map<string, { body: string; created_at: string; user_id: string }>()
        for (const c of foreignComments) {
          const aid = String(c.attempt_id)
          if (!latestForeignByAttempt.has(aid)) {
            latestForeignByAttempt.set(aid, {
              body: c.body,
              created_at: c.created_at,
              user_id: c.user_id,
            })
          }
        }

        const feed: CommunityItem[] = Array.from(latestForeignByAttempt.entries())
          .map(([attemptId, latest]) => {
            const a = attemptById.get(attemptId)
            if (!a) return null
            const commenter = commenterMap.get(latest.user_id)
            return {
              attemptId,
              routeId: a.route_id,
              routeName: routeNameMap.get(a.route_id) || messages.common.routeFallback,
              totalTime: Number(a.total_time),
              createdAt: latest.created_at,
              likesCount: likesByAttempt.get(attemptId) || 0,
              commentsCount: commentsCountByAttempt.get(attemptId) || 0,
              latestComment: latest.body,
              commenterName: commenter?.name || messages.common.defaultRiderName,
              commenterAvatar: commenter?.avatar || null,
            }
          })
          .filter((x): x is CommunityItem => x != null)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, 8)

        if (!cancelled) setCommunity(feed)
      } catch (e) {
        console.error('Activity community load:', e)
      } finally {
        if (!cancelled) setCommunityLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId, allAttempts, selectedWeekStart, routeNameMap, supabase, messages])

  if (loading) {
    return (
      <div className="gdh-immersive-page min-h-screen text-slate-100 pb-24 flex items-center justify-center">
        <BrandLogoLoader label={messages.activity.loadingLabel} compact showRing />
      </div>
    )
  }

  return (
    <div className="gdh-immersive-page min-h-screen text-slate-100 pb-24">
      <DashboardAppTopBar
        leading={
          <AnimeIconButton
            label="Menú"
            onClick={() => openSidebar()}
            className={cn(DASHBOARD_APP_TOP_BAR_ICON_BUTTON_CLASS)}
          >
            <Menu size={22} aria-hidden />
          </AnimeIconButton>
        }
        center={
          <DashboardAppTopBarHeading
            title={messages.activity.pageTitle}
            subtitle={
              <>
                <p>{messages.activity.pageSubtitle}</p>
                <p className="font-medium text-teal-300/90">
                  {interpolate(messages.activity.weekKmSummary, { km: derived.weeklyKm.toFixed(2) })}
                </p>
              </>
            }
          />
        }
        trailing={<DashboardCoachHeaderSlot />}
      />

      <div className="p-4 space-y-5 max-w-lg mx-auto">
        <div className="rounded-3xl border border-teal-500/25 bg-gradient-to-b from-teal-500/10 via-[#121821] to-[#0f1520] p-4 shadow-[0_0_40px_rgba(45,212,191,0.08)] gdh-immersive-panel">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-300/90 mb-2">
            {messages.activity.calendarHeroEyebrow}
          </p>
          <ActivityCalendarMonth entries={calendarEntries} emphasizeWeekStart={selectedWeekStart} />
        </div>

        <ActivityWeekStrip
          selectedWeekStart={selectedWeekStart}
          onSelectWeek={setSelectedWeekStart}
          thisWeekLabel={messages.activity.weekStripThisWeek}
          weekLabel={(d) =>
            d.toLocaleDateString(locale === 'en' ? 'en-US' : 'es-PE', { day: 'numeric', month: 'short' })
          }
        />

        <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 gdh-immersive-panel">
          <div className="flex items-center gap-2 text-emerald-300">
            <Sparkles size={18} />
            <h2 className="text-lg font-semibold">{messages.activity.autoAnalysisTitle}</h2>
          </div>
          <div className="mt-2 space-y-1.5">
            {autoInsights.map((line, i) => (
              <p key={`ai-${i}`} className="text-sm text-slate-200">
                – {line}
              </p>
            ))}
            {autoInsights.length === 0 && (
              <p className="text-sm text-slate-300">{messages.activity.autoAnalysisEmpty}</p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-gdh-card p-4 shadow-xl gdh-immersive-panel">
          <p className="text-2xl text-slate-200 mb-3">{messages.activity.trendSectionTitle}</p>
          <ActivityTrendChart points={derived.trend} />
        </section>

        <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-white/10 bg-slate-700/45">
          <div className="p-3 text-center">
            <p className="text-[10px] uppercase text-slate-400 font-semibold">{messages.activity.statMaxSpeedLabel}</p>
            <p className="text-4xl font-black text-white mt-1">
              {Math.round(derived.maxSpeedKmh)} <span className="text-xl font-semibold text-slate-300">{messages.common.speedUnit}</span>
            </p>
          </div>
          <div className="p-3 text-center border-l border-white/10">
            <p className="text-[10px] uppercase text-slate-400 font-semibold">{messages.activity.statAvgSpeedLabel}</p>
            <p className="text-4xl font-black text-white mt-1">
              {Math.round(derived.avgSpeedKmh)} <span className="text-xl font-semibold text-slate-300">{messages.common.speedUnit}</span>
            </p>
          </div>
          <div className="p-3 text-center border-l border-white/10">
            <p className="text-[10px] uppercase text-slate-400 font-semibold">{messages.activity.statPerformanceLabel}</p>
            <p className="text-4xl font-black text-white mt-1">{derived.avgPerformance.toFixed(2)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/dashboard/routes"
            className="rounded-xl border border-white/10 bg-slate-700/35 p-3 hover:bg-slate-700/55"
          >
            <div className="inline-flex items-center gap-2 text-cyan-300 text-sm font-semibold">
              <Route size={16} /> {messages.activity.linkRoutesTitle}
            </div>
            <p className="text-xs text-slate-400 mt-1">{messages.activity.linkRoutesSubtitle}</p>
          </Link>
          <Link
            href="/dashboard/ranking"
            className="rounded-xl border border-white/10 bg-slate-700/35 p-3 hover:bg-slate-700/55"
          >
            <div className="inline-flex items-center gap-2 text-violet-300 text-sm font-semibold">
              <Trophy size={16} /> {messages.activity.linkRankingTitle}
            </div>
            <p className="text-xs text-slate-400 mt-1">{messages.activity.linkRankingSubtitle}</p>
          </Link>
        </div>

        <section className="space-y-3">
          <h2 className="text-3xl font-semibold text-white">{messages.activity.highlightsSectionTitle}</h2>
          {derived.activityItems.map((item) => (
            <div key={item.id} className="rounded-xl border border-white/10 bg-slate-700/45 p-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
                <Star className="text-amber-400" size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-teal-300 font-semibold leading-tight uppercase tracking-wide">{item.title}</p>
                <p className="text-2xl text-white leading-tight">{item.route}</p>
                <p className="text-sm text-slate-400">{item.time}</p>
              </div>
              <ChevronRight className="text-slate-500 shrink-0" size={18} />
            </div>
          ))}
          {derived.activityItems.length === 0 && (
            <p className="text-sm text-slate-500 rounded-xl border border-white/10 bg-slate-700/30 p-3">
              {messages.activity.highlightsEmpty}
            </p>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-3xl font-semibold text-white">{messages.activity.rankingsSectionTitle}</h2>
          {rankLoading && (
            <p className="text-xs text-slate-500">{messages.activity.rankingsLoading}</p>
          )}
          {rankRows.map((r) => (
            <Link
              key={`${r.routeId}-${r.rank}`}
              href={`/dashboard/routes/route-ranking?id=${encodeURIComponent(r.routeId)}`}
              className="rounded-xl border border-white/10 bg-slate-700/45 p-3 flex items-center justify-between gap-3 hover:bg-slate-700/65"
            >
              <div className="min-w-0">
                <p className="text-white font-semibold truncate">{r.routeName}</p>
                <p className="text-xs text-slate-400 font-mono">
                  {interpolate(messages.activity.bestTimeLabel, { time: fmtTime(r.time) })}
                </p>
              </div>
              <p className="text-teal-300 font-bold">#{r.rank}</p>
            </Link>
          ))}
          {rankRows.length === 0 && (
            <p className="text-sm text-slate-500 rounded-xl border border-white/10 bg-slate-700/30 p-3">
              {messages.activity.rankingsEmpty}
            </p>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-3xl font-semibold text-white">{messages.activity.gallerySectionTitle}</h2>
          {communityLoading && (
            <p className="text-xs text-slate-500">{messages.activity.communityLoading}</p>
          )}
          {community.map((item) => (
            <div key={item.attemptId} className="rounded-xl border border-white/10 bg-slate-700/45 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-slate-500 shrink-0 overflow-hidden">
                    {item.commenterAvatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.commenterAvatar} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div>
                    <p className="text-white font-semibold">{item.commenterName}</p>
                    <p className="text-xs text-slate-400">
                      {interpolate(messages.activity.communityCommentMeta, {
                        routeName: item.routeName,
                        time: fmtTime(item.totalTime),
                      })}
                    </p>
                  </div>
                </div>
                <Link
                  href={`/dashboard/routes/attempt-replay?attemptId=${encodeURIComponent(item.attemptId)}&routeId=${encodeURIComponent(item.routeId)}&from=activity`}
                  className="text-xs text-teal-300 hover:text-teal-200"
                >
                  {messages.activity.communityViewReplay}
                </Link>
              </div>

              <p className="text-sm text-slate-300 rounded-lg border border-white/10 bg-slate-900/35 px-2 py-1.5">
                “{item.latestComment}”
              </p>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold border border-white/15 bg-white/5 text-slate-300">
                  <Heart size={14} />
                  {item.likesCount}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold border border-white/15 bg-white/5 text-slate-300">
                  <MessageCircle size={14} />
                  {item.commentsCount}
                </span>
              </div>
            </div>
          ))}
          {community.length === 0 && (
            <p className="text-sm text-slate-500 rounded-xl border border-white/10 bg-slate-700/30 p-3">
              {messages.activity.communityEmpty}
            </p>
          )}
        </section>

        <Link
          href="/dashboard/ranking"
          className="block w-full py-3.5 text-center rounded-2xl border border-violet-500/40 text-violet-300 font-semibold hover:bg-violet-500/10 transition-colors"
        >
          {messages.activity.weeklyRankingCta}
        </Link>
      </div>
    </div>
  )
}
