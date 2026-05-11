'use client'

/**
 * Réplica en cliente (IndexedDB vía runtimeBootstrap): satisface tools del guía sin red.
 * Ejecutar cuando no hay red o el POST a /api/dashboard/guide-mcp falla.
 */

import { haversineKm } from '@/lib/geo/haversineKm'
import { readRuntimeGuideCache } from '@/lib/runtimeBootstrap'
import type { GuideMcpObservation } from '@/lib/guide-ai/guideMcpClient'
import { isGuideMcpToolName, type GuideToolRequest } from '@/lib/guide-ai/guideProtocol'

function clampInt(n: unknown, lo: number, hi: number, fallback: number) {
  const v = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(v)) return fallback
  return Math.max(lo, Math.min(hi, Math.floor(v)))
}

function mondayStartLocalIso(): string {
  const d = new Date()
  const day = d.getDay()
  const diffToMonday = (day + 6) % 7
  d.setDate(d.getDate() - diffToMonday)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function weekWindowFrom(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  const diffToMonday = (day + 6) % 7
  d.setDate(d.getDate() - diffToMonday)
  d.setHours(0, 0, 0, 0)
  const start = d
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  return { start: start.toISOString(), end: end.toISOString() }
}

function numberOrNull(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function isActivePublicRoute(r: Record<string, unknown>): boolean {
  return r.is_public === true && String(r.status || '') === 'active'
}

function summarizeWeeklyRows(rows: Array<{ distance?: number | null; total_time?: number | null }>) {
  let distanceM = 0
  let attempts = 0
  let bestTimeSec: number | null = null
  for (const row of rows) {
    const d = numberOrNull(row.distance)
    const t = numberOrNull(row.total_time)
    if (d != null && d > 0) distanceM += d
    attempts += 1
    if (t != null && t > 0) {
      bestTimeSec = bestTimeSec == null ? t : Math.min(bestTimeSec, t)
    }
  }
  return {
    attempts,
    distance_km: Math.round((distanceM / 1000) * 100) / 100,
    best_time_sec: bestTimeSec != null ? Math.round(bestTimeSec) : null,
  }
}

function parseCompletedAtMs(a: Record<string, unknown>): number {
  const c = a.completed_at
  if (typeof c === 'string') {
    const t = Date.parse(c)
    return Number.isFinite(t) ? t : 0
  }
  return 0
}

function obs(
  tool: string,
  o: Omit<GuideMcpObservation, 'tool'> & { source?: GuideMcpObservation['source'] }
): GuideMcpObservation {
  return { tool, ...o, source: o.source ?? 'local' }
}

function routeUpdatedAtMs(r: Record<string, unknown>): number {
  const u = r.updated_at ?? r.created_at
  if (typeof u === 'string') {
    const t = Date.parse(u)
    return Number.isFinite(t) ? t : 0
  }
  return 0
}

type Cache = {
  routes: Array<Record<string, unknown>>
  attempts: Array<Record<string, unknown>>
  routeById: Map<string, Record<string, unknown>>
}

function buildRouteMap(routes: Array<Record<string, unknown>>): Map<string, Record<string, unknown>> {
  const m = new Map<string, Record<string, unknown>>()
  for (const r of routes) {
    const id = String(r.id ?? '').trim()
    if (id) m.set(id, r)
  }
  return m
}

function resolveOne(
  tool: string,
  args: Record<string, unknown>,
  cache: Cache
): GuideMcpObservation {
  const { routes, attempts, routeById } = cache
  const publicRoutes = routes.filter(isActivePublicRoute)

  if (tool === 'list_public_routes_popular') {
    const limit = clampInt(args.limit, 1, 8, 5)
    const sorted = [...publicRoutes].sort((a, b) => routeUpdatedAtMs(b) - routeUpdatedAtMs(a))
    const slice = sorted.slice(0, limit).map((r) => ({
      id: r.id,
      name: r.name,
      distance_km: r.distance_km,
      difficulty: r.difficulty,
    }))
    return obs(tool, { ok: true, data: slice, source: 'local' })
  }

  if (tool === 'popular_routes_by_attempts') {
    const limit = clampInt(args.limit, 1, 8, 5)
    const sorted = [...publicRoutes].sort((a, b) => routeUpdatedAtMs(b) - routeUpdatedAtMs(a))
    const slice = sorted.slice(0, limit).map((r) => ({
      id: r.id,
      name: r.name,
      distance_km: r.distance_km,
      difficulty: r.difficulty,
      start_lat: r.start_lat,
      start_lng: r.start_lng,
      public_attempts_in_window: 0,
    }))
    return obs(tool, {
      ok: true,
      data: slice,
      source: 'local_partial',
      meta: { degraded: true, note: 'popularidad_global_no_disponible_offline' },
    })
  }

  if (tool === 'my_best_times_this_week') {
    const limit = clampInt(args.limit, 1, 8, 5)
    const weekStart = mondayStartLocalIso()
    const weekMs = Date.parse(weekStart)
    const inWeek = attempts.filter((a) => parseCompletedAtMs(a) >= weekMs)
    const rows = [...inWeek]
      .filter((a) => {
        const t = numberOrNull(a.total_time)
        return t != null && t > 0
      })
      .sort((a, b) => (numberOrNull(a.total_time) ?? 99e9) - (numberOrNull(b.total_time) ?? 99e9))
      .slice(0, limit)
      .map((a) => {
        const rid = String(a.route_id ?? '')
        const route = routeById.get(rid)
        return {
          id: a.id,
          route_id: rid,
          total_time: a.total_time,
          distance: a.distance,
          completed_at: a.completed_at,
          routes: route
            ? { name: route.name, distance_km: route.distance_km }
            : { name: null, distance_km: null },
        }
      })
    return obs(tool, { ok: true, data: rows, source: 'local' })
  }

  if (tool === 'closest_public_routes') {
    const limit = clampInt(args.limit, 1, 10, 5)
    const lat = Number(args.lat)
    const lng = Number(args.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return obs(tool, { ok: false, error: 'lat y lng numéricos requeridos', source: 'local' })
    }
    const scored = publicRoutes
      .map((r) => {
        const slat = Number(r.start_lat)
        const slng = Number(r.start_lng)
        const kmToStart =
          Number.isFinite(slat) && Number.isFinite(slng) ? haversineKm(lat, lng, slat, slng) : 9e6
        return {
          id: r.id,
          name: r.name,
          distance_km: r.distance_km,
          difficulty: r.difficulty,
          start_lat: r.start_lat,
          start_lng: r.start_lng,
          km_to_start: Math.round(kmToStart * 100) / 100,
        }
      })
      .sort((a, b) => a.km_to_start - b.km_to_start)
      .slice(0, limit)
    return obs(tool, { ok: true, data: scored, source: 'local' })
  }

  if (tool === 'list_my_recent_attempts') {
    const limit = clampInt(args.limit, 1, 12, 6)
    const sorted = [...attempts].sort((a, b) => parseCompletedAtMs(b) - parseCompletedAtMs(a))
    const slice = sorted.slice(0, limit).map((a) => ({
      id: a.id,
      route_id: a.route_id,
      total_time: a.total_time,
      distance: a.distance,
      completed_at: a.completed_at,
    }))
    return obs(tool, { ok: true, data: slice, source: 'local' })
  }

  if (tool === 'get_route_by_id') {
    const routeId = typeof args.route_id === 'string' ? args.route_id.trim() : ''
    if (!routeId) return obs(tool, { ok: false, error: 'route_id requerido', source: 'local' })
    const r = routeById.get(routeId)
    if (!r) {
      return obs(tool, {
        ok: false,
        error: 'ruta no encontrada en caché local (sincronizá con red para detalle)',
        source: 'local_partial',
      })
    }
    const data = {
      id: r.id,
      name: r.name,
      description: r.description ?? null,
      distance_km: r.distance_km,
      elevation_gain_m: r.elevation_gain_m ?? null,
      difficulty: r.difficulty,
      is_public: r.is_public,
      status: r.status,
    }
    return obs(tool, { ok: true, data, source: 'local' })
  }

  if (tool === 'my_weekly_progress') {
    const now = new Date()
    const thisWeek = weekWindowFrom(now)
    const prevStartDate = new Date(thisWeek.start)
    prevStartDate.setDate(prevStartDate.getDate() - 7)
    const prevWeek = weekWindowFrom(prevStartDate)

    const inRange = (a: Record<string, unknown>, start: string, end: string) => {
      const t = parseCompletedAtMs(a)
      const s = Date.parse(start)
      const e = Date.parse(end)
      return t >= s && t < e
    }

    const currentRows = attempts.filter((a) => inRange(a, thisWeek.start, thisWeek.end))
    const previousRows = attempts.filter((a) => inRange(a, prevWeek.start, prevWeek.end))
    const current = summarizeWeeklyRows(currentRows as Array<{ distance?: number | null; total_time?: number | null }>)
    const previous = summarizeWeeklyRows(previousRows as Array<{ distance?: number | null; total_time?: number | null }>)
    const distanceDeltaKm = Math.round((current.distance_km - previous.distance_km) * 100) / 100
    const attemptsDelta = current.attempts - previous.attempts
    const bestTimeDeltaSec =
      current.best_time_sec != null && previous.best_time_sec != null
        ? current.best_time_sec - previous.best_time_sec
        : null

    return obs(tool, {
      ok: true,
      data: {
        current,
        previous,
        delta: {
          distance_km: distanceDeltaKm,
          attempts: attemptsDelta,
          best_time_sec: bestTimeDeltaSec,
        },
      },
      source: 'local',
    })
  }

  if (tool === 'nearby_route_insights') {
    const limit = clampInt(args.limit, 1, 8, 4)
    const lat = Number(args.lat)
    const lng = Number(args.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return obs(tool, { ok: false, error: 'lat y lng numéricos requeridos', source: 'local' })
    }
    const nearest = publicRoutes
      .map((r) => {
        const slat = Number(r.start_lat)
        const slng = Number(r.start_lng)
        const kmToStart =
          Number.isFinite(slat) && Number.isFinite(slng) ? haversineKm(lat, lng, slat, slng) : 9e6
        return {
          ...(r as Record<string, unknown>),
          km_to_start: Math.round(kmToStart * 100) / 100,
        }
      })
      .sort((a, b) => (a as { km_to_start: number }).km_to_start - (b as { km_to_start: number }).km_to_start)
      .slice(0, limit) as Array<Record<string, unknown> & { km_to_start: number }>

    const routeIds = nearest.map((x) => String(x.id))
    const myBest = new Map<string, number>()
    for (const a of attempts) {
      const rid = String((a as { route_id?: string }).route_id || '')
      const tt = numberOrNull((a as { total_time?: number | null }).total_time)
      if (!rid || !routeIds.includes(rid) || tt == null || tt <= 0) continue
      myBest.set(rid, myBest.has(rid) ? Math.min(myBest.get(rid)!, tt) : tt)
    }

    const enriched = nearest.map((r) => ({
      id: r.id,
      name: r.name,
      distance_km: r.distance_km,
      difficulty: r.difficulty,
      start_lat: r.start_lat,
      start_lng: r.start_lng,
      km_to_start: r.km_to_start,
      public_attempts_recent: 0,
      my_best_time_sec: myBest.has(String(r.id)) ? Math.round(myBest.get(String(r.id))!) : null,
    }))
    return obs(tool, {
      ok: true,
      data: enriched,
      source: 'local_partial',
      meta: { degraded: true, note: 'actividad_publica_zona_no_disponible_offline' },
    })
  }

  if (tool === 'click_context_actions') {
    const eventType = typeof args.event_type === 'string' ? args.event_type.trim() : ''
    const label = typeof args.label === 'string' ? args.label.trim() : ''
    const pathname = typeof args.pathname === 'string' ? args.pathname.trim() : ''
    const latArg = numberOrNull(args.lat)
    const lngArg = numberOrNull(args.lng)
    const labelLc = label.toLowerCase()
    const pathLc = pathname.toLowerCase()

    const suggestions: string[] = []
    if (labelLc.includes('iniciar')) suggestions.push('verificar cercanía al inicio y mejor tiempo personal')
    if (labelLc.includes('ranking') || pathLc.includes('/ranking')) suggestions.push('mostrar referencia de ranking y rival más cercano')
    if (labelLc.includes('ruta') || pathLc.includes('/routes/view')) suggestions.push('resumir dificultad/longitud y progreso del rider en esta zona')
    if (suggestions.length === 0) suggestions.push('contextualizar con actividad reciente y progreso semanal')

    const weekStart = mondayStartLocalIso()
    const weekMs = Date.parse(weekStart)
    const weeklyRows = attempts.filter((a) => parseCompletedAtMs(a) >= weekMs)
    const recentSorted = [...attempts].sort((a, b) => parseCompletedAtMs(b) - parseCompletedAtMs(a))

    let nearbyHint: { route_name: string; km_to_start: number } | null = null
    if (latArg != null && lngArg != null) {
      const top = publicRoutes
        .map((r) => {
          const slat = Number(r.start_lat)
          const slng = Number(r.start_lng)
          const km =
            Number.isFinite(slat) && Number.isFinite(slng) ? haversineKm(latArg, lngArg, slat, slng) : 9e6
          return { route_name: String(r.name || ''), km_to_start: Math.round(km * 100) / 100 }
        })
        .sort((a, b) => a.km_to_start - b.km_to_start)[0]
      if (top?.route_name) nearbyHint = top
    }

    return obs(tool, {
      ok: true,
      data: {
        event_type: eventType || 'click',
        label,
        pathname,
        suggestions,
        weekly: summarizeWeeklyRows(
          weeklyRows as Array<{ distance?: number | null; total_time?: number | null }>
        ),
        recent_attempts_count: Math.min(6, recentSorted.length),
        nearby_hint: nearbyHint,
      },
      source: 'local',
    })
  }

  if (tool === 'request_maintenance_catalog_research') {
    return obs(tool, {
      ok: false,
      error: 'Encolar investigación de catálogo requiere red (POST /api/dashboard/guide-mcp).',
      source: 'local_partial',
    })
  }

  return obs(tool || 'unknown', { ok: false, error: 'tool no soportada en réplica local', source: 'local' })
}

/**
 * Ejecuta hasta 3 tools usando solo IndexedDB (sin red).
 */
export async function executeGuideToolsFromLocalReplica(requests: GuideToolRequest[]): Promise<GuideMcpObservation[]> {
  const slice = requests.slice(0, 3)
  if (slice.length === 0) return []

  let cache: Cache
  try {
    const { routes, attempts } = await readRuntimeGuideCache()
    cache = {
      routes,
      attempts,
      routeById: buildRouteMap(routes),
    }
  } catch {
    return slice.map((r) => {
      const t = typeof r?.tool === 'string' ? r.tool : '_batch'
      return obs(t, {
        ok: false,
        error: 'Réplica local no disponible (IndexedDB vacía o error)',
        source: 'local',
      })
    })
  }

  const out: GuideMcpObservation[] = []
  for (const reqItem of slice) {
    const tool = typeof reqItem?.tool === 'string' ? reqItem.tool : ''
    const args = reqItem?.args && typeof reqItem.args === 'object' ? reqItem.args : {}
    if (!isGuideMcpToolName(tool)) {
      out.push(obs(tool || 'unknown', { ok: false, error: 'tool no permitida', source: 'local' }))
      continue
    }
    out.push(resolveOne(tool, args as Record<string, unknown>, cache))
  }
  return out
}
