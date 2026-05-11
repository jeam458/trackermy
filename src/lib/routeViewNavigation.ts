/**
 * Origen de navegación hacia `/dashboard/routes/view` para que «Volver» regrese al listado correcto.
 */
export type RouteViewFrom =
  | 'route-ranking'
  | 'ranking'
  | 'activity'
  | 'discover'
  | 'routes'
  | 'record'
  | 'attempt-replay'
  | 'attempt-stats'
  | 'notifications'

const KNOWN: ReadonlySet<string> = new Set([
  'route-ranking',
  'ranking',
  'activity',
  'discover',
  'routes',
  'record',
  'attempt-replay',
  'attempt-stats',
  'notifications',
])

export function normalizeRouteViewFrom(raw: string | null): RouteViewFrom | null {
  if (!raw) return null
  const v = raw.trim().toLowerCase()
  return KNOWN.has(v) ? (v as RouteViewFrom) : null
}

export function routeViewUrl(
  routeId: string,
  from: RouteViewFrom | null,
  extra?: { attemptId?: string | null; replayFrom?: string | null }
): string {
  const q = new URLSearchParams()
  q.set('id', routeId)
  if (from) q.set('from', from)
  if ((from === 'attempt-replay' || from === 'attempt-stats') && extra?.attemptId) {
    q.set('attemptId', extra.attemptId)
    if (from === 'attempt-replay' && extra.replayFrom) q.set('replayFrom', extra.replayFrom)
  }
  return `/dashboard/routes/view?${q.toString()}`
}

export function resolveRouteViewBackHref(
  from: RouteViewFrom | null,
  routeId: string | null,
  extra?: { attemptId?: string | null; replayFrom?: string | null }
): string | null {
  if (!routeId) return null
  switch (from) {
    case 'route-ranking':
      return `/dashboard/routes/route-ranking?id=${encodeURIComponent(routeId)}`
    case 'ranking':
      return '/dashboard/ranking'
    case 'activity':
      return '/dashboard/activity'
    case 'discover':
      return '/dashboard'
    case 'routes':
      return '/dashboard/routes'
    case 'record':
      return '/dashboard/routes/record'
    case 'attempt-replay': {
      const aid = extra?.attemptId?.trim()
      if (!aid) return null
      const rf = (extra?.replayFrom || 'ranking').trim() || 'ranking'
      return `/dashboard/routes/attempt-replay?attemptId=${encodeURIComponent(aid)}&routeId=${encodeURIComponent(routeId)}&from=${encodeURIComponent(rf)}`
    }
    case 'attempt-stats': {
      const aid = extra?.attemptId?.trim()
      if (!aid) return null
      return `/dashboard/routes/attempt-stats?attemptId=${encodeURIComponent(aid)}&routeId=${encodeURIComponent(routeId)}`
    }
    case 'notifications':
      return '/dashboard/notifications'
    default:
      return null
  }
}
