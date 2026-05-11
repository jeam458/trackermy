/**
 * Perfiles de interacción + hints de pantalla para el guía WebLLM.
 *
 * Parametrízalo con env (sin re-entrenar pesos del modelo):
 *   NEXT_PUBLIC_GUIDE_VOICE_PROFILE=warm | direct | mentor
 *
 * ### Fuentes públicas (inspiración / buenas prácticas; no son “plugins” ejecutables)
 * - Diálogo cooperativo y relevancia: [Máximas de Grice (Wikipedia)](https://en.wikipedia.org/wiki/Gricean_maxims)
 * - Asistentes útiles, honestos y seguros (marco habitual en la industria): [Anthropic — Constitutional AI / HHH](https://www.anthropic.com/news/constitutional-ai-harmlessness-from-ai-feedback)
 * - Diseño de asistentes conversacionales (claridad, recuperación de errores): [Microsoft — Conversational AI guidelines](https://learn.microsoft.com/azure/bot-service/bot-service-design-guidelines)
 * - Heurísticas de usabilidad aplicables a microcopy: [Nielsen Norman — Usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)
 *
 * Estas URLs van en comentarios para el equipo; el modelo solo recibe el texto de `getGuideVoiceProfileAddon`.
 */

import type { GuideScreenKind } from '@/lib/guide-ai/types'

export type GuideVoiceProfileId = 'warm' | 'direct' | 'mentor'

const PROFILES: Record<GuideVoiceProfileId, string> = {
  warm: [
    'Perfil de voz: CÁLIDO.',
    'Primero un reconocimiento breve del esfuerzo o del dato que ves, después la pista técnica.',
    'Usá 1 pregunta retórica suave como mucho (“¿Probamos…?”); no suenes a formulario.',
    'Si hay malas noticias (GPS, tiempo flojo), empezá con hecho concreto y terminá con una micro-acción posible hoy.',
  ].join('\n'),
  direct: [
    'Perfil de voz: DIRECTO.',
    'Menos relleno emocional: id al dato y a la acción en dos frases.',
    'Priorizá verbos imperativos suaves: revisá, mirá, tocá, bajá.',
    'Mantené el tuteo y el respeto; sin ironía ni sarcasmo.',
  ].join('\n'),
  mentor: [
    'Perfil de voz: MENTOR.',
    'Estructura sugerida: (1) qué observás en datos, (2) por qué importa para la bajada, (3) un solo siguiente paso.',
    'Celebrá mejoras chicas con una frase corta; corregí técnica sin comparar con otros riders.',
  ].join('\n'),
}

/** Derivado solo del pathname (sin queries extra). */
export function inferScreenKind(pathname: string): GuideScreenKind {
  const p = (pathname || '/dashboard').toLowerCase()
  if (p === '/dashboard' || p === '/dashboard/') return 'dashboard_home'
  if (p.includes('/dashboard/routes/view')) return 'route_detail'
  if (p.includes('/dashboard/routes/attempt-stats')) return 'attempt_stats'
  if (p.includes('/dashboard/routes/attempt-replay')) return 'replay'
  if (p.includes('/dashboard/routes/route-ranking') || p.includes('/dashboard/ranking')) return 'ranking'
  if (p.includes('/dashboard/profile')) return 'profile'
  if (p.includes('/dashboard/activity')) return 'activity'
  if (p.includes('/discover')) return 'discover'
  if (p.includes('/dashboard/routes/record')) return 'record'
  return 'other'
}

export function parseGuideVoiceProfile(): GuideVoiceProfileId {
  const raw = (process.env.NEXT_PUBLIC_GUIDE_VOICE_PROFILE || 'warm').trim().toLowerCase()
  if (raw === 'direct' || raw === 'mentor') return raw
  return 'warm'
}

export function getGuideVoiceProfileAddon(): string {
  return PROFILES[parseGuideVoiceProfile()]
}

/** Ejemplos de salida por tipo de pantalla (refuerzo “2 números” donde aplique). */
export function getScreenKindOutputHints(screenKind: GuideScreenKind): string {
  switch (screenKind) {
    case 'route_detail':
      return 'Pantalla route_detail: title + subtitle deben incluir al menos dos cifras o hechos (km, m desnivel, pts GPS, dificultad, tiempo) tomados del contexto o MCP.'
    case 'attempt_stats':
      return 'Pantalla attempt_stats: citá al menos dos números de attempt_summary (máx/media km/h, tiempo, km) y enlazalos a la ruta (nombre).'
    case 'ranking':
      return 'Pantalla ranking: si pedís datos, usá tools; en subtitle mencioná posición relativa o tendencia solo con números devueltos (no inventes puesto).'
    case 'replay':
      return 'Pantalla replay: tono “revisión de línea”; usá replay_summary + attempt_summary y, si existe, session_recent_replay (cola play/pause/seek con elapsed_sec, v, altitud). Priorizá la última señal y event.label replay:*; sin MCP salvo dato clave ausente en el JSON.'
    case 'profile':
      return 'Pantalla profile: saludá por nombre si existe; una sola prioridad (bici, avatar, preferencias) sin asumir datos médicos.'
    case 'activity':
      return 'Pantalla activity: siempre citá al menos dos números entre weekly_km, activity_summary (attemptsThisWeek, attemptsLast7Days, lastCompletedAt) y top_route_km; decí cómo va la semana en tono coach; en turnos data-refresh cambiá el ángulo (constancia, intensidad, siguiente hábito o ruta a abrir).'
    case 'discover':
      return 'Pantalla discover: popularidad o cercanía solo con tools o coords; ofrecé explorar 1 ruta concreta.'
    case 'record':
      return 'Pantalla record: seguridad y control primero; frases cortas para no distraer del pilotaje.'
    case 'dashboard_home':
      return 'Dashboard home: un dato de progreso o descubrimiento con número si existe en contexto/MCP.'
    default:
      return 'Otras pantallas: mantené tuteo, 1 idea principal, y al menos un dato concreto si el JSON trae números.'
  }
}
