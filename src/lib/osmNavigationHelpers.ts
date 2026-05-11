/**
 * Carga segmentos OSM cacheados en el bbox de una ruta para `RouteNavigationService.setOsmSafetyNetworkSegments`.
 */

import type { Route } from '@/core/domain/Route'
import { getMergedTaggedSegmentsForBbox } from '@/lib/osmWaysOfflineCache'

type LatLng = { latitude: number; longitude: number }

export async function loadOsmSafetySegmentsForRouteBBox(
  route: Route,
  padDeg = 0.008,
  mode: 'motor' | 'trail' | 'both' = 'both'
): Promise<Array<{ a: LatLng; b: LatLng }>> {
  const pts = [...route.trackPoints].sort((a, b) => a.orderIndex - b.orderIndex)
  if (pts.length < 2) return []
  let minLat = Infinity
  let maxLat = -Infinity
  let minLng = Infinity
  let maxLng = -Infinity
  for (const p of pts) {
    minLat = Math.min(minLat, p.latitude)
    maxLat = Math.max(maxLat, p.latitude)
    minLng = Math.min(minLng, p.longitude)
    maxLng = Math.max(maxLng, p.longitude)
  }
  const tagged = await getMergedTaggedSegmentsForBbox(
    minLat - padDeg,
    minLng - padDeg,
    maxLat + padDeg,
    maxLng + padDeg,
    mode
  )
  return tagged.map((t) => ({
    a: { latitude: t.a.latitude, longitude: t.a.longitude },
    b: { latitude: t.b.latitude, longitude: t.b.longitude },
  }))
}
