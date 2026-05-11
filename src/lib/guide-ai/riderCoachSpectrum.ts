import type { GuideRiderCoachingSpectrum, GuideRiderCoachingSpectrumLevel } from '@/lib/guide-ai/types'

const WINDOW_DAYS = 90
const STALE_MS = 24 * 60 * 60 * 1000

export const RIDER_COACH_SPECTRUM_WINDOW_DAYS = WINDOW_DAYS
export const RIDER_COACH_SPECTRUM_STALE_MS = STALE_MS

export type AttemptSpectrumRow = {
  max_speed: number
  avg_speed: number
  distance: number
  overall_score: number | null
  hard_brakes_count: number | null
  stops_count: number | null
  elevation_gain: number | null
  /** Ficha de ruta (join); mezcla de terreno / desnivel de catálogo. */
  route_difficulty?: string | null
  route_elevation_gain_m?: number | null
}

/** Heurística 1–5 sobre texto libre de `routes.difficulty`. */
export function difficultyRank(difficulty: string | null | undefined): number {
  if (!difficulty || typeof difficulty !== 'string') return 2
  const t = difficulty.toLowerCase().trim()
  if (/double|doble|extreme|pro|diamond/i.test(t)) return 5
  if (/black|negro|expert|experta/i.test(t)) return 4
  if (/red|roja|hard|dif[ií]cil|advanced/i.test(t)) return 3
  if (/blue|azul|intermediate|media|moderate/i.test(t)) return 2
  if (/green|verde|easy|f[aá]cil|beginner|novice/i.test(t)) return 1
  return 2
}

function mpsToKmh(mps: number): number {
  const v = Number(mps)
  if (!Number.isFinite(v)) return 0
  return Math.round(v * 3.6 * 10) / 10
}

function percentile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))
  return sorted[idx] ?? null
}

function dominantDifficultyStrings(rows: AttemptSpectrumRow[]): string | null {
  const counts = new Map<string, number>()
  for (const r of rows) {
    const d = (r.route_difficulty || '').trim()
    if (!d) continue
    counts.set(d, (counts.get(d) ?? 0) + 1)
  }
  let best: string | null = null
  let n = 0
  for (const [k, v] of counts) {
    if (v > n) {
      n = v
      best = k
    }
  }
  return best
}

function inferLevel(
  n: number,
  p75MaxKmh: number | null,
  avgScore: number | null,
  avgHard: number | null,
  signals: {
    avgAttemptElevM: number | null
    avgRouteElevM: number | null
    dominantDiffRank: number | null
  }
): GuideRiderCoachingSpectrumLevel {
  if (n < 3) return 'sin_datos'
  const mx = p75MaxKmh ?? 0
  const sc = avgScore ?? 0
  const dr = signals.dominantDiffRank ?? 2
  const elevA = signals.avgAttemptElevM ?? 0
  const elevR = signals.avgRouteElevM ?? 0

  // Rutas de catálogo exigentes + ejecución sólida → perfil más alto
  if (dr >= 4 && n >= 5 && sc >= 58 && mx >= 26) {
    if (mx >= 40 && sc >= 68) return 'avanzado'
    return 'intermedio_alto'
  }

  // Mucho desnivel acumulado (ficha o GPS intento) con picos moderados → priorizar técnica / físico
  if (n >= 5 && (elevR > 450 || elevA > 350) && mx < 28 && sc >= 52) {
    return 'intermedio'
  }

  if (mx >= 42 && sc >= 68) return 'avanzado'
  if (mx < 22 && sc > 0 && sc < 52) return 'principiante'
  if (avgHard != null && avgHard > 18 && mx < 30) return 'principiante'
  // Rutas fáciles en catálogo + velocidades bajas → foco base
  if (dr <= 1 && n >= 5 && mx < 18) return 'principiante'
  if (n >= 8 && mx >= 32 && sc >= 58) return 'intermedio_alto'
  return 'intermedio'
}

function routeTerrainHintEs(
  dominant: string | null,
  avgRouteElev: number | null,
  avgAttemptElev: number | null
): string | null {
  const bits: string[] = []
  if (dominant) bits.push(`ruta típica «${dominant.slice(0, 24)}»`)
  if (avgRouteElev != null && avgRouteElev > 200) {
    bits.push(`desnivel medio de ficha ~${Math.round(avgRouteElev)} m`)
  } else if (avgAttemptElev != null && avgAttemptElev > 150) {
    bits.push(`desnivel medio registrado en intentos ~${Math.round(avgAttemptElev)} m`)
  }
  if (!bits.length) return null
  return `Mix de terreno (heurística): ${bits.join(' · ')}.`
}

function buildCoachNotes(
  level: GuideRiderCoachingSpectrumLevel,
  n: number,
  p75Max: number | null,
  avgStops: number | null,
  terrainHint: string | null,
  avgRouteElev: number | null
): string[] {
  const out: string[] = []
  if (n < 3) {
    out.push('Pocas bajadas en la ventana: el nivel sugerido es orientativo hasta sumar más sesiones.')
    return out
  }
  if (level === 'avanzado') {
    out.push('Patrón de picos altos: priorizá margen y repetibilidad de línea vs buscar solo récord en un tramo.')
  } else if (level === 'principiante') {
    out.push('Énfasis en lectura lejana y un solo gesto de freno por curva suele dar el salto más rápido de confianza.')
  } else {
    out.push('Buen volumen: alterná un foco técnico por salida con revisión de video/GPS para cerrar el círculo.')
  }
  if (terrainHint) out.push(terrainHint)
  if (avgRouteElev != null && avgRouteElev > 500) {
    out.push('Mucho desnivel de ficha: el ritmo en km/h convive con carga metabólica; no compares con tramos planos.')
  }
  if (avgStops != null && avgStops > 12) {
    out.push('Muchas paradas frecuentes: revisá si son tácticas o hábito de duda; afecta ritmo.')
  }
  if (p75Max != null && p75Max < 15) {
    out.push('Velocidades máximas moderadas: puede ser trazado técnico o conservadurismo; contrastá con desnivel del día.')
  }
  return out.slice(0, 4)
}

export function computeRiderCoachSpectrumFromRows(rows: AttemptSpectrumRow[]): GuideRiderCoachingSpectrum {
  const n = rows.length
  const now = new Date().toISOString()
  if (n === 0) {
    return {
      window_days: WINDOW_DAYS,
      attempts_count: 0,
      total_distance_km: null,
      avg_max_speed_kmh: null,
      p75_max_speed_kmh: null,
      avg_avg_speed_kmh: null,
      avg_overall_score: null,
      avg_hard_brakes: null,
      avg_stops: null,
      suggested_coach_level: 'sin_datos',
      coach_notes_es: ['Sin bajadas en los últimos 90 días: el coach usará solo la sesión actual cuando exista.'],
      computed_at: now,
      avg_attempt_elevation_gain_m: null,
      avg_route_catalog_elevation_gain_m: null,
      dominant_route_difficulty: null,
      dominant_difficulty_rank: null,
      route_terrain_hint_es: null,
    }
  }

  const maxKmh = rows.map((r) => mpsToKmh(r.max_speed)).sort((a, b) => a - b)
  const avgKmh = rows.map((r) => mpsToKmh(r.avg_speed))
  const distKm = rows.map((r) => Number(r.distance) / 1000)
  const scores = rows.map((r) => (r.overall_score != null ? Number(r.overall_score) : NaN)).filter((x) => Number.isFinite(x))
  const hards = rows
    .map((r) => (r.hard_brakes_count != null ? Number(r.hard_brakes_count) : NaN))
    .filter((x) => Number.isFinite(x))
  const stops = rows.map((r) => (r.stops_count != null ? Number(r.stops_count) : NaN)).filter((x) => Number.isFinite(x))

  const attElevs = rows
    .map((r) => (r.elevation_gain != null ? Number(r.elevation_gain) : NaN))
    .filter((x) => Number.isFinite(x))
  const routeElevs = rows
    .map((r) => (r.route_elevation_gain_m != null ? Number(r.route_elevation_gain_m) : NaN))
    .filter((x) => Number.isFinite(x))

  const p75Max = percentile(maxKmh, 0.75)
  const avgMax = maxKmh.reduce((a, b) => a + b, 0) / maxKmh.length
  const avgAvg = avgKmh.reduce((a, b) => a + b, 0) / avgKmh.length
  const totalDist = distKm.reduce((a, b) => a + b, 0)
  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null
  const avgHard = hards.length ? hards.reduce((a, b) => a + b, 0) / hards.length : null
  const avgStopsVal = stops.length ? stops.reduce((a, b) => a + b, 0) / stops.length : null

  const avgAttemptElevM = attElevs.length
    ? Math.round((attElevs.reduce((a, b) => a + b, 0) / attElevs.length) * 10) / 10
    : null
  const avgRouteElevM = routeElevs.length
    ? Math.round((routeElevs.reduce((a, b) => a + b, 0) / routeElevs.length) * 10) / 10
    : null

  const dominant = dominantDifficultyStrings(rows)
  const dominantRank = dominant != null ? difficultyRank(dominant) : null
  const terrainHint = routeTerrainHintEs(dominant, avgRouteElevM, avgAttemptElevM)

  const suggested = inferLevel(n, p75Max, avgScore, avgHard, {
    avgAttemptElevM,
    avgRouteElevM,
    dominantDiffRank: dominantRank,
  })
  const coach_notes_es = buildCoachNotes(suggested, n, p75Max, avgStopsVal, terrainHint, avgRouteElevM)

  return {
    window_days: WINDOW_DAYS,
    attempts_count: n,
    total_distance_km: Math.round(totalDist * 10) / 10,
    avg_max_speed_kmh: Math.round(avgMax * 10) / 10,
    p75_max_speed_kmh: p75Max != null ? Math.round(p75Max * 10) / 10 : null,
    avg_avg_speed_kmh: Math.round(avgAvg * 10) / 10,
    avg_overall_score: avgScore != null ? Math.round(avgScore * 10) / 10 : null,
    avg_hard_brakes: avgHard != null ? Math.round(avgHard * 10) / 10 : null,
    avg_stops: avgStopsVal != null ? Math.round(avgStopsVal * 10) / 10 : null,
    suggested_coach_level: suggested,
    coach_notes_es,
    computed_at: now,
    avg_attempt_elevation_gain_m: avgAttemptElevM,
    avg_route_catalog_elevation_gain_m: avgRouteElevM,
    dominant_route_difficulty: dominant,
    dominant_difficulty_rank: dominantRank,
    route_terrain_hint_es: terrainHint,
  }
}

export function isRiderSpectrumStale(computedAtIso: string | null | undefined): boolean {
  if (!computedAtIso) return true
  const t = new Date(computedAtIso).getTime()
  if (!Number.isFinite(t)) return true
  return Date.now() - t > STALE_MS
}
