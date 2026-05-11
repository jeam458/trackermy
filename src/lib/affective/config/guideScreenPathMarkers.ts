/**
 * Marcadores de pathname → tags `screen_*` para la capa afectiva.
 * Mantener sincronizado al añadir rutas de dashboard relevantes para el coach.
 */
export const GUIDE_SCREEN_PATH_TAGS: readonly {
  /** substring en pathname normalizado */
  includes: string
  tag: string
}[] = [
  { includes: 'attempt-replay', tag: 'screen_replay' },
  { includes: 'attempt-stats', tag: 'screen_attempt_stats' },
  { includes: '/dashboard/routes/view', tag: 'screen_route_detail' },
  { includes: '/dashboard/activity', tag: 'screen_activity' },
]
