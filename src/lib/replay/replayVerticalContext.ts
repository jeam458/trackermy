import {
  type ReplayGpsPoint,
  haversineMeters,
  interpolateReplayFrame,
} from '@/lib/attemptReplayGps'

/** Modo vertical estimado sobre ~40–120 m de trayecto mirando hacia atrás desde `tMs`. */
export type ReplayVerticalMode = 'subida' | 'bajada' | 'plano' | 'desconocido'

export type ReplayVerticalContext = {
  /** Pendiente media en la ventana: (Δz / distancia horizontal) × 100. */
  grade_pct_est: number | null
  vertical_mode: ReplayVerticalMode
  /** Subida con velocidad coherente con pedaleo (no bajada libre ni parado). */
  uphill_pedaling_likely: boolean
  /** Metros horizontales acumulados en la ventana (para depuración / prompts). */
  lookback_horizontal_m: number | null
}

const STEP_MS = 280
const MIN_HORIZ_M = 38
const MAX_LOOKBACK_MS = 95_000
const GRADE_FLAT_ABS = 2.8
const GRADE_CLIMB = 4.0
const GRADE_DESCENT = -4.0

/**
 * Estima pendiente y contexto vertical recorriendo el track hacia atrás desde el instante actual.
 * Requiere altitud interpolable en al menos parte de la ruta; si no hay cota, todo queda `desconocido`.
 */
export function computeReplayVerticalContext(
  points: ReplayGpsPoint[],
  tMs: number,
  t0: number
): ReplayVerticalContext {
  const empty: ReplayVerticalContext = {
    grade_pct_est: null,
    vertical_mode: 'desconocido',
    uphill_pedaling_likely: false,
    lookback_horizontal_m: null,
  }
  if (points.length < 2) return empty

  const tCur = Math.min(Math.max(tMs, points[0]!.t), points[points.length - 1]!.t)
  const frNew = interpolateReplayFrame(points, tCur, t0)
  if (frNew.altitudeM == null || !Number.isFinite(frNew.altitudeM)) {
    return empty
  }

  /** Avanza hacia el pasado: segmentos (t − STEP → t) suman distancia sobre el trazado. */
  let totalHoriz = 0
  let tYounger = tCur
  let frYounger = frNew

  while (totalHoriz < MIN_HORIZ_M && tCur - tYounger < MAX_LOOKBACK_MS) {
    const tOlder = Math.max(points[0]!.t, tYounger - STEP_MS)
    if (tOlder >= tYounger) break
    const frOlder = interpolateReplayFrame(points, tOlder, t0)
    const d = haversineMeters(frOlder.lat, frOlder.lng, frYounger.lat, frYounger.lng)
    if (Number.isFinite(d) && d > 0) totalHoriz += d
    tYounger = tOlder
    frYounger = frOlder
    if (tOlder <= points[0]!.t) break
  }

  const frOldest = frYounger
  const altOld = frOldest.altitudeM
  const altNew = frNew.altitudeM
  if (
    altOld == null ||
    altNew == null ||
    !Number.isFinite(altOld) ||
    !Number.isFinite(altNew) ||
    totalHoriz < 12
  ) {
    return { ...empty, lookback_horizontal_m: totalHoriz > 0 ? Math.round(totalHoriz * 10) / 10 : null }
  }

  const deltaAlt = altNew - altOld
  const grade = (deltaAlt / totalHoriz) * 100

  let vertical_mode: ReplayVerticalMode = 'plano'
  if (Math.abs(grade) < GRADE_FLAT_ABS) {
    vertical_mode = 'plano'
  } else if (grade >= GRADE_CLIMB) {
    vertical_mode = 'subida'
  } else if (grade <= GRADE_DESCENT) {
    vertical_mode = 'bajada'
  } else {
    vertical_mode = 'plano'
  }

  const v =
    frNew.speedKmh != null && Number.isFinite(frNew.speedKmh) ? frNew.speedKmh : null
  const uphill_pedaling_likely =
    vertical_mode === 'subida' &&
    v != null &&
    v >= 5 &&
    v <= 36 &&
    grade >= 5

  return {
    grade_pct_est: Math.round(grade * 10) / 10,
    vertical_mode,
    uphill_pedaling_likely,
    lookback_horizontal_m: Math.round(totalHoriz * 10) / 10,
  }
}
