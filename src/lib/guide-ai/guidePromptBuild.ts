import { GUIDE_AGENT_PIPELINE } from '@/lib/guide-ai/guideAgentFlow'
import { GUIDE_RULES, GUIDE_SKILLS } from '@/lib/guide-ai/guideProtocol'
import { HYBRID_DATA_SKILL_CONTRACT, TRUTH_CACHE_ARCHITECTURE } from '@/lib/guide-ai/dataLayerProtocol'
import {
  getGuideVoiceProfileAddon,
  getScreenKindOutputHints,
  inferScreenKind,
} from '@/lib/guide-ai/guideInteractionCatalog'
import {
  COACHING_CONTEXT_RULES,
  CONTEXT_REACTION_SKILL,
  HUMAN_INTERACTION_PRINCIPLES,
  GUIDE_NATURAL_INTERACTION_FLOW,
  PET_CONNECTIVITY_VOICE,
  PET_INTERACTIVE_ANALYSIS_CONTRACT,
  PET_VISUAL_BRIDGE,
  SOCIAL_ACCEPTABILITY_RULES,
  TRAIL_BUDDY_IDENTITY,
} from '@/lib/guide-ai/humanInteractionSkill'
import { buildCoachKnowledgeEvidenceFromNodes, COACH_KNOWLEDGE_NODES } from '@/lib/guide-ai/coachKnowledgeTree'
import { buildReplayCoachSnapshot } from '@/lib/guide-ai/guideReplayCoachSnapshot'
import { coachVosFirstName } from '@/lib/guide-ai/riderCoachDisplayName'
import type { GuideContext, GuideInteractionSessionHint, GuideSessionReplaySignal, GuideUiEvent } from '@/lib/guide-ai/types'

export function interactionHint(pathname: string, event: Pick<GuideUiEvent, 'type' | 'label'>): string {
  if (event.label?.startsWith('system:gps_')) {
    return 'Evento de sistema: ubicación degradada (ver gps_hint en JSON). Elegí mood, título, subtítulo y pet_mood en conjunto: analyzing si es ambiguo o permisos; warning si bloquea mapa cercano o seguimiento; neutral solo si el aviso es leve. Dos líneas útiles; estilo [VOZ_CONEXION_OFFLINE].'
  }
  if (event.label === 'system:network_offline') {
    return 'Red caída: leé network_online y qué datos siguen en contexto (current_route, attempt_summary, etc.). mood + pet_mood coherentes con degradación; sin culpar; una acción práctica.'
  }
  if (event.label === 'system:network_online') {
    return 'Red de vuelta: breve reconocimiento + qué se actualiza (sync, ranking, datos frescos). pet_mood alineado (happy/guide según intensidad del dato).'
  }
  if (event.label === 'interactive:replay_coach_tick') {
    return 'Coach en vivo en replay: leé replay_coach_snapshot + coach_knowledge_evidence + session_recent_replay + attempt_summary. Título: frase corta de cabina (≤56 chars) con intención técnica (pendiente, caja, frenos, mirada, cadencia) — prohibido usar solo el nombre de la ruta, “X · coach” o repetir route_name como título entero. Subtítulo: 2–3 frases en tuteo que narren el tramo con datos del snapshot (gps_vertical_mode, gps_grade_pct_est, uphill_pedaling_likely, speed_vs_personal_avg, coaching_lens, sector_phase); hasta ~220 caracteres; una acción concreta por mensaje.'
  }
  if (event.label?.startsWith('interactive:replay_followup_')) {
    return 'Seguís en replay: otro ángulo (tramo distinto, ritmo vs altitud, hábito de mirada/freno). Datos solo del JSON o session_recent_replay; pet_mood coherente; no genérico.'
  }
  if (event.label?.startsWith('interactive:')) {
    return 'Turno interactive:*: interpretá el sufijo del label + el contexto JSON (ruta, intento, actividad, replay). Una lectura integrada; pet_mood coherente con si el rider va bien, mal o necesita duda técnica; sin inventar series temporales.'
  }
  if (event.label?.startsWith('voice:navigate')) {
    return 'Navegación por voz: el rider llegó a esa pantalla por comando (no hay transcripción del micrófono en el JSON). Saludá con un matiz útil del destino (pathname / screen_kind); usá maintenance_hints solo si el contexto corresponde a esa pantalla. source en el label: shortcut = atajo propio; builtin = catálogo fijo. Sin inventar datos; pet_mood coherente con “vamos a esta sección”.'
  }
  const p = pathname.toLowerCase()
  if (p.includes('/dashboard/routes/record')) {
    return 'Modo acompañante en ruta: mensajes cortos, control técnico y seguridad primero.'
  }
  if (p.includes('/dashboard/routes/attempt-stats')) {
    return 'Modo estadísticas: citá números del intento (máx/media, tiempo, km) y un consejo breve de trazado o frenos; si viene coach_knowledge_evidence, enlazá como máximo una idea de la biblioteca a esos números (sin inventar fuentes).'
  }
  if (p.includes('/dashboard/routes/attempt-replay')) {
    if (event.label?.startsWith('replay:')) {
      return 'Modo replay (señal estructurada): leé session_recent_replay (últimas acciones play/pause/seek con elapsed_sec y v/altitud). El event.label replay:* confirma la última acción; narrá tramo o intención sin MCP salvo que falte dato en el JSON.'
    }
    return 'Modo replay: revisión de línea; usá replay_summary (puntos GPS, tiempos en mov/parado, vídeo) sin inventar métricas que no estén en el JSON.'
  }
  if (p.includes('/dashboard/routes/route-ranking') || p.includes('/dashboard/ranking')) {
    return 'Modo ranking: usá ranking_summary (conteo semanal, tu puesto, tu mejor tiempo) solo si viene en contexto; si falta, pedí tool o admití que no hay datos.'
  }
  if (p.includes('/dashboard/profile')) {
    return 'Modo perfil: saludo en tuteo; si hay rider_vos_first_name en el JSON usalo con naturalidad, si no hablá de "vos". Una prioridad (bici, rutas favoritas) usando profile_summary si existe. Si maintenance_hints trae filas del catálogo GuardDH, intervalos y compatibilidades SOLO desde ese JSON (key_specs_*, intervals.*); son orientativos: el manual del fabricante y el taller mandan.'
  }
  if (
    p.includes('/dashboard/routes/attempt') &&
    !p.includes('attempt-replay') &&
    !p.includes('attempt-stats')
  ) {
    return 'Modo análisis: feedback específico por rendimiento y ejecución.'
  }
  if (p.includes('/dashboard/activity')) {
    return 'Modo progreso: foco en consistencia semanal, hábitos y pequeñas mejoras. Si maintenance_hints viene con datos, podés enlazar 1–2 intervalos concretos (horas/km/meses) al volumen reciente sin inventar números fuera del JSON.'
  }
  if (event.type === 'click') {
    return 'Modo micro-coaching por interacción: responde a la acción que acaba de hacer.'
  }
  return 'Modo guía general: claro, cercano y accionable.'
}

const skillsJson = JSON.stringify(GUIDE_SKILLS, null, 0)

/**
 * Mismo texto de sistema + tarea que WebLLM local (`lightweightGuideLlm`), para servidor híbrido.
 */
export function buildGuideNarrationFullPrompt(input: {
  context: GuideContext
  event: GuideUiEvent
  executeMcpTools: boolean
  /** Cola reciente de señales de replay (play/pause/seek + tiempo en pista). */
  sessionReplaySignals?: GuideSessionReplaySignal[] | null
  /**
   * Estado unificado + candidatos de atlas (`buildAffectivePromptAugment`).
   * La UI actualiza el controlador; el modelo solo lee este JSON.
   */
  affectiveAugment?: Record<string, unknown> | null
  /** Memoria breve de la vista (cliente): ritmo y anti-repetición. */
  sessionHint?: GuideInteractionSessionHint | null
}): string {
  const { context, event, executeMcpTools, sessionReplaySignals, affectiveAugment, sessionHint } = input
  const localHour = new Date().getHours()
  const pLower = context.pathname.toLowerCase()
  const routeDetailHard =
    pLower.includes('/dashboard/routes/view') && context.currentRoute
      ? 'En detalle de ruta: el subtitle DEBE incluir al menos dos datos concretos tomados de current_route o route_track_point_count (km, desnivel, difficulty, fragmento de description, o cantidad de puntos GPS). Prohibido contestar solo con frases genéricas sin números ni nombre de ruta.'
      : ''
  const attemptStatsHard =
    pLower.includes('/dashboard/routes/attempt-stats') && context.attemptSummary
      ? 'En estadísticas de bajada: el subtitle DEBE citar al menos dos valores de attempt_summary (máx/media km/h, tiempo total, distancia km). Relacioná con la ruta (route_name) y un micro-consejo técnico (línea, tramos, ritmo). Si coach_knowledge_evidence está en el JSON, podés enlazar como máximo una idea de un nodo a esos números.'
      : ''
  const activityRefreshHard =
    pLower.includes('/dashboard/activity') && event.type === 'data-refresh' && context.activitySummary
      ? 'Actividad (turno extra): usá activity_summary (attemptsThisWeek, attemptsLast7Days, lastCompletedAt) + weekly_km y top_route. Proponé una mejora concreta (constancia, volumen, ritmo o próxima acción en la app). Si coach_knowledge_evidence viene en el JSON, una sola idea de hábitos/volumen alineada a esos conteos. No repitas el mismo titulo que antes.'
      : ''

  const dataRefreshHint =
    event.type === 'data-refresh'
      ? `data-refresh (${event.label || 'turno'}): no repitas el enfoque del mensaje anterior; aportá otro dato del mismo contexto (p. ej. desnivel, puntos del trazado, intensidad o siguiente paso en la app).`
      : ''

  const systemGpsHard =
    event.label?.startsWith('system:gps_') &&
    (context.gpsHint === 'denied' || context.gpsHint === 'unavailable')
      ? 'Turno system:gps_*: gps_hint ya es denied o unavailable. Debés incluir pet_mood coherente con el subtítulo (no omitas si el mensaje implica duda o alerta). Sin tool_requests en este turno.'
      : ''

  const systemNetworkHard =
    event.label === 'system:network_offline' && context.networkOnline === false
      ? 'Turno system:network_offline: network_online es false. Interpretá qué pierde el rider en esta pantalla; pet_mood obligatorio y alineado; sin tool_requests salvo executeMcpTools true.'
      : event.label === 'system:network_online' && context.networkOnline === true
        ? 'Turno system:network_online: conexión restablecida. pet_mood coherente con alivio u oportunidad de sync; sin tool_requests en este turno.'
        : ''

  const sessionReplay = sessionReplaySignals?.length ? sessionReplaySignals : null
  const replaySessionHard =
    pLower.includes('attempt-replay') && sessionReplay?.length
      ? 'Replay con sesión: session_recent_replay (orden cronológico, últimas señales). Incluye action tick = muestras en play (v/altitud/tiempo). Usá elapsed_sec, speed_kmh y altitude_m para anclar “dónde va” el rider; el último elemento + event.label son la acción inmediata. No pidas MCP en play/pause/seek/tick salvo que falte un dato imprescindible en attempt_summary o replay_summary.'
      : ''

  const replayCoachHard =
    pLower.includes('attempt-replay') && event.label === 'interactive:replay_coach_tick'
      ? 'interactive:replay_coach_tick: PLAY con telemetría. Obligatorio usar replay_coach_snapshot. Título (≤56 chars): imperativo o lectura de terreno (ej. “Plano largo · soltá freno”, “Rampa · caja más suave”, “Bajada · un frenaje antes del ápice”) — nunca solo el nombre de la ruta ni “coach”. Subtítulo (~80–220 chars): narrá con v, pendiente %, subida/bajada/plano, vs tu media del intento; mencioná cadencia/caja/postura cuando encaje coaching_lens; max una idea de coach_knowledge_evidence. Sin tool_requests salvo executeMcpTools true.'
      : ''

  const replayCoachSnapshot =
    pLower.includes('attempt-replay') ? buildReplayCoachSnapshot(sessionReplay, context) : null

  const coachNodes =
    context.coachKnowledgeNodes != null && context.coachKnowledgeNodes.length > 0
      ? context.coachKnowledgeNodes
      : COACH_KNOWLEDGE_NODES
  const coachSource: 'database' | 'seed' =
    context.coachKnowledgeNodes != null && context.coachKnowledgeNodes.length > 0
      ? (context.coachKnowledgeSource ?? 'database')
      : 'seed'

  const coachKnowledgeEvidence = buildCoachKnowledgeEvidenceFromNodes(
    coachNodes,
    {
      pathname: context.pathname,
      eventType: event.type,
      eventLabel: event.label ?? null,
      coachingLens: replayCoachSnapshot?.coaching_lens ?? null,
    },
    coachSource
  )

  const coachLibraryHard = coachKnowledgeEvidence
    ? `Biblioteca coach_knowledge_evidence (origen: ${coachKnowledgeEvidence.knowledge_source ?? coachSource}): árbol curado; si es database, crece en Supabase sin redeploy. Máximo una idea por turno; literature_synthesis / practice_consensus / program_design_meta según nodo; sin URLs inventadas.`
    : ''

  const riderSpectrumHard = context.riderCoachingSpectrum
    ? 'rider_coaching_spectrum: heurística interna (no certificación). Ajustá profundidad a suggested_coach_level; si vienen dominant_route_difficulty, dominant_difficulty_rank, avg_route_catalog_elevation_gain_m o route_terrain_hint_es, usalos para calibrar el tono (terreno vs ritmo) sin contradecir attempt_summary/replay; no etiquetes al rider oficialmente.'
    : ''

  const maintenanceHintsHard =
    Array.isArray(context.maintenanceHints) && context.maintenanceHints.length > 0
      ? 'maintenance_hints: catálogo interno GuardDH (marca/modelo/variant_key + travel_mm + specs + intervalos). Si dos filas comparten model_name, preferí la que coincide en carrera numérica o variant_key con el texto del rider. No afirmes torque/fluido exacto si no está en key_specs o recommendation; orientación general y manual/taller mandan.'
      : ''

  const replayFollowupHard =
    pLower.includes('attempt-replay') && event.label?.startsWith('interactive:replay_followup_')
      ? 'interactive:replay_followup_*: seguís en la misma pantalla de replay; aportá un matiz NUEVO (no rehacer el primer mensaje). session_recent_replay + resúmenes; pet_mood coherente.'
      : ''

  const affectiveLayer =
    affectiveAugment && Object.keys(affectiveAugment).length > 0
      ? `Capa afectiva unificada (obligatorio leer): affective_world incluye last_app_trigger y recent_app_triggers. Pulsos kind catalog usan ids del catálogo; kind dynamic usan domain+action libres (map, ui, metrics, geo, replay_data…) y crecen sin listarlos todos — interpretá detail y situation_tags (dyn:*). last_trigger_meta incluye hint_es cuando existe. Alineá mood y pet_mood con la causa; sin whiplash si los tags no son extremos. emotion_candidate_slugs = atlas GUARDDH (no inventes otros slugs para atlas). pet_mood solo neutral|happy|analyzing|warning|stoked.\n${JSON.stringify(affectiveAugment)}`
      : ''

  const riderVos = coachVosFirstName(context.riderDisplayName ?? null)

  const userPayload = [
    `Contexto JSON del rider:\n${JSON.stringify({
      pathname: context.pathname,
      rider_display_name: context.riderDisplayName ?? null,
      rider_vos_first_name: riderVos,
      aggregate_coach_insights: context.aggregateCoachInsights ?? null,
      gps_hint: context.gpsHint ?? 'unknown',
      network_online: context.networkOnline ?? null,
      local_hour: localHour,
      route_id: context.routeId ?? null,
      current_route: context.currentRoute ?? null,
      attempt_id: context.attemptId ?? null,
      attempt_summary: context.attemptSummary ?? null,
      route_track_point_count: context.routeTrackPointCount ?? null,
      top_route: context.topRouteName,
      top_route_km: context.topRouteKm,
      weekly_km: context.weeklyKm,
      recent_triumph: context.recentTriumph,
      fatigue: context.fatigue,
      approx_lat: context.approxLat ?? null,
      approx_lng: context.approxLng ?? null,
      screen_kind: context.screenKind ?? inferScreenKind(context.pathname),
      ranking_summary: context.rankingSummary ?? null,
      replay_summary: context.replaySummary ?? null,
      profile_summary: context.profileSummary ?? null,
      activity_summary: context.activitySummary ?? null,
      session_recent_replay: sessionReplay,
      replay_coach_snapshot: replayCoachSnapshot,
      coach_knowledge_evidence: coachKnowledgeEvidence,
      rider_coaching_spectrum: context.riderCoachingSpectrum ?? null,
      maintenance_hints: context.maintenanceHints ?? null,
      guide_interaction_session: sessionHint
        ? {
            seconds_on_screen: sessionHint.secondsOnScreen,
            recent_coach_titles: sessionHint.recentCoachTitles,
            last_trigger_type: sessionHint.lastTriggerType,
          }
        : null,
    })}`,
    `Evento UI: ${event.type}${event.label ? ` · ${event.label}` : ''}`,
    `Hint de interacción: ${interactionHint(context.pathname, { type: event.type, label: event.label })}`,
    routeDetailHard,
    attemptStatsHard,
    dataRefreshHint,
    systemGpsHard,
    systemNetworkHard,
    activityRefreshHard,
    replaySessionHard,
    replayCoachHard,
    replayFollowupHard,
    coachLibraryHard,
    riderSpectrumHard,
    maintenanceHintsHard,
    affectiveLayer,
    'Si current_route existe en contexto, úsala primero: menciona nombre y una pista corta de valor (distancia, desnivel, dificultad o recomendación).',
    'Tuteo siempre ("vos"); nunca uses emails, handles técnicos ni el fragmento local de un correo como nombre. Si rider_vos_first_name es null, no inventes nombre: hablale de "vos" sin apodo forzado.',
    'Si rider_vos_first_name no es null, podés usarlo al inicio una vez con naturalidad (ej. "Carlos, mirá…"); no repitas el nombre en cada frase ni lo uses si suena a usuario de sistema.',
    'aggregate_coach_insights: frases agregadas anónimas de riders en la misma pantalla; inspiración opcional (tono/ángulo), no copiar literal si no encaja; nunca las cites como datos personales.',
    'Si estás en detalle de ruta, orden sugerido de discurso: 1) ruta actual, 2) métrica útil, 3) siguiente acción (detalle/ranking/record).',
    'Si el evento es data-refresh, continuá la conversación con un ángulo distinto al mensaje anterior (evita repetir title/subtitle).',
    ...(executeMcpTools
      ? ([
          'Si approx_lat y approx_lng vienen con número, podés pedir closest_public_routes con esos mismos args.',
          'Para eventos click/navigation prioriza click_context_actions, my_weekly_progress y nearby_route_insights cuando aplique. Si el rider nombra equipo sin cobertura en maintenance_hints, podés usar request_maintenance_catalog_research (raw_brand + raw_model) para encolar investigación; el worker admin llena proposed_payload.',
          'Recordá: salida JSON única con mood,title,subtitle,duration, opcional pet_mood y opcional tool_requests (máx 3).',
        ] as const)
      : ([
          'Restricción de este turno: no incluyas tool_requests (vacío). Variá solo mood/title/subtitle/duration y opcional pet_mood usando el mismo contexto JSON.',
        ] as const)),
    ...(typeof process !== 'undefined' &&
    String(process.env.NEXT_PUBLIC_GUIDE_PET_EMOTION_PROPOSALS || '').trim() === '1'
      ? ([
          'EXPERIMENTAL (solo si aporta matiz nuevo y no en cada turno): en el mismo JSON podés incluir pet_emotion_proposal: { slug (regex ^[a-z][a-z0-9_]{1,62}$), label_es, ambient_animations: { tracks: [...] } como antes, opcional enter_animation, focus_x/y/zoom, atlas_slot. Opcional procedural_face: objeto solo con claves brow|mouth|accents|brow_tilt|mouth_open|intensity (valores en lista blanca de la app: cejas neutral|up|down|furrow|sad|asym; boca neutral|smile|smileWide|frown|wavy|grit|o|flat; accents sweat|spark; brow_tilt -1..1; mouth_open 0..1; intensity ~0.4..1.6). Opcional wrapStyle en ambient: { filter: string corto }. Si no hay matiz nuevo de mascota, omití pet_emotion_proposal.',
        ] as const)
      : []),
  ]
    .filter((s) => typeof s === 'string' && s.trim().length > 0)
    .join('\n\n')

  return [
    `[REGLAS]\n${GUIDE_RULES}`,
    `[CAPA_DATOS_CACHÉ_VERDAD]\n${TRUTH_CACHE_ARCHITECTURE}`,
    `[CONTRATO_SKILL_HIBRIDO]\n${HYBRID_DATA_SKILL_CONTRACT}`,
    `[TRAIL_BUDDY]\n${TRAIL_BUDDY_IDENTITY}`,
    `[VOZ_CONEXION_OFFLINE]\n${PET_CONNECTIVITY_VOICE}`,
    `[PET_VISUAL_BRIDGE]\n${PET_VISUAL_BRIDGE}`,
    `[TURNOS_INTERACTIVOS_IA]\n${PET_INTERACTIVE_ANALYSIS_CONTRACT}`,
    `[SKILL_REACCION_CONTEXTO]\n${CONTEXT_REACTION_SKILL}`,
    `[INTERACCION_HUMANA]\n${HUMAN_INTERACTION_PRINCIPLES}`,
    `[FLUJO_NATURAL_INTERACION]\n${GUIDE_NATURAL_INTERACTION_FLOW}`,
    `[PERFIL_VOZ]\n${getGuideVoiceProfileAddon()}`,
    `[PANTALLA]\n${getScreenKindOutputHints(context.screenKind ?? inferScreenKind(context.pathname))}`,
    `[REGLAS_CONTEXTO_COACH]\n${COACHING_CONTEXT_RULES}`,
    `[SEGURIDAD_SOCIAL]\n${SOCIAL_ACCEPTABILITY_RULES}`,
    `[PIPELINE_AGENTE]\n${GUIDE_AGENT_PIPELINE}`,
    `[SKILLS]\n${skillsJson}`,
    `[TAREA]\n${userPayload}`,
  ].join('\n\n')
}
