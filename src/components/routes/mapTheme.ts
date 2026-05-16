import appBrandMapStyle from '@/map-styles/app-brand-osm.json'

/**
 * Referencia de marca (paleta OSM + texto de intención para tiles raster y futuro vector).
 * Úsalo en documentación o tooling; el render real de Leaflet sigue en globals.css (clases leaflet-app-brand-*).
 */
export const APP_BRAND_OSM_STYLE = appBrandMapStyle

/** Fondo del contenedor Leaflet — alineado con `globals.css` (--gdh-canvas-2). */
export const APP_MAP_CANVAS_HEX = '#131316' as const

/** Variante outdoor: superficie elevada. */
export const APP_MAP_CANVAS_OUTDOOR_HEX = '#1e1e22' as const

/**
 * OSM raster directo (sin filtro CSS). Mantener para referencia/snapping/OSM tooling;
 * en UI preferimos teselas oscuras raster (Carto) para rendimiento estable en WebView.
 */
export const OUTDOOR_OSM_MAP_TILE = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
} as const

const CARTO_OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions/">CARTO</a>' as const

/**
 * Oscuro sin filtros CSS por tesela — evita jank/pixelación y “mapa beige” si el navegador
 * ignora `filter:` en `<img.leaflet-tile>` (habitual en algunos WebView).
 */
export const DARK_MAP_TILE = {
  url: 'https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png',
  attribution: CARTO_OSM_ATTRIBUTION,
  maxZoom: 20,
  /** CartoCDN rotación `{s}` */
  subdomains: 'abcd',
  /** Sin clase: ya no necesitamos `filter:` global en teselas OSM */
  tileClassName: '',
  canvas: APP_MAP_CANVAS_HEX,
} as const

/** Outdoor más legible, también sin filtros pesados por tesela. */
export const BRAND_OUTDOOR_MAP_TILE = {
  url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  attribution: CARTO_OSM_ATTRIBUTION,
  maxZoom: 20,
  subdomains: 'abcd',
  tileClassName: '',
  canvas: APP_MAP_CANVAS_OUTDOOR_HEX,
} as const

export type BrandLeafletRasterPreset = typeof DARK_MAP_TILE | typeof BRAND_OUTDOOR_MAP_TILE

/** Props comunes para `<TileLayer />` según presets de marca. */
export function tileLayerPresetProps(tile: BrandLeafletRasterPreset) {
  return {
    attribution: tile.attribution,
    url: tile.url,
    maxZoom: tile.maxZoom,
    subdomains: tile.subdomains,
    ...(tile.tileClassName ? { className: tile.tileClassName } : {}),
  }
}

/** Trazos en mapa: familia cálida + neutros (legibles sobre mapa oscuro, sin teal/violeta “marca vieja”). */
export const ROUTE_PALETTE = [
  '#e37845',
  '#c55a2f',
  '#d97736',
  '#f4a261',
  '#ea580c',
  '#fb923c',
  '#f59e0b',
  '#fdba74',
  '#fda4af',
  '#a8a29e',
] as const

export function routeColorFromId(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return ROUTE_PALETTE[Math.abs(h) % ROUTE_PALETTE.length]!
}

export const MAP_AVATAR_OBJECT_POSITION = '50% 28%'

export const MAP_MARKER_AVATAR_IMG_INLINE_STYLE = `width:100%;height:100%;min-width:100%;min-height:100%;object-fit:cover;object-position:${MAP_AVATAR_OBJECT_POSITION};display:block;`

export const MAP_AVATAR_THUMB_IMG_CLASS =
  'w-full h-full min-w-full min-h-full object-cover [object-position:50%_28%]'
