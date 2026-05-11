/**
 * CSP estricta solo en producción (`next.config.ts` → headers).
 *
 * - `connect-src`: solo orígenes que la app usa (Supabase, mapas, Overpass, WebLLM/HF, etc.).
 *   Bloquea llamadas de scripts de página a APIs arbitrarias (p. ej. extensiones que inyecten fetch
 *   en el **mismo contexto** que la app). Las extensiones MV3 con worker propio pueden eludir CSP;
 *   igual reduce superficie y ruido en Red.
 *
 * Si añadís un dominio nuevo (CDN, analytics), actualizad esta lista o usad env
 * `NEXT_PUBLIC_CSP_CONNECT_EXTRA` (URLs separadas por espacio).
 */
export function buildProductionContentSecurityPolicy(): string {
  const extraConnect = (process.env.NEXT_PUBLIC_CSP_CONNECT_EXTRA ?? '')
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean)

  const connectSrc = [
    "'self'",
    'blob:',
    'data:',
    'https://*.supabase.co',
    'wss://*.supabase.co',
    'https://*.supabase.in',
    'wss://*.supabase.in',
    'https://overpass-api.de',
    'https://tile.openstreetmap.org',
    'https://*.basemaps.cartocdn.com',
    'https://tiles.openfreemap.org',
    'https://server.arcgisonline.com',
    'https://services.arcgisonline.com',
    'https://tiles.arcgis.com',
    'https://api.dicebear.com',
    'https://huggingface.co',
    'https://*.huggingface.co',
    'https://cdn-lfs.huggingface.co',
    'https://*.hf.co',
    'https://raw.githubusercontent.com',
    'https://www.youtube.com',
    'https://www.google.com',
    'https://incompetech.com',
    ...extraConnect,
  ]

  const directives: string[] = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://www.youtube.com`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https://*.supabase.co https://tile.openstreetmap.org https://*.basemaps.cartocdn.com https://tiles.openfreemap.org https://server.arcgisonline.com https://services.arcgisonline.com https://tiles.arcgis.com https://api.dicebear.com https://*.googleusercontent.com https://www.google.com https://www.gstatic.com`,
    "font-src 'self' data:",
    `connect-src ${connectSrc.join(' ')}`,
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    `media-src 'self' blob: data: https://*.supabase.co https://incompetech.com`,
    `frame-src 'self' https://www.youtube.com`,
    "form-action 'self' https://*.supabase.co https://*.supabase.in",
    "upgrade-insecure-requests",
  ]

  return directives.join('; ')
}
