import { NextResponse } from 'next/server'
import { createClient } from '@/core/infrastructure/supabase/server'
import { buildReelPlanFromAttempt } from '@/lib/reel/buildReelPlanFromAttempt'
import { isReelPlanV1 } from '@/lib/reel/reelPlanTypes'

type Ctx = { params: Promise<{ attemptId: string }> }

/**
 * Genera `reel_plan_json` heurístico (picos GPS / saltos) y lo guarda en el intento.
 * El encoding FFmpeg puede leer el mismo JSON en un worker futuro.
 */
export async function POST(req: Request, ctx: Ctx) {
  const { attemptId } = await ctx.params
  if (!attemptId || typeof attemptId !== 'string') {
    return NextResponse.json({ error: 'attemptId inválido' }, { status: 400 })
  }

  let bodyRaw: Record<string, unknown> = {}
  try {
    bodyRaw = (await req.json()) as Record<string, unknown>
  } catch {
    bodyRaw = {}
  }

  let videoDurationSec: number | null = null
  if (typeof bodyRaw.videoDurationSec === 'number' && Number.isFinite(bodyRaw.videoDurationSec)) {
    videoDurationSec = bodyRaw.videoDurationSec
  }

  const hasMusicUrlKey = 'musicUrl' in bodyRaw
  const musicExplicitNull = hasMusicUrlKey && bodyRaw.musicUrl === null
  let musicUrlStr: string | null = null
  if (typeof bodyRaw.musicUrl === 'string' && bodyRaw.musicUrl.trim()) {
    musicUrlStr = bodyRaw.musicUrl.trim().slice(0, 2000)
  }
  let musicAttribution: string | null = null
  if (typeof bodyRaw.musicAttribution === 'string' && bodyRaw.musicAttribution.trim()) {
    musicAttribution = bodyRaw.musicAttribution.trim().slice(0, 2000)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data: row, error } = await supabase
    .from('route_attempts')
    .select(
      'id, user_id, video_url, video_gps_offset_ms, gps_points, jumps_count, total_time, reel_plan_json'
    )
    .eq('id', attemptId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[reel-plan]', error)
    return NextResponse.json({ error: 'No se pudo leer el intento' }, { status: 500 })
  }
  if (!row) {
    return NextResponse.json({ error: 'Intento no encontrado' }, { status: 404 })
  }

  let videoUrl = typeof row.video_url === 'string' && row.video_url.trim() ? row.video_url.trim() : ''
  if (!videoUrl) {
    const { data: med } = await supabase
      .from('route_attempt_media')
      .select('public_url, kind')
      .eq('attempt_id', attemptId)
      .order('sort_order', { ascending: true })
      .limit(12)
    const firstVid = (med || []).find((m) => m.kind === 'video' && typeof m.public_url === 'string' && m.public_url.trim())
    if (firstVid?.public_url) videoUrl = String(firstVid.public_url).trim()
  }
  if (!videoUrl) {
    return NextResponse.json(
      { error: 'No hay vídeo en este intento (video_url ni galería). Sube al menos un clip.' },
      { status: 400 }
    )
  }

  const plan = buildReelPlanFromAttempt({
    videoSourceUrl: videoUrl,
    videoGpsOffsetMs: Number(row.video_gps_offset_ms) || 0,
    gpsPointsRaw: row.gps_points,
    jumpsCount: row.jumps_count != null ? Number(row.jumps_count) : null,
    totalTimeSec: Number(row.total_time) || 0,
    videoDurationSec,
  })

  const prevPlan = row.reel_plan_json
  if (musicExplicitNull) {
    delete plan.backgroundMusicUrl
    delete plan.backgroundMusicAttribution
  } else if (musicUrlStr) {
    plan.backgroundMusicUrl = musicUrlStr
    plan.backgroundMusicAttribution =
      musicAttribution ?? 'Música de fondo (indicá la licencia en la descripción del reel).'
  } else if (!hasMusicUrlKey && isReelPlanV1(prevPlan)) {
    if (prevPlan.backgroundMusicUrl) plan.backgroundMusicUrl = prevPlan.backgroundMusicUrl
    if (prevPlan.backgroundMusicAttribution) {
      plan.backgroundMusicAttribution = prevPlan.backgroundMusicAttribution
    }
  }

  if (isReelPlanV1(prevPlan) && prevPlan.planSource === 'ai') {
    plan.planSource = 'ai'
  }

  // No incluir `reel_error` aquí: en proyectos sin migración 015 completa PostgREST falla (PGRST204).
  const { error: upErr } = await supabase
    .from('route_attempts')
    .update({
      reel_plan_json: plan,
      reel_status: 'plan_ready',
    })
    .eq('id', attemptId)
    .eq('user_id', user.id)

  if (upErr) {
    console.error('[reel-plan] update', upErr)
    const hint =
      typeof upErr.message === 'string' && upErr.message.includes('reel_')
        ? ' Aplicá la migración supabase/migrations/015_attempt_reel.sql en tu proyecto (Dashboard → SQL o supabase db push).'
        : ''
    return NextResponse.json({ error: `No se pudo guardar el plan.${hint}` }, { status: 500 })
  }

  return NextResponse.json({ plan })
}
