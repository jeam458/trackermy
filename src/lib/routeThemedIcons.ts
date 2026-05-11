/**
 * Catálogo de íconos temáticos para marcadores de ruta (Andes / fauna / motivos geométricos inspirados).
 * La IA solo elige una clave de esta lista; los SVG son fijos en cliente.
 */

export const ROUTE_THEMED_ICON_KEYS = [
  'condor',
  'puma',
  'vizcacha',
  'zorro_andino',
  'oso_anteojos',
  'amaru',
  'chakana',
  'inti',
  'tumi',
  'cerro',
  'rio',
  'quipu',
  'colibri',
  'venado',
  'llama',
  'huanca',
  'kero',
] as const

export type RouteThemedIconKey = (typeof ROUTE_THEMED_ICON_KEYS)[number]

const KEY_SET = new Set<string>(ROUTE_THEMED_ICON_KEYS)

export function normalizeRouteIconKey(raw: string | null | undefined): RouteThemedIconKey | null {
  if (raw == null || String(raw).trim() === '') return null
  const k = String(raw)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
  return KEY_SET.has(k) ? (k as RouteThemedIconKey) : null
}

function hash(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Si no hay clave en BD, elegimos una estable por id pero ya del catálogo temático. */
export function seededThemedIconKeyFromRouteId(routeId: string): RouteThemedIconKey {
  const h = hash(routeId)
  return ROUTE_THEMED_ICON_KEYS[h % ROUTE_THEMED_ICON_KEYS.length]!
}

const S = 'rgba(255,255,255,0.95)'
const W = '1.55'

/** SVG compactos (viewBox 18×18) como innerHTML del marcador. */
const GLYPHS: Record<RouteThemedIconKey, string> = {
  condor: `<svg viewBox="0 0 18 18" width="13" height="13" aria-hidden="true" fill="none" stroke="${S}" stroke-width="${W}" stroke-linecap="round" stroke-linejoin="round"><path d="M9 13V8.5M3.5 9c2-2.5 4-3.5 5.5-3.5s3.5 1 5.5 3.5M4 11c1.8-1.2 3.5-1.8 5-1.8s3.2.6 5 1.8"/></svg>`,
  puma: `<svg viewBox="0 0 18 18" width="13" height="13" aria-hidden="true" fill="none" stroke="${S}" stroke-width="${W}" stroke-linecap="round"><path d="M6 4.5L7 3l1.2 1.5M11 4.5L10 3 8.8 4.5M5 10c1-2.5 2.5-4 4-4s3 1.5 4 4M6.5 12.5c.8 1.2 2 2 3.5 2s2.7-.8 3.5-2"/></svg>`,
  vizcacha: `<svg viewBox="0 0 18 18" width="13" height="13" aria-hidden="true" fill="none" stroke="${S}" stroke-width="${W}" stroke-linecap="round"><ellipse cx="9" cy="10" rx="4" ry="3"/><path d="M5 7c.8-1.8 2-3 4-3s3.2 1.2 4 3M7 14v1.2M11 14v1.2M8 5.5L7.5 3.5M10 5.5l.5-2"/></svg>`,
  zorro_andino: `<svg viewBox="0 0 18 18" width="13" height="13" aria-hidden="true" fill="none" stroke="${S}" stroke-width="${W}" stroke-linecap="round"><path d="M12 5.5l2-1.5-1 2.5M6 12c2-2 4-2.5 6-2M4.5 8.5c0-2 1.5-3.5 3.5-3.5 1.2 0 2.3.6 3 1.5"/><path d="M5 14c1.5.8 3.2 1 5 1"/></svg>`,
  oso_anteojos: `<svg viewBox="0 0 18 18" width="13" height="13" aria-hidden="true" fill="none" stroke="${S}" stroke-width="${W}" stroke-linecap="round"><circle cx="6.5" cy="8" r="1.3"/><circle cx="11.5" cy="8" r="1.3"/><path d="M7 4.5L6 3M11 4.5L12 3M5.5 11c1 2 2.5 3.2 4.5 3.5 2-.3 3.5-1.5 4.5-3.5"/></svg>`,
  amaru: `<svg viewBox="0 0 18 18" width="13" height="13" aria-hidden="true" fill="none" stroke="${S}" stroke-width="${W}" stroke-linecap="round"><path d="M3 10c2-3 4-4 6-3s3.5 3 5.5 3 3.5-1 3.5-2.5"/><circle cx="4" cy="10" r="0.9"/><path d="M14.5 7.5l1.2-1.2"/></svg>`,
  chakana: `<svg viewBox="0 0 18 18" width="13" height="13" aria-hidden="true" fill="none" stroke="${S}" stroke-width="${W}" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2.5v13M2.5 9h13"/><path d="M9 5.5L7 9 9 12.5 11 9 9 5.5z"/></svg>`,
  inti: `<svg viewBox="0 0 18 18" width="13" height="13" aria-hidden="true" fill="none" stroke="${S}" stroke-width="${W}" stroke-linecap="round"><circle cx="9" cy="9" r="2.8"/><path d="M9 2v2M9 14v2M2 9h2M14 9h2M3.5 3.5l1.4 1.4M13.1 13.1l1.4 1.4M3.5 14.5l1.4-1.4M13.1 4.9l1.4-1.4"/></svg>`,
  tumi: `<svg viewBox="0 0 18 18" width="13" height="13" aria-hidden="true" fill="none" stroke="${S}" stroke-width="${W}" stroke-linecap="round" stroke-linejoin="round"><path d="M5 14l2-6c1-2.5 3-4 6-4.5l2.5 2.5c-.5 3-2 5-4.5 6l-6 2z"/><path d="M5 14L3.5 15.5"/></svg>`,
  cerro: `<svg viewBox="0 0 18 18" width="13" height="13" aria-hidden="true" fill="none" stroke="${S}" stroke-width="${W}" stroke-linecap="round" stroke-linejoin="round"><path d="M2 14L6 6l3 4 3-7 4 11H2z"/></svg>`,
  rio: `<svg viewBox="0 0 18 18" width="13" height="13" aria-hidden="true" fill="none" stroke="${S}" stroke-width="${W}" stroke-linecap="round"><path d="M2 6c2.5 0 3.5 2 6 2s3.5-2 6-2 3.5 2 2 2M2 11c2.5 0 3.5 2 6 2s3.5-2 6-2 3.5 2 2 2"/></svg>`,
  quipu: `<svg viewBox="0 0 18 18" width="13" height="13" aria-hidden="true" fill="none" stroke="${S}" stroke-width="${W}" stroke-linecap="round"><path d="M9 3v11"/><circle cx="7" cy="6" r="0.9"/><circle cx="11" cy="8" r="0.9"/><circle cx="6.5" cy="11" r="0.9"/><circle cx="11.5" cy="13" r="0.9"/></svg>`,
  colibri: `<svg viewBox="0 0 18 18" width="13" height="13" aria-hidden="true" fill="none" stroke="${S}" stroke-width="${W}" stroke-linecap="round"><path d="M3 9c3-1 5.5-.5 7 1M10 10l5-2-2 4.5"/><path d="M8 7c1.5 2 2 4 1.5 6"/></svg>`,
  venado: `<svg viewBox="0 0 18 18" width="13" height="13" aria-hidden="true" fill="none" stroke="${S}" stroke-width="${W}" stroke-linecap="round"><path d="M6 4L5 2M7.5 4L8 2M10.5 4L10 2M12 4l1-2M8 12c2-1 3.5-1 5 0M7 9c0-2 1.5-3.5 3.5-3.5S14 7 14 9"/></svg>`,
  llama: `<svg viewBox="0 0 18 18" width="13" height="13" aria-hidden="true" fill="none" stroke="${S}" stroke-width="${W}" stroke-linecap="round"><path d="M6 14V8c0-2 1-3.5 3-3.5s3 1.5 3 3.5v6M6 10h4"/><path d="M8 4.5c.5-1 1.5-1.5 2.5-1"/></svg>`,
  huanca: `<svg viewBox="0 0 18 18" width="13" height="13" aria-hidden="true" fill="none" stroke="${S}" stroke-width="${W}" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3l1 11M6 14h4M7 3h2"/></svg>`,
  kero: `<svg viewBox="0 0 18 18" width="13" height="13" aria-hidden="true" fill="none" stroke="${S}" stroke-width="${W}" stroke-linecap="round"><path d="M5 6c0-2 1.8-3 4-3s4 1 4 3v6c0 2-1.8 3.5-4 3.5S5 14 5 12V6z"/><path d="M5 8h8"/></svg>`,
}

export function themedIconGlyphSvg(key: RouteThemedIconKey): string {
  return GLYPHS[key] ?? GLYPHS.chakana
}

/** Reglas rápidas si no hay IA o falla WebGPU. */
export function heuristicRouteIconKey(
  name: string,
  description?: string,
  difficulty?: string
): RouteThemedIconKey {
  const text = `${name} ${description ?? ''}`.toLowerCase()

  const rules: ReadonlyArray<[RegExp, RouteThemedIconKey]> = [
    [/condor|vuelo|volar|abismo|cañon|cañón|escarpa/i, 'condor'],
    [/puma|felino|leon|león|oscur|bosque espeso/i, 'puma'],
    [/vizcacha|roedor|chill/i, 'vizcacha'],
    [/zorro|zorra/i, 'zorro_andino'],
    [/oso|anteojo|spectacled/i, 'oso_anteojos'],
    [/amaru|serpiente|serpent|ondul|zigzag|humeda|húmeda/i, 'amaru'],
    [/chakana|cruz andina|inka|incaic|andino simb/i, 'chakana'],
    [/inti|sol|sunrise|amanecer/i, 'inti'],
    [/tumi|ceremonia|ritual/i, 'tumi'],
    [/cerro|montaña|montana|pico|cumbre|bajada|downhill|dh\b|sillar/i, 'cerro'],
    [/río|rio|agua|quebrada|humedal|torrente/i, 'rio'],
    [/quipu|nudo|cord|textil/i, 'quipu'],
    [/colibri|colibrí|picaflor/i, 'colibri'],
    [/venado|ciervo|huemul/i, 'venado'],
    [/llama|alpaca|vicuña|vicuna|camelid/i, 'llama'],
    [/huanca|piedra|megalito|monolito|rupestre/i, 'huanca'],
    [/kero|ceremon|vasija/i, 'kero'],
  ]

  for (const [re, key] of rules) {
    if (re.test(text)) return key
  }

  if (difficulty === 'Expert') return 'puma'
  if (difficulty === 'Beginner') return 'vizcacha'

  const h = hash(`${name}|${description ?? ''}`)
  return ROUTE_THEMED_ICON_KEYS[h % ROUTE_THEMED_ICON_KEYS.length]!
}

export function routeThemedIconKeysForPrompt(): string {
  return ROUTE_THEMED_ICON_KEYS.join(', ')
}
