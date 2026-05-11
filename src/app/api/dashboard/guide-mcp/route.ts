import { NextResponse } from 'next/server'
import { createClient } from '@/core/infrastructure/supabase/server'
import type { GuideMcpObservation } from '@/lib/guide-ai/guideMcpClient'
import { isGuideMcpToolName, type GuideToolRequest } from '@/lib/guide-ai/guideProtocol'
import { haversineKm } from '@/lib/geo/haversineKm'
import { enqueueMaintenanceCatalogResearchIfNeeded } from '@/lib/maintenance/enqueueCatalogResearch'

/** Hoy: lectura Supabase (solo lectura). Evolución: capa local/réplica primero, sync en background (véase dataLayerProtocol + runtimeBootstrap IndexedDB). */

function clampInt(n: unknown, lo: number, hi: number, fallback: number) {
  const v = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(v)) return fallback
  return Math.max(lo, Math.min(hi, Math.floor(v)))
}

/** Inicio de semana (lunes 00:00 hora local), alineado al cálculo de km semanales en emociones. */
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

function summarizeWeeklyRows(
  rows: Array<{ distance?: number | null; total_time?: number | null }>
) {
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

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let body: { requests?: GuideToolRequest[] } = {}
  try {
    body = (await req.json()) as { requests?: GuideToolRequest[] }
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const raw = Array.isArray(body.requests) ? body.requests.slice(0, 3) : []
  const observations: GuideMcpObservation[] = []

  for (const reqItem of raw) {
    const tool = typeof reqItem?.tool === 'string' ? reqItem.tool : ''
    const args = reqItem?.args && typeof reqItem.args === 'object' ? reqItem.args : {}
    if (!isGuideMcpToolName(tool)) {
      observations.push({ tool: tool || 'unknown', ok: false, error: 'tool no permitida' })
      continue
    }

    try {
      if (tool === 'list_public_routes_popular') {
        const limit = clampInt(args.limit, 1, 8, 5)
        const { data, error } = await supabase
          .from('routes')
          .select('id, name, distance_km, difficulty')
          .eq('is_public', true)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(limit)
        if (error) throw error
        observations.push({ tool, ok: true, data: data ?? [] })
        continue
      }

      if (tool === 'popular_routes_by_attempts') {
        const limit = clampInt(args.limit, 1, 8, 5)
        const days = clampInt(args.days, 1, 90, 30)
        const since = new Date(Date.now() - days * 86_400_000).toISOString()
        const { data: attempts, error: e1 } = await supabase
          .from('route_attempts')
          .select('route_id')
          .eq('is_public', true)
          .gte('completed_at', since)
        if (e1) throw e1
        const counts = new Map<string, number>()
        for (const row of attempts || []) {
          const id = String((row as { route_id?: string }).route_id || '').trim()
          if (!id) continue
          counts.set(id, (counts.get(id) ?? 0) + 1)
        }
        const topIds = [...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, limit)
          .map(([id]) => id)
        if (topIds.length === 0) {
          observations.push({ tool, ok: true, data: [] })
          continue
        }
        const { data: routes, error: e2 } = await supabase
          .from('routes')
          .select('id, name, distance_km, difficulty, start_lat, start_lng')
          .in('id', topIds)
          .eq('is_public', true)
          .eq('status', 'active')
        if (e2) throw e2
        const merged = (routes || []).map((r) => ({
          ...r,
          public_attempts_in_window: counts.get(String(r.id)) ?? 0,
        }))
        merged.sort(
          (a, b) => (b as { public_attempts_in_window: number }).public_attempts_in_window -
            (a as { public_attempts_in_window: number }).public_attempts_in_window
        )
        observations.push({ tool, ok: true, data: merged })
        continue
      }

      if (tool === 'my_best_times_this_week') {
        const limit = clampInt(args.limit, 1, 8, 5)
        const weekStart = mondayStartLocalIso()
        const { data, error } = await supabase
          .from('route_attempts')
          .select('id, route_id, total_time, distance, completed_at, routes(name, distance_km)')
          .eq('user_id', user.id)
          .gte('completed_at', weekStart)
          .order('total_time', { ascending: true })
          .limit(limit)
        if (error) throw error
        observations.push({ tool, ok: true, data: data ?? [] })
        continue
      }

      if (tool === 'closest_public_routes') {
        const limit = clampInt(args.limit, 1, 10, 5)
        const lat = Number(args.lat)
        const lng = Number(args.lng)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          observations.push({ tool, ok: false, error: 'lat y lng numéricos requeridos' })
          continue
        }
        const { data: routes, error } = await supabase
          .from('routes')
          .select('id, name, distance_km, difficulty, start_lat, start_lng')
          .eq('is_public', true)
          .eq('status', 'active')
          .limit(140)
        if (error) throw error
        const scored = (routes || [])
          .map((r) => {
            const slat = Number(r.start_lat)
            const slng = Number(r.start_lng)
            const kmToStart =
              Number.isFinite(slat) && Number.isFinite(slng) ? haversineKm(lat, lng, slat, slng) : 9e6
            return { ...r, km_to_start: Math.round(kmToStart * 100) / 100 }
          })
          .sort((a, b) => (a as { km_to_start: number }).km_to_start - (b as { km_to_start: number }).km_to_start)
          .slice(0, limit)
        observations.push({ tool, ok: true, data: scored })
        continue
      }

      if (tool === 'list_my_recent_attempts') {
        const limit = clampInt(args.limit, 1, 12, 6)
        const { data, error } = await supabase
          .from('route_attempts')
          .select('id, route_id, total_time, distance, completed_at')
          .eq('user_id', user.id)
          .order('completed_at', { ascending: false })
          .limit(limit)
        if (error) throw error
        observations.push({ tool, ok: true, data: data ?? [] })
        continue
      }

      if (tool === 'get_route_by_id') {
        const routeId = typeof args.route_id === 'string' ? args.route_id.trim() : ''
        if (!routeId) {
          observations.push({ tool, ok: false, error: 'route_id requerido' })
          continue
        }
        const { data, error } = await supabase
          .from('routes')
          .select('id, name, description, distance_km, elevation_gain_m, difficulty, is_public, status')
          .eq('id', routeId)
          .maybeSingle()
        if (error) throw error
        if (!data) {
          observations.push({ tool, ok: false, error: 'ruta no encontrada' })
          continue
        }
        observations.push({ tool, ok: true, data })
        continue
      }

      if (tool === 'my_weekly_progress') {
        const now = new Date()
        const thisWeek = weekWindowFrom(now)
        const prevStartDate = new Date(thisWeek.start)
        prevStartDate.setDate(prevStartDate.getDate() - 7)
        const prevWeek = weekWindowFrom(prevStartDate)

        const [{ data: currentRows, error: eCurrent }, { data: previousRows, error: ePrev }] = await Promise.all([
          supabase
            .from('route_attempts')
            .select('distance, total_time')
            .eq('user_id', user.id)
            .gte('completed_at', thisWeek.start)
            .lt('completed_at', thisWeek.end),
          supabase
            .from('route_attempts')
            .select('distance, total_time')
            .eq('user_id', user.id)
            .gte('completed_at', prevWeek.start)
            .lt('completed_at', prevWeek.end),
        ])
        if (eCurrent) throw eCurrent
        if (ePrev) throw ePrev

        const current = summarizeWeeklyRows(currentRows ?? [])
        const previous = summarizeWeeklyRows(previousRows ?? [])
        const distanceDeltaKm = Math.round((current.distance_km - previous.distance_km) * 100) / 100
        const attemptsDelta = current.attempts - previous.attempts
        const bestTimeDeltaSec =
          current.best_time_sec != null && previous.best_time_sec != null
            ? current.best_time_sec - previous.best_time_sec
            : null

        observations.push({
          tool,
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
        })
        continue
      }

      if (tool === 'nearby_route_insights') {
        const limit = clampInt(args.limit, 1, 8, 4)
        const days = clampInt(args.days, 1, 90, 21)
        const lat = Number(args.lat)
        const lng = Number(args.lng)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          observations.push({ tool, ok: false, error: 'lat y lng numéricos requeridos' })
          continue
        }
        const { data: routes, error: eRoutes } = await supabase
          .from('routes')
          .select('id, name, distance_km, difficulty, start_lat, start_lng')
          .eq('is_public', true)
          .eq('status', 'active')
          .limit(180)
        if (eRoutes) throw eRoutes

        const nearest = (routes || [])
          .map((r) => {
            const slat = Number(r.start_lat)
            const slng = Number(r.start_lng)
            const kmToStart =
              Number.isFinite(slat) && Number.isFinite(slng) ? haversineKm(lat, lng, slat, slng) : 9e6
            return { ...r, km_to_start: Math.round(kmToStart * 100) / 100 }
          })
          .sort((a, b) => (a as { km_to_start: number }).km_to_start - (b as { km_to_start: number }).km_to_start)
          .slice(0, limit)
        const routeIds = nearest.map((x) => String(x.id))
        if (routeIds.length === 0) {
          observations.push({ tool, ok: true, data: [] })
          continue
        }
        const since = new Date(Date.now() - days * 86_400_000).toISOString()
        const [{ data: publicAttempts, error: ePub }, { data: myAttempts, error: eMine }] = await Promise.all([
          supabase
            .from('route_attempts')
            .select('route_id')
            .in('route_id', routeIds)
            .eq('is_public', true)
            .gte('completed_at', since),
          supabase
            .from('route_attempts')
            .select('route_id, total_time, completed_at')
            .eq('user_id', user.id)
            .in('route_id', routeIds)
            .order('completed_at', { ascending: false })
            .limit(120),
        ])
        if (ePub) throw ePub
        if (eMine) throw eMine

        const pubCount = new Map<string, number>()
        for (const row of publicAttempts || []) {
          const rid = String((row as { route_id?: string }).route_id || '')
          if (!rid) continue
          pubCount.set(rid, (pubCount.get(rid) ?? 0) + 1)
        }
        const myBest = new Map<string, number>()
        for (const row of myAttempts || []) {
          const rid = String((row as { route_id?: string }).route_id || '')
          const tt = numberOrNull((row as { total_time?: number | null }).total_time)
          if (!rid || tt == null || tt <= 0) continue
          myBest.set(rid, myBest.has(rid) ? Math.min(myBest.get(rid) as number, tt) : tt)
        }

        const enriched = nearest.map((r) => ({
          ...r,
          public_attempts_recent: pubCount.get(String(r.id)) ?? 0,
          my_best_time_sec: myBest.has(String(r.id)) ? Math.round(myBest.get(String(r.id)) as number) : null,
        }))
        observations.push({ tool, ok: true, data: enriched })
        continue
      }

      if (tool === 'click_context_actions') {
        const eventType = typeof args.event_type === 'string' ? args.event_type.trim() : ''
        const label = typeof args.label === 'string' ? args.label.trim() : ''
        const pathname = typeof args.pathname === 'string' ? args.pathname.trim() : ''
        const lat = numberOrNull(args.lat)
        const lng = numberOrNull(args.lng)
        const labelLc = label.toLowerCase()
        const pathLc = pathname.toLowerCase()

        const suggestions: string[] = []
        if (labelLc.includes('iniciar')) suggestions.push('verificar cercanía al inicio y mejor tiempo personal')
        if (labelLc.includes('ranking') || pathLc.includes('/ranking')) suggestions.push('mostrar referencia de ranking y rival más cercano')
        if (labelLc.includes('ruta') || pathLc.includes('/routes/view')) suggestions.push('resumir dificultad/longitud y progreso del rider en esta zona')
        if (suggestions.length === 0) suggestions.push('contextualizar con actividad reciente y progreso semanal')

        const weekStart = mondayStartLocalIso()
        const [{ data: weeklyRows, error: eWeekly }, { data: recentRows, error: eRecent }] = await Promise.all([
          supabase
            .from('route_attempts')
            .select('distance, total_time')
            .eq('user_id', user.id)
            .gte('completed_at', weekStart)
            .limit(40),
          supabase
            .from('route_attempts')
            .select('route_id, total_time, completed_at')
            .eq('user_id', user.id)
            .order('completed_at', { ascending: false })
            .limit(6),
        ])
        if (eWeekly) throw eWeekly
        if (eRecent) throw eRecent

        let nearbyHint: { route_name: string; km_to_start: number } | null = null
        if (lat != null && lng != null) {
          const { data: routes, error: eNear } = await supabase
            .from('routes')
            .select('name, start_lat, start_lng')
            .eq('is_public', true)
            .eq('status', 'active')
            .limit(120)
          if (eNear) throw eNear
          const top = (routes || [])
            .map((r) => {
              const slat = Number(r.start_lat)
              const slng = Number(r.start_lng)
              const km =
                Number.isFinite(slat) && Number.isFinite(slng) ? haversineKm(lat, lng, slat, slng) : 9e6
              return { route_name: String(r.name || ''), km_to_start: Math.round(km * 100) / 100 }
            })
            .sort((a, b) => a.km_to_start - b.km_to_start)[0]
          if (top && top.route_name) nearbyHint = top
        }

        observations.push({
          tool,
          ok: true,
          data: {
            event_type: eventType || 'click',
            label,
            pathname,
            suggestions,
            weekly: summarizeWeeklyRows((weeklyRows as Array<{ distance?: number | null; total_time?: number | null }>) ?? []),
            recent_attempts_count: (recentRows || []).length,
            nearby_hint: nearbyHint,
          },
        })
      } else if (tool === 'request_maintenance_catalog_research') {
        const rawBrand = typeof args.raw_brand === 'string' ? args.raw_brand.trim() : ''
        const rawModel = typeof args.raw_model === 'string' ? args.raw_model.trim() : ''
        const rawVariant = typeof args.raw_variant === 'string' ? args.raw_variant.trim() : ''
        const categorySlug = typeof args.category_slug === 'string' ? args.category_slug.trim() : ''
        const userNotes = typeof args.user_notes === 'string' ? args.user_notes.trim() : ''
        if (!rawBrand) {
          observations.push({ tool, ok: false, error: 'raw_brand requerido' })
        } else {
          const r = await enqueueMaintenanceCatalogResearchIfNeeded(supabase, {
            userId: user.id,
            rawBrand,
            rawModel: rawModel || null,
            rawVariant: rawVariant || null,
            categorySlug: categorySlug || null,
            userNotes: userNotes || null,
            sourceContext: 'guide_mcp_tool',
          })
          observations.push({
            tool,
            ok: true,
            data: {
              queued: r.inserted,
              request_id: r.id ?? null,
              skipped: r.reason === 'covered',
              reason: r.reason ?? null,
            },
          })
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'error'
      observations.push({ tool, ok: false, error: msg })
    }
  }

  return NextResponse.json({ observations })
}
