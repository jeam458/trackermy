import type { GuideToolRequest } from '@/lib/guide-ai/guideProtocol'

export type GuideMcpObservationSource = 'supabase' | 'local' | 'local_partial'

export type GuideMcpObservation = {
  tool: string
  ok: boolean
  data?: unknown
  error?: string
  /** Origen del dato tras capa híbrida (réplica IndexedDB vs API). */
  source?: GuideMcpObservationSource
  meta?: { stale?: boolean; degraded?: boolean; note?: string }
}

/**
 * Ejecuta skills declaradas por el modelo (solo lectura en servidor).
 * Híbrido: con red usa `/api/dashboard/guide-mcp` (Supabase); sin red o si fetch falla, réplica IndexedDB en el cliente.
 */
export async function executeGuideMcpTools(requests: GuideToolRequest[]): Promise<GuideMcpObservation[]> {
  const slice = requests.slice(0, 3)
  if (slice.length === 0) return []

  const isBrowser = typeof window !== 'undefined'
  const online = isBrowser && typeof navigator !== 'undefined' && navigator.onLine

  if (isBrowser && !online) {
    const { executeGuideToolsFromLocalReplica } = await import('@/lib/guide-ai/guideLocalReplicaBrowser')
    return executeGuideToolsFromLocalReplica(slice)
  }

  try {
    const r = await fetch('/api/dashboard/guide-mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: slice }),
      cache: 'no-store',
    })
    if (!r.ok) {
      if (isBrowser) {
        const { executeGuideToolsFromLocalReplica } = await import('@/lib/guide-ai/guideLocalReplicaBrowser')
        return executeGuideToolsFromLocalReplica(slice)
      }
      return [{ tool: '_batch', ok: false, error: `HTTP ${r.status}` }]
    }
    const json = (await r.json()) as { observations?: GuideMcpObservation[] }
    const obs = Array.isArray(json.observations) ? json.observations : []
    return obs.map((o) => ({ ...o, source: 'supabase' as const }))
  } catch {
    if (isBrowser) {
      const { executeGuideToolsFromLocalReplica } = await import('@/lib/guide-ai/guideLocalReplicaBrowser')
      return executeGuideToolsFromLocalReplica(slice)
    }
    return [{ tool: '_batch', ok: false, error: 'fetch falló' }]
  }
}

export function summarizeObservationsForSubtitle(obs: GuideMcpObservation[]): string {
  const parts: string[] = []
  for (const o of obs) {
    if (!o.ok) continue
    if (o.tool === 'list_public_routes_popular' && Array.isArray(o.data)) {
      const names = (o.data as { name?: string }[]).map((x) => String(x.name || '').trim()).filter(Boolean)
      if (names.length) parts.push(`Top: ${names.slice(0, 2).join(', ')}`)
    } else if (o.tool === 'popular_routes_by_attempts' && Array.isArray(o.data) && o.data.length) {
      const rows = o.data as { name?: string; public_attempts_in_window?: number }[]
      const top = rows[0]
      if (top?.name) {
        const n = top.public_attempts_in_window
        parts.push(`Popular: ${top.name}${n != null ? ` (${n} bajadas)` : ''}`)
      }
    } else if (o.tool === 'my_best_times_this_week' && Array.isArray(o.data) && o.data.length) {
      const first = o.data[0] as {
        total_time?: number
        routes?: { name?: string } | null
      }
      const nm = first?.routes?.name ? String(first.routes.name) : ''
      const tt = Number(first.total_time)
      if (nm && Number.isFinite(tt)) {
        parts.push(`Mejor semana: ${nm} · ${Math.round(tt)}s`)
      }
    } else if (o.tool === 'closest_public_routes' && Array.isArray(o.data) && o.data.length) {
      const r = o.data[0] as { name?: string; km_to_start?: number }
      if (r.name) {
        parts.push(`Cerca: ${r.name}${r.km_to_start != null ? ` ~${r.km_to_start} km` : ''}`)
      }
    } else if (o.tool === 'list_my_recent_attempts' && Array.isArray(o.data)) {
      parts.push(`${(o.data as unknown[]).length} bajadas recientes`)
    } else if (o.tool === 'get_route_by_id' && o.data && typeof o.data === 'object') {
      const d = o.data as { name?: string; distance_km?: number; elevation_gain_m?: number; difficulty?: string }
      if (d.name) {
        const bits: string[] = [String(d.name)]
        if (d.distance_km != null) bits.push(`${Number(d.distance_km).toFixed(2)} km`)
        if (d.elevation_gain_m != null) bits.push(`+${Math.round(Number(d.elevation_gain_m))}m`)
        if (d.difficulty) bits.push(String(d.difficulty))
        parts.push(bits.join(' · '))
      }
    } else if (o.tool === 'my_weekly_progress' && o.data && typeof o.data === 'object') {
      const d = o.data as {
        delta?: { distance_km?: number; attempts?: number; best_time_sec?: number | null }
      }
      const deltaKm = Number(d.delta?.distance_km ?? 0)
      const deltaAttempts = Number(d.delta?.attempts ?? 0)
      const deltaBest = d.delta?.best_time_sec
      const chunks: string[] = []
      chunks.push(`${deltaKm >= 0 ? '+' : ''}${deltaKm.toFixed(1)} km vs semana previa`)
      chunks.push(`${deltaAttempts >= 0 ? '+' : ''}${deltaAttempts} intentos`)
      if (typeof deltaBest === 'number' && Number.isFinite(deltaBest)) {
        chunks.push(`${deltaBest <= 0 ? 'mejor' : 'peor'} ${Math.abs(Math.round(deltaBest))}s`)
      }
      parts.push(chunks.join(' · '))
    } else if (o.tool === 'nearby_route_insights' && Array.isArray(o.data) && o.data.length) {
      const first = o.data[0] as {
        name?: string
        km_to_start?: number
        public_attempts_recent?: number
        my_best_time_sec?: number | null
      }
      if (first?.name) {
        parts.push(
          `Zona: ${first.name}${first.km_to_start != null ? ` ~${first.km_to_start} km` : ''}${first.public_attempts_recent != null ? ` · ${first.public_attempts_recent} bajadas` : ''}`
        )
      }
      if (first?.my_best_time_sec != null) {
        parts.push(`Tu mejor: ${Math.round(Number(first.my_best_time_sec))}s`)
      }
    } else if (o.tool === 'click_context_actions' && o.data && typeof o.data === 'object') {
      const d = o.data as {
        suggestions?: string[]
        weekly?: { distance_km?: number }
        nearby_hint?: { route_name?: string; km_to_start?: number } | null
      }
      if (Array.isArray(d.suggestions) && d.suggestions.length) {
        parts.push(`Acción: ${String(d.suggestions[0]).slice(0, 34)}`)
      }
      if (d.weekly?.distance_km != null) {
        parts.push(`Semana: ${Number(d.weekly.distance_km).toFixed(1)} km`)
      }
      if (d.nearby_hint?.route_name) {
        parts.push(`Cerca: ${d.nearby_hint.route_name}`)
      }
    } else if (o.tool === 'request_maintenance_catalog_research' && o.data && typeof o.data === 'object') {
      const d = o.data as { queued?: boolean; skipped?: boolean; request_id?: string | null }
      if (d.skipped) parts.push('Catálogo: ya cubierto')
      else if (d.queued && d.request_id) parts.push(`Investigación encolada`)
      else parts.push('Catálogo: cola sin cambios')
    }
  }
  return parts.join(' · ').slice(0, 100)
}
