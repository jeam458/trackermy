import type { GuideContext, GuideDataProvider, GuideGpsHint } from '@/lib/guide-ai/types'
import { inferScreenKind } from '@/lib/guide-ai/guideInteractionCatalog'

/**
 * Adaptador MCP-ready.
 * Actualmente usa endpoint interno; cuando MCP Supabase esté habilitado
 * el backend puede resolver esta misma ruta con llamadas MCP read-only.
 */
export class McpSupabaseGuideProvider implements GuideDataProvider {
  async getContext(input: {
    pathname: string
    userId: string
    geo?: { lat: number; lng: number }
    routeId?: string | null
    attemptId?: string | null
    clientHints?: { gpsHint?: GuideGpsHint; networkOnline?: boolean | null }
    authMetadata?: Record<string, unknown> | null
  }): Promise<GuideContext> {
    const url = new URL('/api/dashboard/guide-context', window.location.origin)
    url.searchParams.set('pathname', input.pathname)
    if (input.routeId) {
      url.searchParams.set('routeId', input.routeId)
    }
    if (input.attemptId) {
      url.searchParams.set('attemptId', input.attemptId)
    }
    if (input.geo) {
      url.searchParams.set('lat', String(input.geo.lat))
      url.searchParams.set('lng', String(input.geo.lng))
    }
    const gh = input.clientHints?.gpsHint
    if (gh && gh !== 'unknown') {
      url.searchParams.set('gpsHint', gh)
    }
    if (input.clientHints?.networkOnline === true) {
      url.searchParams.set('networkOnline', '1')
    } else if (input.clientHints?.networkOnline === false) {
      url.searchParams.set('networkOnline', '0')
    }
    const r = await fetch(url.toString(), { method: 'GET', cache: 'no-store' })
    if (!r.ok) throw new Error(`guide-context ${r.status}`)
    const json = (await r.json()) as GuideContext
    return {
      pathname: input.pathname,
      riderDisplayName: json.riderDisplayName ?? null,
      gpsHint: json.gpsHint ?? input.clientHints?.gpsHint ?? 'unknown',
      networkOnline:
        json.networkOnline !== undefined && json.networkOnline !== null
          ? Boolean(json.networkOnline)
          : input.clientHints?.networkOnline ?? null,
      routeId: json.routeId ?? input.routeId ?? null,
      currentRoute: json.currentRoute ?? null,
      attemptId: json.attemptId ?? input.attemptId ?? null,
      attemptSummary: json.attemptSummary ?? null,
      topRouteName: json.topRouteName ?? null,
      topRouteKm: Number(json.topRouteKm ?? 0) || null,
      weeklyKm: Number(json.weeklyKm ?? 0) || null,
      recentTriumph: Boolean(json.recentTriumph),
      fatigue: Boolean(json.fatigue),
      approxLat: json.approxLat != null && Number.isFinite(Number(json.approxLat)) ? Number(json.approxLat) : null,
      approxLng: json.approxLng != null && Number.isFinite(Number(json.approxLng)) ? Number(json.approxLng) : null,
      routeTrackPointCount:
        json.routeTrackPointCount != null && Number.isFinite(Number(json.routeTrackPointCount))
          ? Math.max(0, Math.floor(Number(json.routeTrackPointCount)))
          : null,
      screenKind: json.screenKind ?? inferScreenKind(input.pathname),
      rankingSummary: json.rankingSummary ?? null,
      replaySummary: json.replaySummary ?? null,
      profileSummary: json.profileSummary ?? null,
      activitySummary: json.activitySummary ?? null,
      riderCoachingSpectrum: json.riderCoachingSpectrum ?? null,
      coachKnowledgeNodes: json.coachKnowledgeNodes ?? null,
      coachKnowledgeSource: json.coachKnowledgeSource ?? null,
      aggregateCoachInsights: json.aggregateCoachInsights ?? null,
    }
  }
}
