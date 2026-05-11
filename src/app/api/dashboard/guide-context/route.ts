import { NextResponse } from 'next/server'
import { createClient } from '@/core/infrastructure/supabase/server'
import { fetchSupabaseEmotionContext } from '@/lib/emotion/SupabaseEmotionContext'
import { buildGuideAttemptSummaryFromRow, type GuideAttemptDbRow } from '@/lib/guide-ai/guideAttemptSummary'
import { inferScreenKind } from '@/lib/guide-ai/guideInteractionCatalog'
import { loadGuideCoachAttachments } from '@/lib/guide-ai/guideCoachAttachments'
import { augmentGuideContextForScreen } from '@/lib/guide-ai/guideScreenContextAugments'
import { resolveRiderDisplayNameForCoach } from '@/lib/guide-ai/riderCoachDisplayName'
import type { GuideContext } from '@/lib/guide-ai/types'

function parseGpsHint(raw: string | null): 'ok' | 'denied' | 'unavailable' | 'unknown' {
  const v = (raw || '').trim().toLowerCase()
  if (v === 'ok' || v === 'granted') return 'ok'
  if (v === 'denied' || v === 'off' || v === 'false') return 'denied'
  if (v === 'unavailable' || v === 'error') return 'unavailable'
  return 'unknown'
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const pathname = sp.get('pathname') || '/dashboard'
  let routeIdResolved = (sp.get('routeId') || sp.get('id') || '').trim() || null
  const attemptIdParam = (sp.get('attemptId') || '').trim() || null
  const gpsHint = parseGpsHint(sp.get('gpsHint'))
  const netRaw = sp.get('networkOnline')
  let networkOnline: boolean | null = null
  if (netRaw === '1' || netRaw === 'true') networkOnline = true
  else if (netRaw === '0' || netRaw === 'false') networkOnline = false
  const latRaw = sp.get('lat')
  const lngRaw = sp.get('lng')
  const approxLat = latRaw != null && Number.isFinite(Number(latRaw)) ? Number(latRaw) : null
  const approxLng = lngRaw != null && Number.isFinite(Number(lngRaw)) ? Number(lngRaw) : null
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const [{ data: profileRow }, ctx] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
    fetchSupabaseEmotionContext({ supabase, userId: user.id }),
  ])
  const md = (user.user_metadata ?? {}) as Record<string, unknown>
  const fromMeta = (key: string) => {
    const v = md[key]
    return typeof v === 'string' && v.trim() ? v.trim() : ''
  }
  const riderDisplayName = resolveRiderDisplayNameForCoach({
    profileFullName: typeof profileRow?.full_name === 'string' ? profileRow.full_name : null,
    authMetadataFullName: fromMeta('full_name') || null,
  })
  let attemptSummary = null as ReturnType<typeof buildGuideAttemptSummaryFromRow> | null
  if (attemptIdParam) {
    const { data: att } = await supabase
      .from('route_attempts')
      .select('id, route_id, user_id, total_time, avg_speed, max_speed, distance')
      .eq('id', attemptIdParam)
      .maybeSingle()
    if (att && String(att.user_id) === user.id) {
      const rid = String(att.route_id)
      if (!routeIdResolved) routeIdResolved = rid
      const { data: rnm } = await supabase.from('routes').select('name').eq('id', rid).maybeSingle()
      const nm = typeof rnm?.name === 'string' && rnm.name.trim() ? rnm.name.trim() : null
      attemptSummary = buildGuideAttemptSummaryFromRow(att as GuideAttemptDbRow, nm)
    }
  }

  let currentRoute: {
    id: string
    name: string
    description?: string | null
    distanceKm?: number | null
    elevationGainM?: number | null
    difficulty?: string | null
  } | null = null
  let routeTrackPointCount: number | null = null
  if (routeIdResolved) {
    const [{ data: routeData }, countRes] = await Promise.all([
      supabase
        .from('routes')
        .select('id, name, description, distance_km, elevation_gain_m, difficulty')
        .eq('id', routeIdResolved)
        .maybeSingle(),
      supabase.from('route_track_points').select('id', { count: 'exact', head: true }).eq('route_id', routeIdResolved),
    ])
    const c = countRes.count
    routeTrackPointCount = typeof c === 'number' && c >= 0 ? c : null
    if (routeData?.id) {
      currentRoute = {
        id: String(routeData.id),
        name: String(routeData.name || 'Ruta'),
        description: routeData.description ?? null,
        distanceKm: Number.isFinite(Number(routeData.distance_km)) ? Number(routeData.distance_km) : null,
        elevationGainM: Number.isFinite(Number(routeData.elevation_gain_m)) ? Number(routeData.elevation_gain_m) : null,
        difficulty: routeData.difficulty ?? null,
      }
    }
  }
  const base: GuideContext = {
    pathname,
    riderDisplayName,
    gpsHint,
    networkOnline,
    routeId: routeIdResolved,
    currentRoute,
    topRouteName: ctx.topRouteName ?? null,
    topRouteKm: ctx.topRouteKm ?? null,
    weeklyKm: ctx.weeklyKm ?? null,
    recentTriumph: ctx.recentTriumph,
    fatigue: ctx.fatigue,
    approxLat,
    approxLng,
    routeTrackPointCount,
    attemptId: attemptIdParam || null,
    attemptSummary,
    screenKind: inferScreenKind(pathname),
  }
  const [extra, coach] = await Promise.all([
    augmentGuideContextForScreen(supabase, user.id, base),
    loadGuideCoachAttachments(supabase, user.id),
  ])
  return NextResponse.json({
    ...base,
    ...extra,
    riderCoachingSpectrum: coach.riderCoachingSpectrum,
    coachKnowledgeNodes: coach.coachKnowledgeNodes,
    coachKnowledgeSource: coach.coachKnowledgeSource,
  })
}
