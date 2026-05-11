import { decideRiderEmotion } from '@/lib/emotion/EmotionOrchestrator'
import {
  executeGuideMcpTools,
  summarizeObservationsForSubtitle,
  type GuideMcpObservation,
} from '@/lib/guide-ai/guideMcpClient'
import { isGuideMcpToolName, type GuideToolRequest } from '@/lib/guide-ai/guideProtocol'
import { defaultGuideModelChain } from '@/lib/guide-ai/guideModelDefaults'
import { buildGuideNarrationFullPrompt } from '@/lib/guide-ai/guidePromptBuild'
import {
  inferPetMoodFromAttemptSummary,
  inferPetMoodFromCurrentRoute,
  inferPetMoodFromMcpObservations,
  isGuidePetMood,
  mapRiderGuideMoodToPetMood,
  mergeGuidePetMood,
  publishGuidePetMood,
  type GuidePetMood,
} from '@/lib/pet/guidePetBridge'
import { buildNavigationWarmup } from '@/lib/guide-ai/guideNavigationWarmup'
import { coachVosFirstName } from '@/lib/guide-ai/riderCoachDisplayName'
import { buildReplayCoachSnapshot } from '@/lib/guide-ai/guideReplayCoachSnapshot'
import type { GuideContext, GuideReaction, GuideSessionReplaySignal, GuideUiEvent } from '@/lib/guide-ai/types'
import { maybeSubmitPetEmotionProposalFromLlm } from '@/lib/pet/experimentalPetEmotionFromLlm'

const INIT_TIMEOUT_MS = 22_000
const GEN_TIMEOUT_MS = 4_200

let cachedEngine: { modelId: string; engine: any } | null = null

const llmStatusListeners = new Set<() => void>()

function notifyGuideLlmStatus() {
  llmStatusListeners.forEach((fn) => {
    try {
      fn()
    } catch {
      /* noop */
    }
  })
}

export type GuideLlmRuntimeStatus = {
  /** WebGPU disponible en este navegador (requisito para WebLLM). */
  webGpu: boolean
  /** Motor MLC cargado y listo para inferencia. */
  engineReady: boolean
  modelId: string | null
}

export function getGuideLlmRuntimeStatus(): GuideLlmRuntimeStatus {
  if (typeof window === 'undefined') {
    return { webGpu: false, engineReady: false, modelId: null }
  }
  return {
    webGpu: canRunLocalLlm(),
    engineReady: !!cachedEngine,
    modelId: cachedEngine?.modelId ?? null,
  }
}

/** Suscripción a cambios cuando el motor termina de cargar (tras warmup o primera inferencia). */
export function subscribeGuideLlmStatus(listener: () => void): () => void {
  llmStatusListeners.add(listener)
  return () => llmStatusListeners.delete(listener)
}

/** Tras purgar caché WebLLM; fuerza recrear motor en la próxima guía. */
export function resetGuideLlmEngineCache(): void {
  cachedEngine = null
  notifyGuideLlmStatus()
}

/**
 * Precarga el motor en segundo plano para que la UI pueda mostrar el indicador “IA lista”
 * sin esperar al primer mensaje del pet.
 */
export async function warmupGuideLlmEngine(): Promise<boolean> {
  if (!canRunLocalLlm()) return false
  try {
    await getMlEngine()
    return true
  } catch {
    return false
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('timeout')), ms)
    p.then(
      (v) => {
        clearTimeout(id)
        resolve(v)
      },
      (e) => {
        clearTimeout(id)
        reject(e)
      }
    )
  })
}

function canRunLocalLlm() {
  if (typeof window === 'undefined') return false
  const nav = navigator as Navigator & { gpu?: unknown }
  return !!nav.gpu
}

async function getMlEngine(): Promise<any> {
  if (cachedEngine) return cachedEngine.engine
  const webllm = await import('@mlc-ai/web-llm')
  const chain = defaultGuideModelChain()
  let lastErr: unknown
  for (const modelId of chain) {
    try {
      const engine = await withTimeout(webllm.CreateMLCEngine(modelId), INIT_TIMEOUT_MS)
      cachedEngine = { modelId, engine }
      notifyGuideLlmStatus()
      return engine
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('No se pudo cargar ningún modelo WebLLM')
}

/** Sin WebLLM o error de inferencia: mensaje con datos de ficha o intento (evita repetir el warmup). */
function buildDataHeavyFallback(ctx: GuideContext): GuideReaction | null {
  const p = ctx.pathname.toLowerCase()
  if (p.includes('/dashboard/routes/attempt-stats') && ctx.attemptSummary) {
    const a = ctx.attemptSummary
    const bits: string[] = []
    if (a.maxSpeedKmh != null) bits.push(`máx ${a.maxSpeedKmh} km/h`)
    if (a.avgSpeedKmh != null) bits.push(`media ${a.avgSpeedKmh} km/h`)
    if (a.distanceKm != null) bits.push(`${a.distanceKm} km`)
    const m = Math.floor(a.totalTimeSec / 60)
    const s = Math.floor(a.totalTimeSec % 60)
    bits.push(`${m}:${String(s).padStart(2, '0')}`)
    const subtitle = bits.join(' · ').slice(0, 90)
    const nick = coachVosFirstName(ctx.riderDisplayName)
    const nm = (a.routeName || 'Bajada').trim().slice(0, 36)
    const title = nick ? `${nick} · ${nm}` : nm
    return { mood: 'focus', title: title.slice(0, 48), subtitle, duration: 5600 }
  }
  if (p.includes('attempt-replay') && ctx.replaySummary) {
    const rp = ctx.replaySummary
    const bits: string[] = []
    if (rp.gpsPointCount != null && rp.gpsPointCount > 0) bits.push(`${rp.gpsPointCount} pts GPS`)
    if (rp.movingTimeSec != null && Number.isFinite(rp.movingTimeSec)) {
      bits.push(`${Math.round(rp.movingTimeSec)}s en mov.`)
    }
    if (rp.stoppedTimeSec != null && Number.isFinite(rp.stoppedTimeSec) && rp.stoppedTimeSec > 0) {
      bits.push(`${Math.round(rp.stoppedTimeSec)}s parado`)
    }
    if (rp.hasVideo) bits.push('vídeo sync')
    const subtitle = bits.join(' · ').slice(0, 90) || 'Replay listo · revisá la línea en el mapa.'
    const nick = coachVosFirstName(ctx.riderDisplayName)
    const title = nick ? `${nick} · línea en mapa` : 'Línea en mapa'
    return { mood: 'focus', title: title.slice(0, 48), subtitle, duration: 5600 }
  }
  if ((p.includes('route-ranking') || p.includes('/dashboard/ranking')) && ctx.rankingSummary) {
    const rk = ctx.rankingSummary
    const bits: string[] = [`${rk.publicAttemptCount} bajadas públicas (semana)`]
    if (rk.myRank != null && rk.myBestTimeSec != null) {
      const m = Math.floor(rk.myBestTimeSec / 60)
      const s = Math.floor(rk.myBestTimeSec % 60)
      bits.push(`vos #${rk.myRank} · ${m}:${String(s).padStart(2, '0')}`)
    }
    const subtitle = bits.join(' · ').slice(0, 90)
    const nick = coachVosFirstName(ctx.riderDisplayName)
    const rn = (ctx.currentRoute?.name || ctx.topRouteName || 'Ranking').trim().slice(0, 32)
    const title = nick ? `${nick} · ${rn}` : rn
    return { mood: 'triumph', title: title.slice(0, 48), subtitle, duration: 5800 }
  }
  if (p.includes('/dashboard/profile') && ctx.profileSummary) {
    const pr = ctx.profileSummary
    const subtitle = `${pr.preferredRoutesCount} rutas favoritas · ${pr.bikeSetupCount} setup(s) bici`.slice(0, 90)
    const nick = coachVosFirstName(ctx.riderDisplayName)
    const title = nick ? `${nick} · tu garage` : 'Tu perfil rider'
    return { mood: 'guide', title: title.slice(0, 48), subtitle, duration: 5200 }
  }
  if (!p.includes('/dashboard/routes/view') || !ctx.currentRoute) return null
  const cr = ctx.currentRoute
  const bits: string[] = []
  if (cr.distanceKm != null && Number.isFinite(Number(cr.distanceKm))) bits.push(`${Number(cr.distanceKm).toFixed(1)} km`)
  if (cr.elevationGainM != null && Number.isFinite(Number(cr.elevationGainM)) && Number(cr.elevationGainM) > 0) {
    bits.push(`+${Math.round(Number(cr.elevationGainM))} m desnivel`)
  }
  if (cr.difficulty?.trim()) bits.push(String(cr.difficulty).trim())
  if (ctx.routeTrackPointCount != null && ctx.routeTrackPointCount > 0) {
    bits.push(`${ctx.routeTrackPointCount} pts GPS`)
  }
  const desc = (cr.description || '').trim().replace(/\s+/g, ' ')
  const descShort = desc ? (desc.length > 58 ? `${desc.slice(0, 57)}…` : desc) : ''
  const subtitle = [bits.join(' · '), descShort].filter(Boolean).join(' — ').slice(0, 90)
  const nick = coachVosFirstName(ctx.riderDisplayName)
  const titleCore = cr.name.trim().slice(0, 40)
  const title = nick ? `${nick} · ${titleCore}` : titleCore
  return {
    mood: 'focus',
    title: title.slice(0, 48),
    subtitle: subtitle || `Ficha ${cr.name}`.slice(0, 90),
    duration: 5400,
  }
}

function lastReplayTelemetrySample(
  sessionReplay: GuideSessionReplaySignal[] | null | undefined
): GuideSessionReplaySignal | null {
  if (!sessionReplay?.length) return null
  for (let i = sessionReplay.length - 1; i >= 0; i--) {
    const s = sessionReplay[i]!
    if (typeof s.elapsed_sec === 'number' && Number.isFinite(s.elapsed_sec)) return s
  }
  return null
}

/** Sin WebGPU / timeout: coach en replay anclado a la última telemetría de la cola. */
function buildReplayCoachFallback(
  ctx: GuideContext,
  sessionReplay: GuideSessionReplaySignal[] | null | undefined
): GuideReaction | null {
  const p = ctx.pathname.toLowerCase()
  if (!p.includes('attempt-replay')) return null
  const last = lastReplayTelemetrySample(sessionReplay)
  const snap = buildReplayCoachSnapshot(sessionReplay, ctx)
  const routeName = (ctx.currentRoute?.name || ctx.attemptSummary?.routeName || 'La bajada').trim().slice(0, 28)

  const fmtT = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${String(s).padStart(2, '0')}`
  }

  let metrics = ''
  const v = last?.speed_kmh
  if (last) {
    const parts: string[] = [`T+${fmtT(last.elapsed_sec)}`]
    if (typeof v === 'number' && Number.isFinite(v)) parts.push(`${v.toFixed(1)} km/h`)
    if (last.altitude_m != null && Number.isFinite(last.altitude_m)) parts.push(`${Math.round(last.altitude_m)} m`)
    if (snap.progress_pct != null) parts.push(`${snap.progress_pct}% recorrido`)
    metrics = parts.join(' · ')
  }

  const sectorLabel =
    snap.sector_phase === 'inicio'
      ? 'Inicio: '
      : snap.sector_phase === 'cierre'
        ? 'Cierre: '
        : snap.sector_phase === 'medio'
          ? 'Tramo medio: '
          : ''

  const desnivelFrag =
    snap.uphill_pedaling_likely && snap.gps_grade_pct_est != null
      ? `subida ~${snap.gps_grade_pct_est}% (pedaleo probable) · `
      : snap.gps_vertical_mode === 'bajada' || snap.vertical_trend === 'bajando'
        ? snap.altitude_delta_m_recent_window != null
          ? `bajando (~${Math.abs(Math.round(snap.altitude_delta_m_recent_window))} m en ticks) · `
          : 'bajando en el trazado · '
        : snap.gps_vertical_mode === 'subida' || snap.vertical_trend === 'subiendo'
          ? snap.gps_grade_pct_est != null
            ? `pendiente ~${snap.gps_grade_pct_est}% · `
            : 'subiendo · '
          : snap.vertical_trend === 'plano' || snap.gps_vertical_mode === 'plano'
            ? 'tramo casi plano · '
            : ''

  let tip =
    sectorLabel +
    desnivelFrag +
    'Trazada y mirada: un solo gesto de freno antes del ápice suele rendir más que varios pellizcos en la curva.'
  if (typeof v === 'number' && Number.isFinite(v)) {
    if (v < 10) {
      tip =
        sectorLabel +
        desnivelFrag +
        'Velocidad muy baja: si el tramo lo permite, revisá freno en firme y mirada; en bajada suave podés dejar rodar más.'
    } else if (v < 22) {
      tip =
        sectorLabel +
        desnivelFrag +
        'Ritmo suave: usá el desnivel para cargar la delantera sin ahogarla; mirá la salida de la curva.'
    } else if (v >= 45) {
      tip =
        sectorLabel +
        desnivelFrag +
        'V alta: entry wide, un freno claro antes del pliegue y cuerpo listo para extender saliendo.'
    } else if (v >= 30) {
      tip =
        sectorLabel +
        desnivelFrag +
        'Buen ritmo: manos sueltas, peso en pies; referencia lejana para no cerrar línea demasiado pronto.'
    }
  }

  const a = ctx.attemptSummary
  if (a && typeof v === 'number' && Number.isFinite(v) && a.avgSpeedKmh != null && v + 4 < a.avgSpeedKmh) {
    tip =
      sectorLabel +
      desnivelFrag +
      `Por debajo de tu media (~${a.avgSpeedKmh} km/h) en este punto: si hay visibilidad, soltá un poco más de freno.`
  }

  if (snap.coaching_lens === 'postura_manos') {
    tip = (sectorLabel + desnivelFrag + 'Postura: manos sueltas, codos afuera; cadera atrás en aceleración.').slice(
      0,
      200
    )
  } else if (snap.coaching_lens === 'habitos_constancia' && ctx.activitySummary && ctx.activitySummary.attemptsLast7Days > 2) {
    tip = (
      sectorLabel +
      desnivelFrag +
      `Con ${ctx.activitySummary.attemptsLast7Days} bajadas en 7 días, mirá si repetís el mismo freno de más en curvas similares.`
    ).slice(0, 200)
  } else if (snap.coaching_lens === 'ritmo_desnivel') {
    tip = (sectorLabel + desnivelFrag + 'Ritmo: que la pendiente trabaje para vos; un cambio de velocidad claro por tramo.').slice(
      0,
      200
    )
  }

  if (snap.uphill_pedaling_likely) {
    tip = (
      sectorLabel +
      desnivelFrag +
      'Subida: cadencia afinable, peso sobre el asiento cuando el grip lo permita; no compares tu km/h con una bajada.'
    ).slice(0, 200)
  }

  if (!last && !a) return null

  const nick = coachVosFirstName(ctx.riderDisplayName)
  const titleBase = routeName.length ? `${routeName} · coach` : 'Coach replay'
  const title = (nick ? `${nick} · ${titleBase}` : titleBase).slice(0, 48)
  const subtitle = [tip, metrics].filter(Boolean).join(' — ').slice(0, 90) || tip.slice(0, 90)
  return { mood: 'guide', title, subtitle, duration: 6400 }
}

function fallbackReaction(
  ctx: GuideContext,
  event?: Pick<GuideUiEvent, 'type' | 'label'> | null,
  sessionReplay?: GuideSessionReplaySignal[] | null
): GuideReaction {
  if (event?.label === 'interactive:replay_coach_tick') {
    const coach = buildReplayCoachFallback(ctx, sessionReplay)
    if (coach) return coach
  }
  const r = decideRiderEmotion({
    pathname: ctx.pathname,
    loading: false,
    recentTriumph: ctx.recentTriumph,
    fatigue: ctx.fatigue,
    topRouteName: ctx.topRouteName,
    topRouteKm: ctx.topRouteKm,
    weeklyKm: ctx.weeklyKm,
  })
  if (ctx.recentTriumph || ctx.fatigue) {
    return { mood: r.mood, title: r.title, subtitle: r.subtitle, duration: 4200 }
  }
  const dataFirst = buildDataHeavyFallback(ctx)
  if (dataFirst) return dataFirst
  const warm = buildNavigationWarmup(ctx.pathname, ctx)
  return {
    mood: warm.mood,
    title: warm.title.slice(0, 48),
    subtitle: warm.subtitle.slice(0, 90),
    duration: 5200,
  }
}

function normalizeToolRequests(raw: unknown): GuideToolRequest[] {
  if (!Array.isArray(raw)) return []
  const out: GuideToolRequest[] = []
  for (const row of raw.slice(0, 3)) {
    if (!row || typeof row !== 'object') continue
    const tool = String((row as { tool?: string }).tool || '')
    if (!isGuideMcpToolName(tool)) continue
    const args = (row as { args?: Record<string, unknown> }).args
    out.push({ tool, args: args && typeof args === 'object' ? args : {} })
  }
  return out
}

function mergeToolRequests(primary: GuideToolRequest[], extra: GuideToolRequest[]): GuideToolRequest[] {
  const out: GuideToolRequest[] = []
  const seen = new Set<string>()
  for (const req of [...primary, ...extra]) {
    const key = `${req.tool}:${JSON.stringify(req.args || {})}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(req)
    if (out.length >= 3) break
  }
  return out
}

function heuristicToolRequests(context: GuideContext, event: GuideUiEvent): GuideToolRequest[] {
  const out: GuideToolRequest[] = []
  const label = String(event.label || '').toLowerCase()
  const path = String(context.pathname || '').toLowerCase()
  const hasGeo =
    context.approxLat != null &&
    context.approxLng != null &&
    Number.isFinite(Number(context.approxLat)) &&
    Number.isFinite(Number(context.approxLng))

  if (event.type === 'click') {
    out.push({
      tool: 'click_context_actions',
      args: {
        event_type: 'click',
        label: event.label || '',
        pathname: context.pathname,
        ...(hasGeo ? { lat: context.approxLat, lng: context.approxLng } : {}),
      },
    })
    if (label.includes('iniciar') || label.includes('ruta') || path.includes('/routes/view')) {
      out.push({ tool: 'my_weekly_progress', args: {} })
    }
  } else if (event.type === 'navigation' || event.type === 'data-refresh') {
    if (path.includes('/dashboard') && !path.includes('/routes')) {
      out.push({ tool: 'popular_routes_by_attempts', args: { limit: 4, days: 21 } })
    }
    if (path.includes('/routes/view') || path.includes('/routes/attempt')) {
      out.push({
        tool: 'click_context_actions',
        args: {
          event_type: 'navigation',
          label: 'route_detail_opened',
          pathname: context.pathname,
          ...(hasGeo ? { lat: context.approxLat, lng: context.approxLng } : {}),
        },
      })
      if (context.routeId) {
        out.push({ tool: 'get_route_by_id', args: { route_id: context.routeId } })
      }
    }
    out.push({ tool: 'my_weekly_progress', args: {} })
    if (event.type === 'data-refresh') {
      out.push({
        tool: 'click_context_actions',
        args: {
          event_type: 'navigation',
          label: event.label || 'followup',
          pathname: context.pathname,
          ...(hasGeo ? { lat: context.approxLat, lng: context.approxLng } : {}),
        },
      })
    }
  }

  if (hasGeo) {
    out.push({
      tool: 'nearby_route_insights',
      args: { lat: context.approxLat, lng: context.approxLng, limit: 4, days: 21 },
    })
  }
  return out.slice(0, 3)
}

function mergePetInference(
  observations: GuideMcpObservation[] | null,
  context: GuideContext | null | undefined
): GuidePetMood | null {
  const mcp = observations?.length ? inferPetMoodFromMcpObservations(observations) : null
  const attempt = context?.attemptSummary != null ? inferPetMoodFromAttemptSummary(context.attemptSummary) : null
  const route =
    context?.currentRoute != null
      ? inferPetMoodFromCurrentRoute(context.currentRoute, context.routeTrackPointCount ?? null)
      : null
  if (mcp === 'warning' || route === 'warning' || attempt === 'warning') return 'warning'
  if (mcp) return mcp
  if (attempt) return attempt
  return route
}

function finalizeGuideReaction(
  r: GuideReaction,
  parsedPetMood: unknown,
  observations: GuideMcpObservation[] | null,
  context?: GuideContext | null
): GuideReaction {
  const inferred = mergePetInference(observations, context ?? null)
  const fromGlob = mapRiderGuideMoodToPetMood(r.mood)
  const decoded = isGuidePetMood(parsedPetMood) ? parsedPetMood : undefined
  const pet_mood = mergeGuidePetMood(decoded ?? fromGlob, inferred)
  publishGuidePetMood({ petMood: pet_mood, message: r.subtitle })
  return { ...r, pet_mood }
}

function inferMoodFromData(baseMood: GuideReaction['mood'], subtitle: string): GuideReaction['mood'] {
  const s = subtitle.toLowerCase()
  if (/(peor|bajó|sin señal|error|denegado)/.test(s)) return 'warning'
  if (/(mejor|récord|elite|\+[\d.,]+\s?km)/.test(s)) return 'triumph'
  if (/(cerca|zona|acción|semana)/.test(s)) return 'guide'
  return baseMood
}

/**
 * IA ligera on-device (@mlc-ai/web-llm). Cadena en `defaultGuideModelChain()` (`guideModelDefaults.ts`).
 * `NEXT_PUBLIC_GUIDE_LLM_MODEL` debe ser un `model_id` del `prebuiltAppConfig` de tu versión de `@mlc-ai/web-llm`.
 *
 * Instrucciones + skills MCP en `guideProtocol.ts`; ejecución solo lectura en `/api/dashboard/guide-mcp`.
 */
export async function generateGuideReactionWithLightLlm(input: {
  context: GuideContext
  event: GuideUiEvent
  /**
   * `false`: no ejecuta MCP ni heurísticas de red (reutilizar snapshot de pantalla; p. ej. turnos data-refresh).
   * Por defecto una sola tanda de herramientas por navegación a pantalla.
   */
  executeMcpTools?: boolean
  /** Cola de señales estructuradas de replay (CustomEvent); se inyecta en el JSON del prompt. */
  sessionReplaySignals?: GuideSessionReplaySignal[] | null
  /** Estado unificado + candidatos de intención emocional (`buildAffectivePromptAugment`). */
  affectiveAugment?: Record<string, unknown> | null
}): Promise<GuideReaction> {
  const { context, event, executeMcpTools = true, sessionReplaySignals, affectiveAugment } = input
  if (!canRunLocalLlm()) {
    return finalizeGuideReaction(
      fallbackReaction(context, event, sessionReplaySignals),
      undefined,
      null,
      context
    )
  }

  try {
    const engine = await getMlEngine()
    const moods = ['guide', 'focus', 'triumph', 'fatigue', 'warning', 'error']
    const fullPrompt = buildGuideNarrationFullPrompt({
      context,
      event,
      executeMcpTools,
      sessionReplaySignals: sessionReplaySignals ?? null,
      affectiveAugment: affectiveAugment ?? null,
    })

    const res = (await withTimeout(
      engine.chat.completions.create({
        messages: [{ role: 'user', content: fullPrompt }],
        temperature: 0.42,
        max_tokens: 320,
        presence_penalty: 0.55,
      }),
      GEN_TIMEOUT_MS
    )) as any

    const content = String(res?.choices?.[0]?.message?.content || '').trim()
    const m = content.match(/\{[\s\S]*\}/)
    if (!m) return finalizeGuideReaction(fallbackReaction(context, event, sessionReplaySignals), undefined, null, context)

    const parsed = JSON.parse(m[0]) as Partial<GuideReaction> & {
      tool_requests?: unknown
      pet_emotion_proposal?: unknown
    }
    const fb = fallbackReaction(context, event, sessionReplaySignals)

    if (parsed.pet_emotion_proposal !== undefined) {
      void maybeSubmitPetEmotionProposalFromLlm(parsed.pet_emotion_proposal).catch(() => {
        /* experimental: no bloquear guía */
      })
    }
    const mood = parsed.mood && moods.includes(parsed.mood) ? parsed.mood : fb.mood
    let title = String(parsed.title || fb.title).slice(0, 48)
    let subtitle = String(parsed.subtitle || fb.subtitle).slice(0, 90)
    const duration =
      Number(parsed.duration) > 0 ? Math.min(9000, Math.max(2500, Math.floor(Number(parsed.duration)))) : fb.duration

    const heuristic = executeMcpTools ? heuristicToolRequests(context, event) : []
    const modelTools = executeMcpTools ? normalizeToolRequests(parsed.tool_requests) : []
    const toolRequests = mergeToolRequests(modelTools, heuristic)
    if (toolRequests.length > 0) {
      const obs = await executeGuideMcpTools(toolRequests)
      const extra = summarizeObservationsForSubtitle(obs)
      if (extra) {
        subtitle = `${subtitle} · ${extra}`.slice(0, 90)
      }
      const reaction: GuideReaction = {
        mood: inferMoodFromData(mood, subtitle),
        title,
        subtitle,
        duration,
        toolRequests: toolRequests.length ? toolRequests : undefined,
      }
      return finalizeGuideReaction(reaction, parsed.pet_mood, obs, context)
    }
    const reaction: GuideReaction = {
      mood,
      title,
      subtitle,
      duration,
      toolRequests: toolRequests.length ? toolRequests : undefined,
    }
    return finalizeGuideReaction(reaction, parsed.pet_mood, null, context)
  } catch {
    return finalizeGuideReaction(fallbackReaction(context, event, sessionReplaySignals), undefined, null, context)
  }
}
