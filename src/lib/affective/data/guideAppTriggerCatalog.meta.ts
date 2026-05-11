import type { GuideAppTriggerMetaEntry } from '@/lib/affective/guideAppTriggerCatalog.types'

/**
 * Datos del catálogo (solo contenido). La lógica y tipos derivados están en `guideAppTriggerCatalog.ts`.
 */
export const GUIDE_APP_TRIGGER_META = {
  'nav.dashboard_home': {
    group: 'navigation',
    origin: 'user',
    description_es: 'Entró al mapa / inicio del dashboard (descubrir rutas).',
  },
  'nav.activity': {
    group: 'navigation',
    origin: 'user',
    description_es: 'Pantalla de actividad / progreso del rider.',
  },
  'nav.profile': {
    group: 'navigation',
    origin: 'user',
    description_es: 'Perfil, garage, datos del rider.',
  },
  'nav.notifications': {
    group: 'navigation',
    origin: 'user',
    description_es: 'Centro de notificaciones.',
  },
  'nav.pet_gallery': {
    group: 'navigation',
    origin: 'user',
    description_es: 'Galería / estados del pet.',
  },
  'nav.ranking': {
    group: 'navigation',
    origin: 'user',
    description_es: 'Ranking global o semanal.',
  },
  'nav.record_legacy': {
    group: 'navigation',
    origin: 'user',
    description_es: 'Pantalla legacy `/dashboard/record` (mapa placeholder).',
  },
  'nav.routes_list': {
    group: 'navigation',
    origin: 'user',
    description_es: 'Listado de rutas del rider.',
  },
  'nav.route_detail': {
    group: 'navigation',
    origin: 'user',
    description_es: 'Detalle / ficha de una ruta.',
  },
  'nav.route_create': {
    group: 'navigation',
    origin: 'user',
    description_es: 'Flujo crear ruta (escritorio).',
  },
  'nav.route_create_mobile': {
    group: 'navigation',
    origin: 'user',
    description_es: 'Flujo crear ruta (móvil).',
  },
  'nav.route_edit': {
    group: 'navigation',
    origin: 'user',
    description_es: 'Editor de trazado / metadatos de ruta.',
  },
  'nav.route_record': {
    group: 'navigation',
    origin: 'user',
    description_es: 'Iniciar o preparar grabación de recorrido en ruta.',
  },
  'nav.attempt_replay': {
    group: 'navigation',
    origin: 'user',
    description_es: 'Replay GPS / detalle del intento en mapa.',
  },
  'nav.attempt_stats': {
    group: 'navigation',
    origin: 'user',
    description_es: 'Estadísticas agregadas de una bajada.',
  },
  'nav.route_ranking': {
    group: 'navigation',
    origin: 'user',
    description_es: 'Ranking de una ruta concreta.',
  },
  'nav.dashboard_other': {
    group: 'navigation',
    origin: 'user',
    description_es: 'Otra ruta bajo /dashboard no mapeada aún (revisar catálogo).',
  },
  'replay.user.play': {
    group: 'replay',
    origin: 'user',
    description_es: 'Pulsó reproducir en replay (GPS o vídeo).',
  },
  'replay.user.pause': {
    group: 'replay',
    origin: 'user',
    description_es: 'Pulsó pausa en replay.',
  },
  'replay.user.seek': {
    group: 'replay',
    origin: 'user',
    description_es: 'Buscó posición en la línea de tiempo / slider de replay.',
  },
  'sys.gps_denied': {
    group: 'system',
    origin: 'system',
    description_es: 'Permisos de geolocalización denegados.',
  },
  'sys.gps_unavailable': {
    group: 'system',
    origin: 'system',
    description_es: 'GPS no disponible o error del dispositivo.',
  },
  'sys.network_offline': {
    group: 'system',
    origin: 'system',
    description_es: 'El navegador reportó pérdida de conexión.',
  },
  'sys.network_online': {
    group: 'system',
    origin: 'system',
    description_es: 'El navegador reportó conexión restablecida.',
  },
  'ui.button_click': {
    group: 'ui',
    origin: 'user',
    description_es: 'Tap / click en botón o control con rol de acción (label en detalle).',
  },
  'coach.scheduled_followup': {
    group: 'coach',
    origin: 'scheduled',
    description_es: 'Turno programado de seguimiento (data-refresh / followup).',
  },
  'coach.replay_coach_tick': {
    group: 'coach',
    origin: 'app',
    description_es: 'Tick de coach en vivo durante replay (telemetría + LLM).',
  },
  'coach.replay_context_llm': {
    group: 'coach',
    origin: 'app',
    description_es: 'Narración LLM tras acción estructural replay (play/pause/seek).',
  },
  'coach.navigation_open': {
    group: 'coach',
    origin: 'app',
    description_es: 'Primer turno WebLLM al abrir / cambiar de pantalla con contexto.',
  },
  'future.record_arm': {
    group: 'future',
    origin: 'user',
    description_es: '[Pendiente] Cuenta atrás / armado antes de grabar.',
  },
  'future.record_start': {
    group: 'future',
    origin: 'user',
    description_es: '[Pendiente] Inicio real de la grabación GPS.',
  },
  'future.record_pause': {
    group: 'future',
    origin: 'user',
    description_es: '[Pendiente] Pausa de grabación.',
  },
  'future.record_saved': {
    group: 'future',
    origin: 'user',
    description_es: '[Pendiente] Intento guardado con éxito.',
  },
  'future.route_published': {
    group: 'future',
    origin: 'user',
    description_es: '[Pendiente] Ruta publicada o visibilidad cambiada.',
  },
} as const satisfies Record<string, GuideAppTriggerMetaEntry>
