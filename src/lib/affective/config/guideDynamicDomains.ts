/**
 * Mapeo dominio dinámico → tag de interacción para heurística de emociones candidatas.
 */
export const GUIDE_DYNAMIC_DOMAIN_TO_INTERACTION_TAG: Readonly<Record<string, string>> = {
  map: 'interaction_map',
  ui: 'interaction_ui',
  metrics: 'interaction_metrics',
  geo: 'interaction_geo',
  replay_data: 'interaction_replay_metrics',
}
