/** Selectores DOM centralizados (Leaflet / MapLibre + controles interactivos). */

export const ATTR_GUIDE_DOMAIN = 'data-guide-domain'
export const ATTR_GUIDE_ACTION = 'data-guide-action'
export const ATTR_GUIDE_SUBJECT = 'data-guide-subject'

export const GUIDE_LEAFLET_CONTAINER_SELECTOR = '.leaflet-container'
export const GUIDE_LEAFLET_ZOOM_WRAP_SELECTOR = '.leaflet-control-zoom'
export const GUIDE_LEAFLET_ZOOM_IN_SELECTOR = '.leaflet-control-zoom-in'
export const GUIDE_LEAFLET_ZOOM_OUT_SELECTOR = '.leaflet-control-zoom-out'
export const GUIDE_LEAFLET_POPUP_SELECTOR = '.leaflet-popup'

/** MapLibre (mapcn / vectorial) en Descubrir */
export const GUIDE_MAPLIBRE_MAP_SELECTOR = '.maplibregl-map'
export const GUIDE_MAPLIBRE_ZOOM_IN_SELECTOR = '.maplibregl-ctrl-zoom-in'
export const GUIDE_MAPLIBRE_ZOOM_OUT_SELECTOR = '.maplibregl-ctrl-zoom-out'
export const GUIDE_MAPLIBRE_ZOOM_GROUP_SELECTOR = '.maplibregl-ctrl-group'
export const GUIDE_MAPLIBRE_POPUP_SELECTOR = '.maplibregl-popup'

/** Botón/enlace genérico para heurística “expandir mapa”. */
export const GUIDE_MAP_EXPAND_CONTROL_SELECTOR = 'button,[role="button"],a'

/**
 * Interactivos que pueden originar `ui.pointer_click`.
 * Mantener como string CSS único para `closest()`.
 */
export const GUIDE_POINTER_INTERACTIVE_SELECTOR =
  'button,a,[role="button"],input[type="submit"],input[type="button"],label,[data-guide-interactive]'

export const GUIDE_DATA_CARD_SELECTOR = '[data-guide-card]'
