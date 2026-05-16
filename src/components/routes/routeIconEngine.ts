import {
  normalizeRouteIconKey,
  seededThemedIconKeyFromRouteId,
  themedIconGlyphSvg,
} from '@/lib/routeThemedIcons'

const ROUTE_ICON_COLORS = [
  '#c55a2f', // marca PATT
  '#e37845',
  '#d97736', // sol
  '#8f3d1f', // brand muted
  '#64748b', // trail
  '#f59e0b', // ámbar
  '#b45309', // ámbar oscuro
] as const

function hash(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0
  return Math.abs(h)
}

function shade(hex: string, amount: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!m) return hex
  const clamp = (v: number) => Math.max(0, Math.min(255, v))
  const r = clamp(parseInt(m[1], 16) + amount)
  const g = clamp(parseInt(m[2], 16) + amount)
  const b = clamp(parseInt(m[3], 16) + amount)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

export function routeIconColorFromId(routeId: string): string {
  const h = hash(routeId)
  return ROUTE_ICON_COLORS[h % ROUTE_ICON_COLORS.length]!
}

export function routeIconHtmlForRoute(routeId: string, iconSymbolKey?: string | null): string {
  const key = normalizeRouteIconKey(iconSymbolKey) ?? seededThemedIconKeyFromRouteId(routeId)
  const color = routeIconColorFromId(routeId)
  const dark = shade(color, -38)
  const glyph = themedIconGlyphSvg(key)
  return `
    <div class="gdh-route-icon" data-route-icon-id="${routeId}" data-route-icon-key="${key}" style="
      width:28px;height:28px;border-radius:12px;
      background:linear-gradient(145deg,${color},${dark});
      border:2px solid rgba(15,23,42,0.95);
      box-shadow:0 4px 10px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.08) inset;
      display:flex;align-items:center;justify-content:center;
      transform:translateZ(0);
    ">${glyph}</div>
  `
}

/** @deprecated Usar routeIconHtmlForRoute con clave desde BD cuando exista. */
export function routeIconHtmlFromId(routeId: string): string {
  return routeIconHtmlForRoute(routeId, null)
}
