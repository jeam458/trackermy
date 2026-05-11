/**
 * Prefijos de ids catalogados → tags agregados (`replay_user_control`, etc.).
 */
export const GUIDE_CATALOG_ID_PREFIX_TAGS: readonly { prefix: string; tag: string }[] = [
  { prefix: 'replay.user.', tag: 'replay_user_control' },
  { prefix: 'sys.', tag: 'system_pulse' },
  { prefix: 'coach.', tag: 'coach_turn' },
  { prefix: 'ui.', tag: 'ui_interaction' },
  { prefix: 'future.', tag: 'future_hook' },
]
