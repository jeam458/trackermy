import type { Route } from '@/core/domain/Route'
import type { GPSPoint } from '@/services/RoutePerformanceService'
import { haversineMeters } from '@/lib/gpsRecordingMath'
import { cumulativeMeters, snapToPath, type MapPathNode } from '@/lib/pathMapMatch'
import { ROUTE_ATTEMPT_MAX_OFF_ROUTE_M } from '@/lib/routeAttemptConstants'

/** Si el GPS está más lejos que esto de la ruta publicada, se mantiene el punto original. */
const DEFAULT_MAX_SNAP_DISTANCE_M = ROUTE_ATTEMPT_MAX_OFF_ROUTE_M

function referencePathFromRoute(route: Route): MapPathNode[] {
  const pts = [...route.trackPoints].sort((a, b) => a.orderIndex - b.orderIndex)
  return pts.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))
}

/**
 * Proyecta cada punto del recorrido al segmento más cercano de la polilínea de la ruta publicada.
 * Mantiene timestamps y recalcula velocidad por tramo respecto a las posiciones ya ajustadas.
 */
export function snapGpsPointsToPublishedRoute(
  points: GPSPoint[],
  route: Route,
  maxDistanceMeters: number = DEFAULT_MAX_SNAP_DISTANCE_M
): GPSPoint[] {
  const path = referencePathFromRoute(route)
  if (path.length < 2 || points.length === 0) return points
  const cum = cumulativeMeters(path)

  const adjusted: GPSPoint[] = points.map((p) => {
    const snap = snapToPath(p.latitude, p.longitude, path, cum)
    if (!snap || snap.distanceToPathM > maxDistanceMeters) {
      return { ...p }
    }
    return {
      ...p,
      latitude: snap.projected.latitude,
      longitude: snap.projected.longitude,
    }
  })

  return recomputeSegmentSpeeds(adjusted)
}

function recomputeSegmentSpeeds(points: GPSPoint[]): GPSPoint[] {
  if (points.length < 2) return points
  return points.map((p, i) => {
    if (i === 0) return { ...p, speed: null }
    const prev = points[i - 1]!
    const dt = (p.timestamp.getTime() - prev.timestamp.getTime()) / 1000
    if (dt <= 0) return { ...p, speed: 0 }
    const d = haversineMeters(prev.latitude, prev.longitude, p.latitude, p.longitude)
    return { ...p, speed: d / dt }
  })
}
