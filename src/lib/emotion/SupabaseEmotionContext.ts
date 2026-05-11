import type { SupabaseClient } from '@supabase/supabase-js'

export type SupabaseEmotionContext = {
  topRouteName?: string | null
  topRouteKm?: number | null
  weeklyKm?: number | null
  recentTriumph: boolean
  fatigue: boolean
}

/**
 * Contexto read-only desde Supabase para el motor emocional.
 * Diseñado para migrar luego a MCP Supabase sin tocar el orquestador.
 */
export async function fetchSupabaseEmotionContext(params: {
  supabase: SupabaseClient
  userId: string
}): Promise<SupabaseEmotionContext> {
  const { supabase, userId } = params

  const { data: attempts } = await supabase
    .from('route_attempts')
    .select('route_id, distance, total_time, completed_at')
    .eq('user_id', userId)
    .order('completed_at', { ascending: false })
    .limit(80)

  const rows = attempts || []
  const now = Date.now()
  const recentTriumph = rows.some((a) => {
    const t = new Date(String(a.completed_at || '')).getTime()
    return Number.isFinite(t) && now - t < 32 * 60 * 1000
  })
  const fatigue = rows.some((a) => {
    const d = Number(a.distance) || 0
    const tt = Number(a.total_time) || 0
    const t = new Date(String(a.completed_at || '')).getTime()
    const recent = Number.isFinite(t) && now - t < 18 * 60 * 60 * 1000
    return recent && (d >= 26000 || tt >= 4200)
  })

  const startWeekMs = (() => {
    const d = new Date()
    const day = d.getDay()
    const diffToMonday = (day + 6) % 7
    d.setDate(d.getDate() - diffToMonday)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  })()

  const weeklyKm =
    rows
      .filter((a) => {
        const t = new Date(String(a.completed_at || '')).getTime()
        return Number.isFinite(t) && t >= startWeekMs
      })
      .reduce((acc, a) => acc + (Number(a.distance) || 0), 0) / 1000

  const ids = Array.from(
    new Set(
      rows
        .map((a) => String(a.route_id || '').trim())
        .filter((x) => x.length > 0)
    )
  ).slice(0, 25)

  let topRouteName: string | null = null
  let topRouteKm: number | null = null

  if (ids.length > 0) {
    const { data: routeRows } = await supabase
      .from('routes')
      .select('id, name, distance_km, is_public')
      .in('id', ids)
      .eq('is_public', true)
      .limit(25)

    const counts = new Map<string, number>()
    for (const a of rows) {
      const id = String(a.route_id || '')
      if (!id) continue
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    const ranked = [...(routeRows || [])].sort(
      (a, b) => (counts.get(String(b.id)) ?? 0) - (counts.get(String(a.id)) ?? 0)
    )
    const top = ranked[0]
    if (top) {
      topRouteName = String(top.name || '')
      topRouteKm = Number(top.distance_km) || null
    }
  }

  return {
    topRouteName,
    topRouteKm,
    weeklyKm,
    recentTriumph,
    fatigue,
  }
}
