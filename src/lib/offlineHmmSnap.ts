/**
 * Refinado opcional del trazo con HMM usando geometría OSM cacheada (IndexedDB).
 */

import type { ProcessedTrack, ProcessedTrackPoint } from '@/core/domain/GPSTrack'
import { GPSTrackProcessingService } from '@/core/application/CreateRouteUseCase'
import { getMergedTaggedSegmentsForBbox } from '@/lib/osmWaysOfflineCache'
import { filterSegmentsNearTrack, matchGpsTraceToSegmentsHmm, type HmmSegment } from '@/lib/mapMatchHmm'

function bboxOfPoints(pts: ProcessedTrackPoint[]): {
  minLat: number
  minLng: number
  maxLat: number
  maxLng: number
} | null {
  if (pts.length === 0) return null
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
  return { minLat, minLng, maxLat, maxLng }
}

/**
 * Si hay segmentos OSM offline en la zona, reubica los puntos del track con Viterbi.
 * No hace red; falla silenciosamente si no hay cache.
 */
export async function applyOfflineHmmSnapToProcessedTrackIfAvailable(
  processingService: GPSTrackProcessingService,
  base: ProcessedTrack,
  options?: { maxSnapMeters?: number; mode?: 'motor' | 'trail' | 'both' }
): Promise<ProcessedTrack> {
  const pts = base.points
  if (pts.length < 2) return base

  const bb = bboxOfPoints(pts)
  if (!bb) return base
  const pad = 0.006
  const tagged = await getMergedTaggedSegmentsForBbox(
    bb.minLat - pad,
    bb.minLng - pad,
    bb.maxLat + pad,
    bb.maxLng + pad,
    options?.mode ?? 'both'
  )
  let segments: HmmSegment[] = tagged.map((t) => ({ a: t.a, b: t.b }))
  segments = filterSegmentsNearTrack(segments, pts)
  if (segments.length < 8) return base

  const maxSnap = options?.maxSnapMeters ?? 85
  const { snapped } = matchGpsTraceToSegmentsHmm(pts, segments, {
    maxSnapMeters: maxSnap,
    maxCandidatesPerPoint: 8,
  })

  if (snapped.length !== pts.length) return base

  const newPts: ProcessedTrackPoint[] = pts.map((p, i) => {
    const s = snapped[i]!
    return {
      ...p,
      latitude: s.latitude,
      longitude: s.longitude,
      roadSnapped: p.roadSnapped || true,
    }
  })

  return processingService.rebuildProcessedTrack(base, newPts)
}
