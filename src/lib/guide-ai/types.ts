import type { RiderGuideMood } from '@/lib/riderGuide'
import type { CoachKnowledgeNode } from '@/lib/guide-ai/coachKnowledgeTree.types'

export type GuideUiEventType = 'navigation' | 'click' | 'toast' | 'data-refresh'

export type GuideUiEvent = {
  type: GuideUiEventType
  pathname: string
  label?: string
  timestamp: number
}

/**
 * Memoria breve de la vista actual (solo cliente → prompt del guía).
 * Ayuda a evitar saludos repetidos y a calibrar ritmo según tiempo en pantalla.
 */
export type GuideInteractionSessionHint = {
  secondsOnScreen: number
  /** Títulos recientes de burbuja (normalmente en minúsculas para dedupe). */
  recentCoachTitles: string[]
  lastTriggerType: GuideUiEventType
}

/** Señal estructurada de replay (CustomEvent → cola de sesión en el prompt). */
export type GuideSessionReplaySignal = {
  kind: 'replay_signal'
  /** `tick`: muestra de telemetría en play (solo cola de sesión / prompt; no evento UI del reproductor). */
  action: 'play' | 'pause' | 'seek' | 'tick'
  /** Segundos desde el inicio del muestreo GPS del intento (eje del reproductor / slider). */
  elapsed_sec: number
  speed_kmh: number | null
  altitude_m: number | null
  at: number
  /** Pendiente estimada en ventana GPS (~40 m mirando atrás). */
  grade_pct_est?: number | null
  /** Clasificación vertical en esa ventana. */
  vertical_mode?: 'subida' | 'bajada' | 'plano' | 'desconocido' | null
  /** Heurística subida + velocidad de pedaleo. */
  uphill_pedaling_likely?: boolean | null
}

export type GuideGpsHint = 'ok' | 'denied' | 'unavailable' | 'unknown'

/** Clasificación de pantalla para tono y ejemplos (derivada del pathname). */
export type GuideScreenKind =
  | 'dashboard_home'
  | 'route_detail'
  | 'attempt_stats'
  | 'replay'
  | 'ranking'
  | 'profile'
  | 'activity'
  | 'discover'
  | 'record'
  | 'other'

/** Resumen del intento para guía / WebLLM (pantalla estadísticas de bajada). */
export type GuideAttemptSummary = {
  attemptId: string
  routeId: string
  routeName: string | null
  totalTimeSec: number
  avgSpeedKmh: number | null
  maxSpeedKmh: number | null
  distanceKm: number | null
}

/** Ranking de ruta (ventana semanal alineada con la UI de route-ranking). */
export type GuideRankingSummary = {
  window: 'weekly'
  publicAttemptCount: number
  myRank: number | null
  myBestTimeSec: number | null
  /** Si el mejor tiempo del usuario aparece entre los ~25 primeros cargados en cliente. */
  myBestInLoadedLeaderboardTop: boolean
}

/** Replay: métricas seguras para el guía sin enviar el JSON GPS completo. */
export type GuideReplaySummary = {
  gpsPointCount: number | null
  hasVideo: boolean
  hasMedia: boolean
  movingTimeSec: number | null
  stoppedTimeSec: number | null
}

/** Perfil: conteos ligeros para microcopy del guía. */
export type GuideProfileSummary = {
  preferredRoutesCount: number
  bikeSetupCount: number
}

/** Actividad: conteos para coaching proactivo (alineado a la vista /dashboard/activity). */
export type GuideActivitySummary = {
  attemptsThisWeek: number
  attemptsLast7Days: number
  /** ISO última bajada registrada, o null. */
  lastCompletedAt: string | null
}

/** Intervalo de servicio del catálogo `maintenance_service_intervals` (solo lectura en cliente). */
export type GuideMaintenanceInterval = {
  serviceKindSlug: string
  intervalHours: number | null
  intervalKm: number | null
  intervalMonths: number | null
  recommendationEs: string
  recommendationEn: string
  sourceLabel: string
}

/**
 * Modelo del catálogo de mantenimiento emparejado heurísticamente con la bici del rider.
 * Los textos son orientativos; el manual del fabricante prevalece.
 */
export type GuideMaintenanceHint = {
  categorySlug: string
  categoryNameEs: string
  categoryNameEn: string
  brandName: string | null
  modelName: string
  /** Vacío = fila base; ej. stroke_216 para misma familia con otra carrera. */
  variantKey: string
  travelMm: number | null
  notesEs: string | null
  notesEn: string | null
  keySpecsEs: string | null
  keySpecsEn: string | null
  intervals: GuideMaintenanceInterval[]
}

/** Nivel sugerido por heurística sobre ventana reciente de bajadas (no es licencia ni certificación). */
export type GuideRiderCoachingSpectrumLevel =
  | 'sin_datos'
  | 'principiante'
  | 'intermedio'
  | 'intermedio_alto'
  | 'avanzado'

/**
 * Espectro agregado del rider (BD `rider_coach_spectrum` + recomputo lazy).
 * Personaliza tono y profundidad del coach sin enviar GPS crudo.
 */
export type GuideRiderCoachingSpectrum = {
  window_days: number
  attempts_count: number
  total_distance_km: number | null
  avg_max_speed_kmh: number | null
  p75_max_speed_kmh: number | null
  avg_avg_speed_kmh: number | null
  avg_overall_score: number | null
  avg_hard_brakes: number | null
  avg_stops: number | null
  suggested_coach_level: GuideRiderCoachingSpectrumLevel
  coach_notes_es: string[]
  computed_at: string
  /** Media de `elevation_gain` del intento en la ventana (m), si hay datos. */
  avg_attempt_elevation_gain_m?: number | null
  /** Media de `routes.elevation_gain_m` en intentos con ficha (m). */
  avg_route_catalog_elevation_gain_m?: number | null
  /** Valor más frecuente de `routes.difficulty` en la ventana. */
  dominant_route_difficulty?: string | null
  /** 1–5 desde `dominant_route_difficulty` (heurística). */
  dominant_difficulty_rank?: number | null
  /** Resumen corto de mix ruta/desnivel para el LLM. */
  route_terrain_hint_es?: string | null
}

export type GuideContext = {
  pathname: string
  /** Perfil (saludo natural). */
  riderDisplayName?: string | null
  /** Pista del cliente: permiso GPS / geolocalización. */
  gpsHint?: GuideGpsHint
  /** navigator.onLine en el dispositivo (null = desconocido). */
  networkOnline?: boolean | null
  routeId?: string | null
  currentRoute?: {
    id: string
    name: string
    description?: string | null
    distanceKm?: number | null
    elevationGainM?: number | null
    difficulty?: string | null
  } | null
  topRouteName?: string | null
  topRouteKm?: number | null
  weeklyKm?: number | null
  recentTriumph: boolean
  fatigue: boolean
  /** Ubicación aproximada del dispositivo (si el usuario concedió permiso). */
  approxLat?: number | null
  approxLng?: number | null
  /** Puntos GPS del trazado (solo ficha / detalle con `routeId`). */
  routeTrackPointCount?: number | null
  attemptId?: string | null
  attemptSummary?: GuideAttemptSummary | null
  screenKind?: GuideScreenKind
  rankingSummary?: GuideRankingSummary | null
  replaySummary?: GuideReplaySummary | null
  profileSummary?: GuideProfileSummary | null
  activitySummary?: GuideActivitySummary | null
  /**
   * Catálogo de mantenimiento (BD) filtrado por texto de bici primaria (marca/modelo/frame/fork/drivetrain).
   * Pantallas perfil y actividad; vacío si no hay coincidencias.
   */
  maintenanceHints?: GuideMaintenanceHint[] | null
  /** Resumen agregado de bajadas recientes para ajustar recomendaciones al “nivel” inferido. */
  riderCoachingSpectrum?: GuideRiderCoachingSpectrum | null
  /**
   * Nodos de la biblioteca de coaching (BD o seed). Solo para armado de prompt en runtime;
   * no es necesario serializarlo en APIs públicas salvo `/api/dashboard/guide-context`.
   */
  coachKnowledgeNodes?: CoachKnowledgeNode[] | null
  coachKnowledgeSource?: 'database' | 'seed' | null
  /**
   * Frases agregadas desde interacciones previas (misma `screen_kind`), sin PII forzada.
   * Las usa el modelo como inspiración, no como verdad literal.
   */
  aggregateCoachInsights?: string[] | null
}

import type { GuideToolRequest } from '@/lib/guide-ai/guideProtocol'
import type { GuidePetMood } from '@/lib/pet/guidePetBridge'

export type GuideReaction = {
  mood: RiderGuideMood
  title: string
  subtitle: string
  duration: number
  /** Estado visual del pet (atlas); opcional: el runtime lo fusiona con datos MCP. */
  pet_mood?: GuidePetMood
  /** Pedidos estilo MCP; el runtime los ejecuta en servidor (solo lectura). */
  toolRequests?: GuideToolRequest[]
}

export interface GuideDataProvider {
  getContext(input: {
    pathname: string
    userId: string
    geo?: { lat: number; lng: number }
    routeId?: string | null
    /** Pantalla estadísticas: enriquece contexto con tiempos/velocidades del intento. */
    attemptId?: string | null
    clientHints?: { gpsHint?: GuideGpsHint; networkOnline?: boolean | null }
  }): Promise<GuideContext>
}
