/**
 * Rutas de dashboard permitidas por voz (anti open-redirect / path traversal).
 */
const EXACT = new Set<string>([
  '/dashboard',
  '/dashboard/activity',
  '/dashboard/routes',
  '/dashboard/profile',
  '/dashboard/ranking',
  '/dashboard/notifications',
  '/dashboard/pet-gallery',
])

export function normalizeNavPath(path: string): string {
  let p = path.trim()
  if (p !== '/dashboard' && p.endsWith('/')) p = p.replace(/\/+$/, '')
  if (p === '/dashboard/') p = '/dashboard'
  return p
}

export function isVoiceNavPathAllowed(path: string): boolean {
  const p = normalizeNavPath(path)
  if (!p.startsWith('/dashboard')) return false
  if (p.includes('..') || p.includes('//')) return false
  if (p.includes('?') || p.includes('#')) return false
  return EXACT.has(p)
}
