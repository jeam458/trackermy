import type { GuideContext, GuideDataProvider, GuideGpsHint } from '@/lib/guide-ai/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchSupabaseEmotionContext } from '@/lib/emotion/SupabaseEmotionContext'
import { buildGuideAttemptSummaryFromRow, type GuideAttemptDbRow } from '@/lib/guide-ai/guideAttemptSummary'
import { inferScreenKind } from '@/lib/guide-ai/guideInteractionCatalog'
import { loadGuideCoachAttachments } from '@/lib/guide-ai/guideCoachAttachments'
import { augmentGuideContextForScreen } from '@/lib/guide-ai/guideScreenContextAugments'
import { resolveRiderDisplayNameForCoach } from '@/lib/guide-ai/riderCoachDisplayName'

export class SupabaseGuideDataProvider implements GuideDataProvider {
  constructor(private readonly supabase: SupabaseClient) {}

  async getContext(input: {
    pathname: string
    userId: string
    geo?: { lat: number; lng: number }
    routeId?: string | null
    attemptId?: string | null
    clientHints?: { gpsHint?: GuideGpsHint; networkOnline?: boolean | null }
    authMetadata?: Record<string, unknown> | null
  }): Promise<GuideContext> {
    const base = await fetchSupabaseEmotionContext({
      supabase: this.supabase,
      userId: input.userId,
      attemptsLimit: 52,
    })

    let attemptSummary = null as GuideContext['attemptSummary']
    let routeIdEffective = input.routeId ?? null
    if (input.attemptId) {
      const { data: att } = await this.supabase
        .from('route_attempts')
        .select('id, route_id, user_id, total_time, avg_speed, max_speed, distance')
        .eq('id', input.attemptId)
        .maybeSingle()
      if (att && String(att.user_id) === input.userId) {
        const rid = String(att.route_id)
        if (!routeIdEffective) routeIdEffective = rid
        const { data: rnm } = await this.supabase.from('routes').select('name').eq('id', rid).maybeSingle()
        const nm = typeof rnm?.name === 'string' && rnm.name.trim() ? rnm.name.trim() : null
        attemptSummary = buildGuideAttemptSummaryFromRow(att as GuideAttemptDbRow, nm)
      }
    }

    let md: Record<string, unknown>
    if (input.authMetadata !== undefined) {
      md = (input.authMetadata ?? {}) as Record<string, unknown>
    } else {
      const { data: authRes } = await this.supabase.auth.getUser()
      md = (authRes.user?.user_metadata ?? {}) as Record<string, unknown>
    }

    const [{ data: profileRow }, routeRes, countRes] = await Promise.all([
      this.supabase.from('profiles').select('full_name').eq('id', input.userId).maybeSingle(),
      routeIdEffective
        ? this.supabase
            .from('routes')
            .select('id, name, description, distance_km, elevation_gain_m, difficulty')
            .eq('id', routeIdEffective)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      routeIdEffective
        ? this.supabase
            .from('route_track_points')
            .select('id', { count: 'exact', head: true })
            .eq('route_id', routeIdEffective)
        : Promise.resolve({ count: null as number | null }),
    ])
    const fromMeta = (key: string) => {
      const v = md[key]
      return typeof v === 'string' && v.trim() ? v.trim() : ''
    }
    let currentRoute: GuideContext['currentRoute'] = null
    const data = routeRes.data as {
      id?: string
      name?: string
      description?: string | null
      distance_km?: number | null
      elevation_gain_m?: number | null
      difficulty?: string | null
    } | null
    if (data?.id) {
      currentRoute = {
        id: String(data.id),
        name: String(data.name || 'Ruta'),
        description: data.description ?? null,
        distanceKm: Number.isFinite(Number(data.distance_km)) ? Number(data.distance_km) : null,
        elevationGainM: Number.isFinite(Number(data.elevation_gain_m)) ? Number(data.elevation_gain_m) : null,
        difficulty: data.difficulty ?? null,
      }
    }
    const rtc = countRes.count
    const routeTrackPointCount =
      routeIdEffective && typeof rtc === 'number' && rtc >= 0 ? rtc : null
    const riderDisplayName = resolveRiderDisplayNameForCoach({
      profileFullName: typeof profileRow?.full_name === 'string' ? profileRow.full_name : null,
      authMetadataFullName: fromMeta('full_name') || null,
    })
    const out: GuideContext = {
      pathname: input.pathname,
      riderDisplayName,
      gpsHint: input.clientHints?.gpsHint ?? 'unknown',
      networkOnline:
        input.clientHints?.networkOnline !== undefined ? input.clientHints.networkOnline : null,
      routeId: routeIdEffective ?? null,
      currentRoute,
      topRouteName: base.topRouteName ?? null,
      topRouteKm: base.topRouteKm ?? null,
      weeklyKm: base.weeklyKm ?? null,
      recentTriumph: base.recentTriumph,
      fatigue: base.fatigue,
      approxLat: input.geo?.lat ?? null,
      approxLng: input.geo?.lng ?? null,
      routeTrackPointCount,
      attemptId: input.attemptId ?? null,
      attemptSummary,
      screenKind: inferScreenKind(input.pathname),
    }
    const [extra, coach] = await Promise.all([
      augmentGuideContextForScreen(this.supabase, input.userId, out),
      loadGuideCoachAttachments(this.supabase, input.userId),
    ])
    return {
      ...out,
      ...extra,
      riderCoachingSpectrum: coach.riderCoachingSpectrum,
      coachKnowledgeNodes: coach.coachKnowledgeNodes,
      coachKnowledgeSource: coach.coachKnowledgeSource,
    }
  }
}
