/**
 * Cuándo se ejecuta esto (momento en el flujo de la app):
 * - Solo dentro de `GuideDataProvider.getContext` y de `GET /api/dashboard/guide-context`,
 *   es decir al **armar o refrescar** el `GuideContext` para una vista (pathname + ids).
 * - No corre en cada click ni en cada frame del replay: ahí el “estado vivo” entra por
 *   `GuideUiEvent` + `pageGuideContextRef` + prompts (`PIPELINE_AGENTE` en `guidePromptBuild`).
 * - Objetivo: empaquetar **resúmenes baratos** (ranking/replay/perfil) para que el modelo
 *   no tenga que inventar ni forzar MCP en cada turno.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { parseReplayGpsPoints } from '@/lib/attemptReplayGps'
import { inferScreenKind } from '@/lib/guide-ai/guideInteractionCatalog'
import { fetchMaintenanceHintsForPrimaryBike } from '@/lib/guide-ai/guideMaintenanceCatalog'
import type {
  GuideActivitySummary,
  GuideContext,
  GuideProfileSummary,
  GuideRankingSummary,
  GuideReplaySummary,
} from '@/lib/guide-ai/types'

/** Misma lógica que `route-ranking/page.tsx` (semana calendario local del servidor). */
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

async function fetchGuideActivitySummary(
  supabase: SupabaseClient,
  userId: string
): Promise<GuideActivitySummary> {
  const week = getWeekRange()
  const weekStartIso = week.start.toISOString()
  const weekEndIso = week.end.toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()

  const [{ count: cWeek }, { count: c7 }, lastRes] = await Promise.all([
    supabase
      .from('route_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('completed_at', weekStartIso)
      .lte('completed_at', weekEndIso),
    supabase
      .from('route_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('completed_at', sevenDaysAgo),
    supabase
      .from('route_attempts')
      .select('completed_at')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  const lastAt = lastRes.data as { completed_at?: string } | null
  const lastIso =
    lastAt && typeof lastAt.completed_at === 'string' && lastAt.completed_at.trim()
      ? lastAt.completed_at.trim()
      : null
  return {
    attemptsThisWeek: typeof cWeek === 'number' ? cWeek : 0,
    attemptsLast7Days: typeof c7 === 'number' ? c7 : 0,
    lastCompletedAt: lastIso,
  }
}

/**
 * Enriquece contexto guía en pantallas ranking / replay / perfil (sin “entrenar” el modelo).
 */
export async function augmentGuideContextForScreen(
  supabase: SupabaseClient,
  userId: string,
  ctx: GuideContext
): Promise<
  Partial<
    Pick<
      GuideContext,
      | 'rankingSummary'
      | 'replaySummary'
      | 'profileSummary'
      | 'activitySummary'
      | 'maintenanceHints'
      | 'aggregateCoachInsights'
    >
  >
> {
  const sk = ctx.screenKind ?? inferScreenKind(ctx.pathname)
  const out: Partial<
    Pick<
      GuideContext,
      | 'rankingSummary'
      | 'replaySummary'
      | 'profileSummary'
      | 'activitySummary'
      | 'maintenanceHints'
      | 'aggregateCoachInsights'
    >
  > = {}

  if (sk === 'replay' && ctx.attemptId) {
    const [{ data: row }, activitySummary] = await Promise.all([
      supabase
        .from('route_attempts')
        .select('gps_points, video_url, moving_time, stopped_time, user_id')
        .eq('id', ctx.attemptId)
        .maybeSingle(),
      fetchGuideActivitySummary(supabase, userId),
    ])
    out.activitySummary = activitySummary
    if (row) {
      const r = row as {
        gps_points?: unknown
        video_url?: string | null
        moving_time?: number | null
        stopped_time?: number | null
      }
      const pts = parseReplayGpsPoints(r.gps_points)
      const vid = typeof r.video_url === 'string' && r.video_url.trim().length > 0
      const { count: mediaN } = await supabase
        .from('route_attempt_media')
        .select('id', { count: 'exact', head: true })
        .eq('attempt_id', ctx.attemptId)
      const { count: vidN } = await supabase
        .from('route_attempt_media')
        .select('id', { count: 'exact', head: true })
        .eq('attempt_id', ctx.attemptId)
        .eq('kind', 'video')
      const hasVidMedia = typeof vidN === 'number' && vidN > 0
      const replay: GuideReplaySummary = {
        gpsPointCount: pts.length > 0 ? pts.length : null,
        hasVideo: vid || hasVidMedia,
        hasMedia: typeof mediaN === 'number' && mediaN > 0,
        movingTimeSec: Number.isFinite(Number(r.moving_time)) ? Number(r.moving_time) : null,
        stoppedTimeSec: Number.isFinite(Number(r.stopped_time)) ? Number(r.stopped_time) : null,
      }
      out.replaySummary = replay
    }
  }

  if (sk === 'ranking' && ctx.routeId) {
    const week = getWeekRange()
    const weekStartIso = week.start.toISOString()
    const weekEndIso = week.end.toISOString()
    let countQuery = supabase
      .from('route_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('route_id', ctx.routeId)
      .eq('is_public', true)
      .gte('completed_at', weekStartIso)
      .lte('completed_at', weekEndIso)
    const { count: publicN } = await countQuery
    let myRank: number | null = null
    let myBestTimeSec: number | null = null
    let myBestInLeaderboard = false
    const { data: myBest } = await supabase
      .from('route_attempts')
      .select('id, total_time')
      .eq('route_id', ctx.routeId)
      .eq('user_id', userId)
      .eq('is_public', true)
      .gte('completed_at', weekStartIso)
      .lte('completed_at', weekEndIso)
      .order('total_time', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (myBest && typeof (myBest as { total_time?: unknown }).total_time === 'number') {
      myBestTimeSec = Number((myBest as { total_time: number }).total_time)
      const { count: faster } = await supabase
        .from('route_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('route_id', ctx.routeId)
        .eq('is_public', true)
        .lt('total_time', myBestTimeSec)
        .gte('completed_at', weekStartIso)
        .lte('completed_at', weekEndIso)
      myRank = (faster ?? 0) + 1
      const { data: topPage } = await supabase
        .from('route_attempts')
        .select('user_id, total_time')
        .eq('route_id', ctx.routeId)
        .eq('is_public', true)
        .gte('completed_at', weekStartIso)
        .lte('completed_at', weekEndIso)
        .order('total_time', { ascending: true })
        .limit(25)
      const rows = (topPage || []) as { user_id?: string; total_time?: number }[]
      myBestInLeaderboard = rows.some(
        (e) => e.user_id === userId && typeof e.total_time === 'number' && Math.abs(e.total_time - myBestTimeSec!) < 0.0001
      )
    }
    const ranking: GuideRankingSummary = {
      window: 'weekly',
      publicAttemptCount: typeof publicN === 'number' ? publicN : 0,
      myRank,
      myBestTimeSec,
      myBestInLoadedLeaderboardTop: myBestInLeaderboard,
    }
    out.rankingSummary = ranking
  }

  if (sk === 'profile') {
    const [{ count: prefC }, { count: bikeC }, maintenanceHints] = await Promise.all([
      supabase
        .from('user_routes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_preferred', true),
      supabase
        .from('bike_setups')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
      fetchMaintenanceHintsForPrimaryBike(supabase, userId),
    ])
    const profile: GuideProfileSummary = {
      preferredRoutesCount: typeof prefC === 'number' ? prefC : 0,
      bikeSetupCount: typeof bikeC === 'number' ? bikeC : 0,
    }
    out.profileSummary = profile
    out.maintenanceHints = maintenanceHints.length > 0 ? maintenanceHints : null
  }

  if (sk === 'activity') {
    const [activitySummary, maintenanceHints] = await Promise.all([
      fetchGuideActivitySummary(supabase, userId),
      fetchMaintenanceHintsForPrimaryBike(supabase, userId),
    ])
    out.activitySummary = activitySummary
    out.maintenanceHints = maintenanceHints.length > 0 ? maintenanceHints : null
  }

  try {
    const { data: insightRows, error: insErr } = await supabase
      .from('guide_coach_aggregate_insights')
      .select('insight_es')
      .eq('screen_kind', sk)
      .order('score', { ascending: false })
      .limit(5)
    if (!insErr && insightRows?.length) {
      const lines = insightRows
        .map((r) => (r as { insight_es?: string }).insight_es)
        .filter((s): s is string => typeof s === 'string' && s.trim().length > 4)
      if (lines.length) out.aggregateCoachInsights = lines
    }
  } catch {
    /* sin tabla hasta migrar */
  }

  return out
}
