import type {
  GuideActivitySummary,
  GuideAttemptSummary,
  GuideContext,
  GuideSessionReplaySignal,
} from '@/lib/guide-ai/types'

/**
 * Vista compacta para coach en replay: se calcula en cliente/servidor a partir de
 * `session_recent_replay` + resúmenes ya presentes en GuideContext (sin GPS completo).
 */
export type ReplayCoachSnapshot = {
  /** Tramo narrativo dentro del tiempo total del intento (si hay total_time). */
  sector_phase: 'inicio' | 'medio' | 'cierre' | 'desconocido'
  /** 0–100 según elapsed / total_time del intento. */
  progress_pct: number | null
  /** Δ altitud (m) entre la primera y última muestra `tick` con altitud en la ventana. */
  altitude_delta_m_recent_window: number | null
  /** Segundos de intento cubiertos por esa ventana (entre esas dos muestras). */
  window_sample_span_sec: number | null
  vertical_trend: 'subiendo' | 'bajando' | 'plano' | 'desconocido'
  speed_vs_personal_avg: 'por_debajo' | 'cerca' | 'por_encima' | 'sin_datos'
  /**
   * “Nodo” del mini-árbol de coaching: rota con el tiempo para evitar monólogo en un solo eje
   * (línea, ritmo/desnivel, postura, hábito).
   */
  coaching_lens: 'linea_freno' | 'ritmo_desnivel' | 'postura_manos' | 'habitos_constancia'
  /**
   * Marco de referencia genérico GuardDH (no datos web en vivo). El modelo no debe presentarlo
   * como “tu medición” ni como ranking de terceros.
   */
  curated_reference_hint_es: string | null
  /** Una línea con volumen reciente del rider (si activity_summary está cargado). */
  training_volume_es: string | null
  /** Ventana espacial sobre el track (~40 m); prioridad sobre Δ altitud entre dos ticks. */
  gps_grade_pct_est: number | null
  gps_vertical_mode: 'subida' | 'bajada' | 'plano' | 'desconocido' | null
  uphill_pedaling_likely: boolean
}

function trainingVolumeLine(act: GuideActivitySummary | null | undefined): string | null {
  if (!act) return null
  const w = act.attemptsThisWeek
  const d7 = act.attemptsLast7Days
  if (w <= 0 && d7 <= 0) return null
  const parts: string[] = []
  if (w > 0) parts.push(`esta semana ${w} bajada(s)`)
  if (d7 > 0 && d7 !== w) parts.push(`últimos 7 días ${d7}`)
  return parts.length ? `Volumen: ${parts.join(' · ')}.` : null
}

function curatedReference(speedKmh: number | null, trend: ReplayCoachSnapshot['vertical_trend']): string | null {
  const v = typeof speedKmh === 'number' && Number.isFinite(speedKmh) ? speedKmh : null
  if (trend === 'subiendo' || trend === 'plano') {
    return 'Referencia GuardDH: en subidas/planos el ritmo en km/h suele ser bajo vs la bajada; no compares con tu media de pendiente sin mirar el tramo.'
  }
  if (v != null && v < 12) {
    return 'Referencia GuardDH: bloques muy lentos en bajada suelen ser freno/mirada o tramo técnico; rangos “rápidos” solo aplican con visibilidad y grip.'
  }
  if (v != null && v >= 35 && v < 50) {
    return 'Referencia GuardDH: ritmo medio-alto en bajada suele pedir un freno claro antes del pliegue y cuerpo listo para extender saliendo.'
  }
  if (v != null && v >= 50) {
    return 'Referencia GuardDH: velocidades altas implican margen de línea y lectura de terreno; priorizá un solo gesto de freno antes del ápice.'
  }
  return 'Referencia GuardDH: compará siempre con tu media de ESTE intento y con la pendiente del tramo, no con otros riders anónimos.'
}

function lensFromElapsed(elapsedSec: number): ReplayCoachSnapshot['coaching_lens'] {
  const i = Math.floor(elapsedSec / 22) % 4
  const order: ReplayCoachSnapshot['coaching_lens'][] = [
    'linea_freno',
    'ritmo_desnivel',
    'postura_manos',
    'habitos_constancia',
  ]
  return order[i]!
}

export function buildReplayCoachSnapshot(
  sessionReplay: GuideSessionReplaySignal[] | null | undefined,
  ctx: Pick<GuideContext, 'attemptSummary' | 'activitySummary' | 'currentRoute'>
): ReplayCoachSnapshot {
  const ticks = (sessionReplay || []).filter(
    (s): s is GuideSessionReplaySignal & { elapsed_sec: number } =>
      s.action === 'tick' && typeof s.elapsed_sec === 'number' && Number.isFinite(s.elapsed_sec)
  )

  const last = ticks.length ? ticks[ticks.length - 1]! : null
  const elapsed = last?.elapsed_sec ?? 0

  const total = ctx.attemptSummary?.totalTimeSec
  let sector_phase: ReplayCoachSnapshot['sector_phase'] = 'desconocido'
  let progress_pct: number | null = null
  if (typeof total === 'number' && total > 5 && typeof last?.elapsed_sec === 'number') {
    const r = Math.max(0, Math.min(1, last.elapsed_sec / total))
    progress_pct = Math.round(r * 100)
    if (r < 0.15) sector_phase = 'inicio'
    else if (r > 0.85) sector_phase = 'cierre'
    else sector_phase = 'medio'
  }

  let altitude_delta_m_recent_window: number | null = null
  let window_sample_span_sec: number | null = null
  const withAlt = ticks.filter(
    (t) => t.altitude_m != null && Number.isFinite(Number(t.altitude_m))
  ) as (GuideSessionReplaySignal & { altitude_m: number })[]
  if (withAlt.length >= 2) {
    const a0 = withAlt[0]!
    const a1 = withAlt[withAlt.length - 1]!
    altitude_delta_m_recent_window = Math.round((Number(a1.altitude_m) - Number(a0.altitude_m)) * 10) / 10
    window_sample_span_sec = Math.max(0, a1.elapsed_sec - a0.elapsed_sec)
  }

  const vm = last?.vertical_mode
  const gradeFromGps = last?.grade_pct_est
  let vertical_trend: ReplayCoachSnapshot['vertical_trend'] = 'desconocido'
  if (vm === 'subida') vertical_trend = 'subiendo'
  else if (vm === 'bajada') vertical_trend = 'bajando'
  else if (vm === 'plano') vertical_trend = 'plano'
  else if (altitude_delta_m_recent_window != null && (window_sample_span_sec ?? 0) >= 0.5) {
    if (altitude_delta_m_recent_window > 2) vertical_trend = 'subiendo'
    else if (altitude_delta_m_recent_window < -2) vertical_trend = 'bajando'
    else vertical_trend = 'plano'
  }

  const gps_grade_pct_est =
    typeof gradeFromGps === 'number' && Number.isFinite(gradeFromGps)
      ? Math.round(gradeFromGps * 10) / 10
      : null
  const gps_vertical_mode: ReplayCoachSnapshot['gps_vertical_mode'] =
    vm === 'subida' || vm === 'bajada' || vm === 'plano' || vm === 'desconocido' ? vm : null
  const uphill_pedaling_likely = Boolean(last?.uphill_pedaling_likely)

  const v = last?.speed_kmh
  const avg = ctx.attemptSummary?.avgSpeedKmh
  let speed_vs_personal_avg: ReplayCoachSnapshot['speed_vs_personal_avg'] = 'sin_datos'
  if (typeof v === 'number' && Number.isFinite(v) && typeof avg === 'number' && Number.isFinite(avg)) {
    if (v < avg - 4) speed_vs_personal_avg = 'por_debajo'
    else if (v > avg + 4) speed_vs_personal_avg = 'por_encima'
    else speed_vs_personal_avg = 'cerca'
  }

  const coaching_lens = lensFromElapsed(elapsed)
  const curated_reference_hint_es = curatedReference(
    typeof v === 'number' && Number.isFinite(v) ? v : null,
    vertical_trend
  )

  return {
    sector_phase,
    progress_pct,
    altitude_delta_m_recent_window,
    window_sample_span_sec,
    vertical_trend,
    speed_vs_personal_avg,
    coaching_lens,
    curated_reference_hint_es,
    training_volume_es: trainingVolumeLine(ctx.activitySummary),
    gps_grade_pct_est,
    gps_vertical_mode,
    uphill_pedaling_likely,
  }
}
