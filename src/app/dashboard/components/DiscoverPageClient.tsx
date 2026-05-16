'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Menu, Search, Trophy, MapPinned, ChevronRight } from 'lucide-react'
import MapPlaceholderWrapper from './MapPlaceholderWrapper'
import { useDashboardSidebar } from '@/lib/dashboard/DashboardSidebarContext'
import WeeklyRecord from './WeeklyRecord'
import { SupabaseRouteRepository } from '@/core/infrastructure/repositories/SupabaseRouteRepository'
import { createClient } from '@/core/infrastructure/supabase/client'
import { Route } from '@/core/domain/Route'
import { clampMps, mpsToKmh } from '@/lib/attemptSpeedDisplay'
import { fadeSlideIn, staggerIn } from '@/lib/animeUi'
import { PageLoadingShimmer } from '@/components/ui/PageLoadingShimmer'
import { AnimeIconButton } from '@/components/ui/AnimeIconButton'
import { BrandSpinner } from '@/components/ui/BrandLogoLoader'
import { routeViewUrl } from '@/lib/routeViewNavigation'
import {
  DASHBOARD_APP_TOP_BAR_ICON_BUTTON_CLASS,
  DASHBOARD_APP_TOP_BAR_SHELL_CLASS,
  DashboardAppTopBarHeading,
  DashboardAppTopBarInner,
  DashboardAppTopBarTrailingCluster,
} from '@/app/dashboard/components/DashboardAppTopBar'

const repoRef = { current: new SupabaseRouteRepository() }

type FastestRiderRow = {
  name: string
  timeLabel: string
  avatarUrl: string | null
  userId: string
}

function formatAttemptTimeLabel(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
  return `${m}:${String(r).padStart(2, '0')}`
}

function shortRiderDisplayName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'Rider'
  if (parts.length === 1) {
    const w = parts[0]!
    return w.length > 18 ? `${w.slice(0, 16)}…` : w
  }
  const first = parts[0]!
  const last = parts[parts.length - 1]!
  return `${first} ${last.charAt(0).toUpperCase()}.`
}

async function fetchFastestPublicRidersForRoutes(
  supabase: ReturnType<typeof createClient>,
  routeIds: string[]
): Promise<Record<string, FastestRiderRow>> {
  const out: Record<string, FastestRiderRow> = {}
  if (!routeIds.length) return out

  const attemptRows = await Promise.all(
    routeIds.map(async (rid) => {
      const { data, error } = await supabase
        .from('route_attempts')
        .select('total_time, user_id')
        .eq('route_id', rid)
        .eq('is_public', true)
        .order('total_time', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (error || !data) return { rid, userId: null as string | null, totalTime: null as number | null }
      return {
        rid,
        userId: data.user_id as string,
        totalTime: Number(data.total_time),
      }
    })
  )

  const userIds = [...new Set(attemptRows.map((r) => r.userId).filter((x): x is string => !!x))]
  let profiles: { id: string; full_name: string | null; avatar_url: string | null }[] = []
  if (userIds.length) {
    const { data } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', userIds)
    profiles = data ?? []
  }
  const profById = new Map(profiles.map((p) => [p.id, p]))

  for (const row of attemptRows) {
    if (!row.userId || row.totalTime == null || !Number.isFinite(row.totalTime)) continue
    const p = profById.get(row.userId)
    const raw = p?.full_name?.trim() || 'Rider'
    out[row.rid] = {
      name: shortRiderDisplayName(raw),
      timeLabel: formatAttemptTimeLabel(row.totalTime),
      avatarUrl: p?.avatar_url?.trim() || null,
      userId: row.userId,
    }
  }
  return out
}

type PopularRouteStats = {
  runs7d: number
  runsToday: number
  avgKmh: number | null
}

interface DiscoverRouteItem {
  id: string
  name: string
  difficulty: Route['difficulty']
  distanceLabel: string
  topTime: string
  topRiderName: string
  topRiderAvatar: string
  popularityLine: string | null
  avgSpeedLine: string | null
}

function formatRouteDistance(distanceKm: number) {
  return `${distanceKm.toFixed(2).replace('.', ',')} km`
}

export default function DiscoverPageClient() {
  const router = useRouter()
  const [routes, setRoutes] = useState<Route[]>([])
  const [popularStats, setPopularStats] = useState<Record<string, PopularRouteStats>>({})
  const [fastestRiders, setFastestRiders] = useState<Record<string, FastestRiderRow>>({})
  const [routesReady, setRoutesReady] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Route[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchHint, setSearchHint] = useState<string | null>(null)
  const { openSidebar } = useDashboardSidebar()
  const headerRef = useRef<HTMLElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const mapSectionRef = useRef<HTMLElement>(null)
  const ctaRef = useRef<HTMLDivElement>(null)

  const isSearching = showSearch && query.trim().length > 0

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      weekAgo.setHours(0, 0, 0, 0)
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      const statsByRoute = new Map<string, { speedsMps: number[]; completedAt: string[] }>()

      try {
        const { data: attempts, error: attErr } = await supabase
          .from('route_attempts')
          .select('route_id, avg_speed, completed_at')
          .eq('is_public', true)
          .gte('completed_at', weekAgo.toISOString())

        if (attErr) throw attErr

        for (const row of attempts || []) {
          const rid = String(row.route_id)
          if (!statsByRoute.has(rid)) statsByRoute.set(rid, { speedsMps: [], completedAt: [] })
          const bucket = statsByRoute.get(rid)!
          bucket.completedAt.push(String(row.completed_at))
          const v = Number(row.avg_speed)
          if (Number.isFinite(v) && v > 0) bucket.speedsMps.push(v)
        }

        const scored = Array.from(statsByRoute.entries()).map(([routeId, b]) => {
          const runs7d = b.completedAt.length
          const runsToday = b.completedAt.filter((iso) => new Date(iso).getTime() >= todayStart.getTime()).length
          const avgKmh =
            b.speedsMps.length > 0
              ? b.speedsMps.reduce((acc, mps) => acc + mpsToKmh(clampMps(mps)), 0) / b.speedsMps.length
              : null
          return { routeId, runs7d, runsToday, avgKmh }
        })
        scored.sort((a, b) => b.runs7d - a.runs7d)

        const statsRecord: Record<string, PopularRouteStats> = {}
        for (const s of scored) {
          statsRecord[s.routeId] = {
            runs7d: s.runs7d,
            runsToday: s.runsToday,
            avgKmh: s.avgKmh,
          }
        }

        const orderedIds = scored.map((s) => s.routeId)
        const resolved: Route[] = []
        const idBatch = orderedIds.slice(0, 28)
        const fetched = await Promise.all(idBatch.map((id) => repoRef.current.getRouteById(id)))
        const byId = new Map<string, Route>()
        for (const r of fetched) {
          if (r?.isPublic && r.status === 'active') byId.set(r.id, r)
        }
        for (const id of orderedIds) {
          const r = byId.get(id)
          if (r && !resolved.some((x) => x.id === r.id)) {
            resolved.push(r)
            if (resolved.length >= 6) break
          }
        }

        if (resolved.length < 6) {
          const fallback = await repoRef.current.getPublicRoutes(24)
          for (const r of fallback) {
            if (resolved.length >= 6) break
            if (!resolved.some((x) => x.id === r.id)) resolved.push(r)
          }
        }

        const finalRoutes = resolved.slice(0, 6)
        const fastestMap = await fetchFastestPublicRidersForRoutes(
          supabase,
          finalRoutes.map((r) => r.id)
        )

        if (!cancelled) {
          setPopularStats(statsRecord)
          setFastestRiders(fastestMap)
          setRoutes(finalRoutes)
        }
      } catch (e) {
        console.error(e)
        try {
          const list = await repoRef.current.getPublicRoutes(12)
          const slice = list.slice(0, 6)
          const fastestMap = await fetchFastestPublicRidersForRoutes(
            supabase,
            slice.map((r) => r.id)
          )
          if (!cancelled) {
            setRoutes(slice)
            setPopularStats({})
            setFastestRiders(fastestMap)
          }
        } catch (e2) {
          console.error(e2)
        }
      } finally {
        if (!cancelled) setRoutesReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!showSearch) return
    const id = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(id)
  }, [showSearch])

  useEffect(() => {
    if (!showSearch || !query.trim()) {
      setSearchResults([])
      setSearchLoading(false)
      setSearchHint(null)
      return
    }

    const q = query.trim()
    setSearchLoading(true)
    setSearchHint(null)

    const t = window.setTimeout(() => {
      repoRef.current
        .searchPublicRoutesByName(q, 40)
        .then((found) => {
          setSearchResults(found)
          if (found.length === 0) {
            setSearchHint('No hay rutas públicas con ese nombre.')
          }
        })
        .catch((e: unknown) => {
          console.error(e)
          setSearchResults([])
          setSearchHint('No se pudo buscar. Reintentá en un momento.')
        })
        .finally(() => setSearchLoading(false))
    }, 320)

    return () => window.clearTimeout(t)
  }, [query, showSearch])

  const displayRoutes = useMemo<DiscoverRouteItem[]>(() => {
    return routes.slice(0, 6).map((route) => {
      const st = popularStats[route.id]
      const fr = fastestRiders[route.id]
      let popularityLine: string | null = null
      let avgSpeedLine: string | null = null
      if (st && st.runs7d > 0) {
        popularityLine =
          st.runsToday > 0
            ? `${st.runs7d} bajadas · 7 días · ${st.runsToday} hoy`
            : `${st.runs7d} bajadas · últimos 7 días`
        if (st.avgKmh != null && Number.isFinite(st.avgKmh) && st.avgKmh > 0) {
          avgSpeedLine = `Vel. media ${Math.round(st.avgKmh)} km/h`
        }
      }
      const topRiderName = fr?.name ?? 'Sin récord público'
      const topTime = fr?.timeLabel ?? ''
      const topRiderAvatar =
        fr?.avatarUrl ||
        `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(fr?.userId ?? route.id)}`
      return {
        id: route.id,
        name: route.name,
        difficulty: route.difficulty,
        distanceLabel: formatRouteDistance(route.distanceKm),
        topTime,
        topRiderName,
        topRiderAvatar,
        popularityLine,
        avgSpeedLine,
      }
    })
  }, [routes, popularStats, fastestRiders])

  const listStaggered = useRef(false)

  useEffect(() => {
    if (!routesReady) return
    const map = mapSectionRef.current
    const cta = ctaRef.current
    const timer = window.setTimeout(() => {
      if (map) fadeSlideIn(map, { duration: 480, y: [20, 0] })
      if (cta) fadeSlideIn(cta, { duration: 420, y: [12, 0] })
    }, 30)
    return () => window.clearTimeout(timer)
  }, [routesReady])

  useEffect(() => {
    if (!routesReady || !displayRoutes.length || listStaggered.current) return
    listStaggered.current = true
    const timer = window.setTimeout(() => {
      staggerIn(contentRef.current, { selector: '[data-anime-stagger]', spacing: 70, start: 100 })
    }, 200)
    return () => window.clearTimeout(timer)
  }, [routesReady, displayRoutes.length])

  const closeSearch = () => {
    setShowSearch(false)
    setQuery('')
    setSearchResults([])
    setSearchHint(null)
  }

  const openRouteDetail = (routeId: string) => {
    closeSearch()
    router.push(routeViewUrl(routeId, 'discover'))
  }

  const ctaActions = [
    {
      key: 'ranking',
      href: '/dashboard/ranking',
      label: 'Ranking',
      icon: Trophy,
      className:
        'flex-1 inline-flex min-h-[3.25rem] min-w-0 items-center justify-center gap-2.5 rounded-2xl border border-white/12 bg-white/[0.06] px-5 py-3.5 text-sm font-semibold text-slate-100 shadow-sm hover:bg-white/[0.1] hover:border-gdh-brand/35',
    },
  ] as const

  if (!routesReady) {
    return <PageLoadingShimmer label="Cargando rutas…" />
  }

  return (
    <div className="min-h-screen bg-gdh-canvas-2 text-slate-100">
      <motion.header
        ref={headerRef}
        className={DASHBOARD_APP_TOP_BAR_SHELL_CLASS}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <DashboardAppTopBarInner
          leading={
            <AnimeIconButton
              label="Menú"
              onClick={() => openSidebar()}
              className={DASHBOARD_APP_TOP_BAR_ICON_BUTTON_CLASS}
            >
              <Menu size={22} />
            </AnimeIconButton>
          }
          center={<DashboardAppTopBarHeading title="Descubrir Rutas" />}
          trailing={
            <DashboardAppTopBarTrailingCluster>
              <AnimeIconButton
                label="Buscar rutas"
                onClick={() => setShowSearch((s) => !s)}
                className={`shrink-0 rounded-xl p-2.5 transition-colors ${showSearch ? 'bg-gdh-brand/18 text-gdh-brand-highlight' : 'text-slate-400 hover:bg-white/5'}`}
              >
                <Search size={22} />
              </AnimeIconButton>
            </DashboardAppTopBarTrailingCluster>
          }
        >
          {showSearch ? (
            <div className="relative px-1">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                size={18}
              />
              <input
                ref={searchInputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') closeSearch()
                }}
                placeholder="Nombre de la ruta…"
                autoComplete="off"
                aria-label="Buscar ruta por nombre"
                className="w-full rounded-xl bg-gdh-card border border-white/10 pl-10 pr-10 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-gdh-brand/45"
              />
              {query.trim() !== '' && (
                <button
                  type="button"
                  aria-label="Cerrar búsqueda"
                  onClick={() => {
                    setQuery('')
                    searchInputRef.current?.focus()
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 text-lg leading-none"
                >
                  ×
                </button>
              )}

            {isSearching && (
              <div
                role="listbox"
                aria-label="Resultados de búsqueda"
                className="absolute left-1 right-1 top-full mt-1 z-50 rounded-xl border border-white/10 bg-[#161a1f] shadow-2xl shadow-black/50 max-h-[min(55vh,360px)] overflow-y-auto overscroll-contain"
              >
                {searchLoading ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-slate-400 text-sm">
                    <BrandSpinner className="shrink-0" size={20} />
                    Buscando rutas…
                  </div>
                ) : searchResults.length > 0 ? (
                  <ul className="py-1">
                    {searchResults.map((r) => (
                      <li key={r.id} role="option">
                        <button
                          type="button"
                          onClick={() => openRouteDetail(r.id)}
                          className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-white/5 active:bg-white/10 transition-colors border-b border-white/5 last:border-0"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gdh-brand/14 text-gdh-brand-highlight">
                            <MapPinned size={20} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-white truncate">{r.name}</p>
                            <p className="text-xs text-slate-500">
                              {r.distanceKm.toFixed(2)} km · {r.difficulty}
                            </p>
                          </div>
                          <ChevronRight size={18} className="text-slate-600 shrink-0" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-4 py-8 text-center text-sm text-slate-500">{searchHint || 'Sin resultados.'}</p>
                )}
              </div>
            )}

              {query.trim() === '' && (
                <p className="mt-2 px-1 text-[11px] text-slate-500">
                  Escribí para buscar en rutas públicas. Toca un resultado para abrir el detalle.
                </p>
              )}
            </div>
          ) : null}
        </DashboardAppTopBarInner>
      </motion.header>

      <div ref={contentRef} className="p-3 max-w-lg mx-auto space-y-4 pb-28">
        <motion.section
          ref={mapSectionRef}
          className="relative w-full overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/40 [will-change:opacity,transform]"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.06 }}
        >
          <div className="h-[min(42vh,320px)] w-full min-h-0 transition-[height] duration-300 ease-out">
            <MapPlaceholderWrapper />
          </div>
        </motion.section>

        <motion.div
          ref={ctaRef}
          className="flex gap-2 opacity-0 [will-change:opacity,transform]"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.12 }}
        >
          {ctaActions.map((action) => {
            const Icon = action.icon
            return (
              <motion.div key={action.key} whileTap={{ scale: 0.97 }} whileHover={{ y: -2 }}>
                <Link href={action.href} className={`${action.className} text-center leading-snug`}>
                  <Icon size={18} className="shrink-0 opacity-95" aria-hidden />
                  <span className="px-0.5">{action.label}</span>
                </Link>
              </motion.div>
            )
          })}
        </motion.div>

        {!isSearching && (
          <motion.section
            className="space-y-3 rounded-2xl border border-white/10 bg-gdh-card/70 p-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.16 }}
          >
            <div className="space-y-1">
              <h2 className="text-[1.65rem] leading-none font-bold text-slate-100">Popular Rutas</h2>
              <p className="text-[11px] text-slate-500 leading-snug">
                Orden por bajadas públicas en los últimos 7 días (y hoy si aplica).
              </p>
            </div>
            {displayRoutes.length === 0 ? (
              <p className="text-sm text-slate-500 px-1 py-6 text-center border border-dashed border-white/10 rounded-2xl">
                Aún no hay rutas públicas cerca.
              </p>
            ) : (
              displayRoutes.map((r) => {
                const full = routes.find((x) => x.id === r.id)
                return (
                  <WeeklyRecord
                    key={r.id}
                    routeId={r.id}
                    routeName={r.name}
                    difficulty={r.difficulty}
                    distance={r.distanceLabel}
                    topTime={r.topTime}
                    topRiderName={r.topRiderName}
                    topRiderAvatar={r.topRiderAvatar}
                    trackPoints={full?.trackPoints ?? []}
                    popularityLine={r.popularityLine}
                    avgSpeedLine={r.avgSpeedLine}
                  />
                )
              })
            )}
          </motion.section>
        )}
      </div>
    </div>
  )
}
