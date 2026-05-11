import type { PerformanceMetrics } from '@/services/RoutePerformanceService'
import type { GPSPoint } from '@/services/RoutePerformanceService'
import type { MapPoint } from '@/hooks/useGPSRecorder'
import type { RouteAttemptGateTiming } from '@/lib/routeAttemptGateTiming'

/**
 * Fila lista para `route_attempts.insert`, coherente con el guardado al grabar una bajada.
 */
export function buildRouteAttemptInsert(
  performance: PerformanceMetrics,
  gpsPoints: GPSPoint[],
  routeId: string,
  userId: string,
  gateTiming?: RouteAttemptGateTiming | null
) {
  return {
    route_id: routeId,
    user_id: userId,
    total_time: performance.totalTime,
    moving_time: performance.movingTime,
    stopped_time: performance.stoppedTime,
    max_speed: performance.maxSpeed,
    avg_speed: performance.avgSpeed,
    distance: performance.totalDistance,
    elevation_gain: performance.elevationGain,
    elevation_loss: performance.elevationLoss,
    jumps_count: performance.jumps.length,
    sharp_movements_count: performance.sharpMovements.length,
    hard_brakes_count: performance.hardBrakes.length,
    stops_count: performance.stops.length,
    rhythm_score: performance.rhythmScore,
    intensity_score: performance.intensityScore,
    aggression_score: performance.aggressionScore,
    overall_score: performance.overallScore,
    gps_points: gpsPoints.map((p) => ({
      latitude: p.latitude,
      longitude: p.longitude,
      altitude: p.altitude,
      speed: p.speed,
      timestamp: p.timestamp.toISOString(),
      accuracy: p.accuracy,
    })),
    is_public: true,
    completed_at: new Date().toISOString(),
    ...(gateTiming != null
      ? {
          start_gate_offset_wall_ms: Math.round(gateTiming.startOffsetWallMs),
          start_gate_offset_gps_ms: Math.round(gateTiming.startOffsetGpsMs),
          finish_approach_ms:
            gateTiming.finishApproachMs != null
              ? Math.round(gateTiming.finishApproachMs)
              : null,
        }
      : {}),
  }
}

/**
 * Reconstruye `MapPoint[]` desde el JSONB `gps_points` de un intento.
 */
export function mapPointsFromAttemptGpsJson(raw: unknown): MapPoint[] {
  if (!Array.isArray(raw) || raw.length < 2) return []
  const out: MapPoint[] = []
  for (const p of raw) {
    if (!p || typeof p !== 'object') continue
    const o = p as Record<string, unknown>
    const lat = o.latitude
    const lng = o.longitude
    if (typeof lat !== 'number' || typeof lng !== 'number') continue
    let ts: Date | undefined
    if (typeof o.timestamp === 'string') ts = new Date(o.timestamp)
    else if (o.timestamp instanceof Date) ts = o.timestamp
    out.push({
      latitude: lat,
      longitude: lng,
      altitude: typeof o.altitude === 'number' ? o.altitude : undefined,
      accuracy: typeof o.accuracy === 'number' ? o.accuracy : undefined,
      timestamp: ts,
    })
  }
  return out
}

export function hasGpsTraceForOverview(raw: unknown): boolean {
  return mapPointsFromAttemptGpsJson(raw).length >= 2
}
