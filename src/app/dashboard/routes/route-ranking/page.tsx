'use client'

import { Suspense, useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/core/infrastructure/supabase/client'
import {
  MobileHeaderShell,
  MobileMain,
  MobileScreen,
  SegmentedButton,
  mobileStyles,
} from '@/components/ui/mobile-primitives'
import {
  Trophy,
  ArrowLeft,
  User,
} from 'lucide-react'
import { BrandLogoLoader } from '@/components/ui/BrandLogoLoader'
import { routeViewUrl } from '@/lib/routeViewNavigation'

interface RankingEntry {
  attemptId: string
  rank: number
  user_id: string
  user_name: string
  avatar_url: string | null
  total_time: number
  overall_score: number | null
  completed_at: string
}

interface RouteData {
  id: string
  name: string
  distance_km: number
}

type RankingMode = 'weekly' | 'total'

const PAGE_SIZE = 25

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 100)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getWeekRange(now = new Date()) {
  const d = new Date(now)
  const day = d.getDay()
  const diffToMonday = (day + 6) % 7
  const start = new Date(d)
  start.setHours(0, 0, 0, 0)
  start.setDate(d.getDate() - diffToMonday)

  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)

  return { start, end }
}

function daysUntil(date: Date, now = new Date()) {
  const ms = date.getTime() - now.getTime()
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}

function RiderAvatar({
  name,
  url,
  size = 40,
}: {
  name: string
  url: string | null
  size?: number
}) {
  const initial = (name?.trim()?.[0] || '?').toUpperCase()
  if (url?.trim()) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url.trim()}
        alt=""
        width={size}
        height={size}
        className="rounded-full object-cover border-2 border-white/20 shrink-0 bg-slate-700"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className="rounded-full bg-slate-600 flex items-center justify-center text-white font-bold border-2 border-white/15 shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initial}
    </div>
  )
}

function RouteRankingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const routeId = searchParams.get('id')
  const [route, setRoute] = useState<RouteData | null>(null)
  const [ranking, setRanking] = useState<RankingEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [myRank, setMyRank] = useState<{ rank: number; time: number; inLoadedList: boolean } | null>(null)
  const [totalPublic, setTotalPublic] = useState<number | null>(null)
  const [mode, setMode] = useState<RankingMode>('weekly')

  const week = useMemo(() => getWeekRange(), [])
  const weekStartIso = week.start.toISOString()
  const weekEndIso = week.end.toISOString()
  const weekLeftDays = daysUntil(week.end)

  const loadProfiles = useCallback(async (userIds: string[]) => {
    if (userIds.length === 0) return new Map<string, { full_name: string | null; avatar_url: string | null }>()
    const supabase = createClient()
    const { data } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', userIds)
    const m = new Map<string, { full_name: string | null; avatar_url: string | null }>()
    for (const p of data || []) {
      m.set(p.id as string, {
        full_name: (p as { full_name?: string }).full_name ?? null,
        avatar_url: (p as { avatar_url?: string }).avatar_url ?? null,
      })
    }
    return m
  }, [])

  useEffect(() => {
    if (!routeId) {
      setLoading(false)
      return
    }

    const loadRanking = async () => {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        setCurrentUserId(user?.id ?? null)

        const { data: routeData } = await supabase
          .from('routes')
          .select('id, name, distance_km')
          .eq('id', routeId)
          .single()

        if (routeData) setRoute(routeData as RouteData)

        let countQuery = supabase
          .from('route_attempts')
          .select('*', { count: 'exact', head: true })
          .eq('route_id', routeId)
          .eq('is_public', true)
        if (mode === 'weekly') {
          countQuery = countQuery
            .gte('completed_at', weekStartIso)
            .lte('completed_at', weekEndIso)
        }
        const { count: nTotal } = await countQuery
        setTotalPublic(nTotal ?? 0)

        const from = page * PAGE_SIZE
        const to = from + PAGE_SIZE - 1
        let attemptsQuery = supabase
          .from('route_attempts')
          .select('id, user_id, total_time, overall_score, completed_at')
          .eq('route_id', routeId)
          .eq('is_public', true)
          .order('total_time', { ascending: true })
          .range(from, to)
        if (mode === 'weekly') {
          attemptsQuery = attemptsQuery
            .gte('completed_at', weekStartIso)
            .lte('completed_at', weekEndIso)
        }
        const { data: attemptsData, error } = await attemptsQuery

        if (error) throw error

        if (!attemptsData?.length) {
          if (page === 0) setRanking([])
          setHasMore(false)
          setLoading(false)
          return
        }

        const uids = [...new Set(attemptsData.map((a) => a.user_id as string))]
        const profileMap = await loadProfiles(uids)

        const formatted: RankingEntry[] = attemptsData.map((attempt: Record<string, unknown>, index: number) => {
          const uid = attempt.user_id as string
          const prof = profileMap.get(uid)
          const name = prof?.full_name?.trim() || 'Rider'
          return {
            attemptId: attempt.id as string,
            rank: from + index + 1,
            user_id: uid,
            user_name: name,
            avatar_url: prof?.avatar_url ?? null,
            total_time: Number(attempt.total_time),
            overall_score:
              attempt.overall_score != null && attempt.overall_score !== ''
                ? Number(attempt.overall_score)
                : null,
            completed_at: String(attempt.completed_at),
          }
        })

        let myBestTime: number | null = null
        let myRankN = 0
        if (user) {
          let myBestQuery = supabase
            .from('route_attempts')
            .select('total_time')
            .eq('route_id', routeId)
            .eq('user_id', user.id)
            .eq('is_public', true)
          if (mode === 'weekly') {
            myBestQuery = myBestQuery
              .gte('completed_at', weekStartIso)
              .lte('completed_at', weekEndIso)
          }
          const { data: myBest } = await myBestQuery
            .order('total_time', { ascending: true })
            .limit(1)
            .maybeSingle()
          if (myBest != null && typeof (myBest as { total_time: unknown }).total_time === 'number') {
            myBestTime = Number((myBest as { total_time: number }).total_time)
            let fasterQuery = supabase
              .from('route_attempts')
              .select('*', { count: 'exact', head: true })
              .eq('route_id', routeId)
              .eq('is_public', true)
              .lt('total_time', myBestTime)
            if (mode === 'weekly') {
              fasterQuery = fasterQuery
                .gte('completed_at', weekStartIso)
                .lte('completed_at', weekEndIso)
            }
            const { count: faster } = await fasterQuery
            myRankN = (faster ?? 0) + 1
          }
        }

        setRanking((prev) => {
          const next = page === 0 ? formatted : [...prev, ...formatted]
          if (user && myBestTime != null) {
            const inList = next.some(
              (e) => e.user_id === user.id && Math.abs(e.total_time - myBestTime!) < 0.0001
            )
            setMyRank({ rank: myRankN, time: myBestTime, inLoadedList: inList })
          } else {
            setMyRank(null)
          }
          return next
        })
        setHasMore(attemptsData.length === PAGE_SIZE)
      } catch (err) {
        console.error('Error cargando ranking:', err)
      } finally {
        setLoading(false)
      }
    }

    void loadRanking()
  }, [routeId, page, mode, weekStartIso, weekEndIso, loadProfiles])

  useEffect(() => {
    setPage(0)
    setRanking([])
    setHasMore(true)
    setMyRank(null)
  }, [mode, routeId])

  if (!routeId) {
    return (
      <div className="min-h-screen bg-gdh-page flex items-center justify-center p-6 text-center text-slate-400">
        <p>Falta el id de la ruta (?id=…)</p>
      </div>
    )
  }

  if (loading && ranking.length === 0) {
    return (
      <div className="min-h-screen bg-gdh-page flex items-center justify-center">
        <BrandLogoLoader label="Cargando ranking..." compact showRing />
      </div>
    )
  }

  const leader = ranking[0] ?? null
  const rest = ranking.slice(1)

  const openAttemptDetail = (attemptId: string) => {
    if (!routeId) return
    router.push(
      `/dashboard/routes/attempt-replay?attemptId=${encodeURIComponent(attemptId)}&routeId=${encodeURIComponent(routeId)}&from=ranking`
    )
  }

  return (
    <MobileScreen>
      <MobileHeaderShell>
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-2"
          >
            <ArrowLeft size={16} />
            <span className="text-sm">Volver</span>
          </button>
          <h1 className="text-3xl font-black text-white">{mode === 'weekly' ? 'Ranking Semanal' : 'Ranking Total'}</h1>
          <div className="mt-3 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-400">{mode === 'weekly' ? 'Ranking semanal:' : 'Ranking total:'}</p>
              <p className="text-4xl font-extrabold text-white">{route?.name || 'Ruta'}</p>
            </div>
            {mode === 'weekly' && (
              <div className="text-right">
                <p className="text-sm text-slate-400">Finaliza en</p>
                <p className="text-4xl font-extrabold text-white">
                  {weekLeftDays} D{weekLeftDays === 1 ? 'ÍA' : 'ÍAS'}
                </p>
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <SegmentedButton active={mode === 'weekly'} onClick={() => setMode('weekly')}>
              Ranking semanal
            </SegmentedButton>
            <SegmentedButton active={mode === 'total'} onClick={() => setMode('total')}>
              Ranking total
            </SegmentedButton>
          </div>
          {mode === 'weekly' && (
            <p className="mt-1 text-xs text-slate-500">
              Semana actual: {week.start.toLocaleDateString('es-ES')} - {week.end.toLocaleDateString('es-ES')}
            </p>
          )}
      </MobileHeaderShell>

      <MobileMain>
        {myRank && currentUserId && (
          <div className="rounded-2xl border border-teal-500/35 bg-teal-500/10 px-4 py-3 flex flex-wrap items-center gap-3">
            <User className="text-teal-400 shrink-0" size={22} />
            <div className="flex-1 min-w-[200px]">
              <p className="text-sm font-semibold text-white">Tu posición</p>
              <p className="text-xs text-slate-400">
                Mejor tiempo público {mode === 'weekly' ? 'de esta semana' : 'histórico'} en esta pista ·{' '}
                <span className="font-mono text-teal-200">{formatTime(myRank.time)}</span>
              </p>
            </div>
            <div className="text-2xl font-bold text-teal-400 tabular-nums">#{myRank.rank}</div>
            {!myRank.inLoadedList && hasMore && (
              <p className="text-[11px] text-slate-500 w-full">
                Sigue bajando con «Cargar más» hasta ver tu fila en la tabla, o usa el listado completo más abajo.
              </p>
            )}
          </div>
        )}

        {leader && (
          <button
            type="button"
            onClick={() => openAttemptDetail(leader.attemptId)}
            className="w-full rounded-2xl border-2 border-sky-400/70 bg-gradient-to-r from-violet-600/40 to-slate-700/60 px-4 pb-4 pt-8 relative"
          >
            <div className="absolute -top-7 left-1/2 -translate-x-1/2">
              <div className="rounded-full p-1 bg-violet-500/70">
                <RiderAvatar name={leader.user_name} url={leader.avatar_url} size={76} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-6xl font-black text-white/95">#{leader.rank}</p>
              <span className="text-3xl">⭐</span>
            </div>
            <p className="text-3xl font-bold text-white leading-none">{leader.user_name}</p>
            <p className="text-2xl font-mono text-slate-200 mt-1">{formatTime(leader.total_time)}</p>
          </button>
        )}

        <section className="space-y-2">
          {rest.map((entry) => {
            const isMe = currentUserId && entry.user_id === currentUserId
            return (
              <button
                type="button"
                key={entry.attemptId}
                onClick={() => openAttemptDetail(entry.attemptId)}
                className={`w-full ${mobileStyles.card} px-3 py-2.5 transition text-left ${
                  isMe
                    ? 'border-teal-500/40 bg-teal-500/15'
                    : 'hover:bg-slate-700/70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <p className="w-11 text-4xl font-black text-white/80">#{entry.rank}</p>
                  <RiderAvatar name={entry.user_name} url={entry.avatar_url} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-3xl font-semibold text-white">{entry.user_name}</p>
                    <p className="text-2xl text-slate-200 font-mono">{formatTime(entry.total_time)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl text-teal-300">{entry.overall_score != null ? entry.overall_score : '—'}</p>
                    <p className="text-xs text-slate-500">{formatDate(entry.completed_at)}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </section>

        {hasMore && (
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition-colors"
          >
            Cargar más
          </button>
        )}

        {ranking.length === 0 && !loading && (
          <div className="text-center py-12">
            <Trophy className="mx-auto text-gray-500 mb-4" size={48} />
            <h3 className="text-xl font-bold text-white mb-2">Sin intentos aún</h3>
            <p className="text-gray-400 mb-6">Sé el primero en completar esta ruta</p>
            {routeId && (
              <Link
                href={routeViewUrl(routeId, 'route-ranking')}
                className="inline-block px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-xl"
              >
                Ir a la ruta
              </Link>
            )}
          </div>
        )}
      </MobileMain>
    </MobileScreen>
  )
}

export default function RouteRankingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gdh-page flex items-center justify-center">
          <BrandLogoLoader label="Cargando ranking..." compact showRing />
        </div>
      }
    >
      <RouteRankingContent />
    </Suspense>
  )
}
