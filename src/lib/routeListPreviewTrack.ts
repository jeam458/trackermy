import type { SupabaseClient } from '@supabase/supabase-js'
import type { Route, RouteTrackPoint } from '@/core/domain/Route'
import { haversineMeters } from '@/lib/gpsRecordingMath'

/** Puntos objetivo por tarjeta: suficiente para la animación sin pesar el listado. */
export const ROUTE_CARD_PREVIEW_POINT_CAP = 48

type LatLngRow = { latitude: unknown; longitude: unknown; order_index: unknown }

function paginateRouteTrackLatLngRows(supabase: SupabaseClient, routeId: string): Promise<LatLngRow[]> {
  const PAGE = 1000
  let offset = 0
  const run = async (): Promise<LatLngRow[]> => {
    const all: LatLngRow[] = []
    for (;;) {
      const { data, error } = await supabase
        .from('route_track_points')
        .select('latitude, longitude, order_index')
        .eq('route_id', routeId)
        .order('order_index', { ascending: true })
        .range(offset, offset + PAGE - 1)

      if (error) {
        console.error('[routeListPreview] track points', routeId, error.message)
        break
      }
      const batch = data ?? []
      all.push(...batch)
      if (batch.length < PAGE) break
      offset += PAGE
    }
    return all
  }
  return run()
}

/**
 * Muestreo a lo largo de la distancia acumulada (no solo índices): refleja mejor curvas largas
 * con pocos puntos.
 */
export function sampleTrackPointsAlongPath(points: RouteTrackPoint[], maxPoints: number): RouteTrackPoint[] {
  const sorted = [...points].sort((a, b) => a.orderIndex - b.orderIndex)
  const n = sorted.length
  if (n === 0) return []
  if (n === 1) {
    const p = sorted[0]!
    return [{ latitude: p.latitude, longitude: p.longitude, orderIndex: 0 }]
  }
  if (n <= maxPoints) {
    return sorted.map((p, i) => ({ latitude: p.latitude, longitude: p.longitude, orderIndex: i }))
  }

  const segLen: number[] = []
  for (let i = 1; i < n; i++) {
    segLen.push(
      haversineMeters(sorted[i - 1]!.latitude, sorted[i - 1]!.longitude, sorted[i]!.latitude, sorted[i]!.longitude)
    )
  }
  const total = segLen.reduce((a, b) => a + b, 0) || 1

  const out: RouteTrackPoint[] = [
    { latitude: sorted[0]!.latitude, longitude: sorted[0]!.longitude, orderIndex: 0 },
  ]

  for (let k = 1; k < maxPoints - 1; k++) {
    const target = (total * k) / (maxPoints - 1)
    let acc = 0
    let j = 0
    while (j < segLen.length && acc + segLen[j]! < target) {
      acc += segLen[j]!
      j++
    }
    const a = sorted[j]!
    const b = sorted[j + 1]!
    const len = segLen[j]!
    const u = len > 1e-6 ? Math.min(1, Math.max(0, (target - acc) / len)) : 0
    out.push({
      latitude: a.latitude + (b.latitude - a.latitude) * u,
      longitude: a.longitude + (b.longitude - a.longitude) * u,
      orderIndex: k,
    })
  }

  const last = sorted[n - 1]!
  out.push({ latitude: last.latitude, longitude: last.longitude, orderIndex: maxPoints - 1 })

  const dedup: RouteTrackPoint[] = []
  for (const p of out) {
    const prev = dedup[dedup.length - 1]
    if (
      prev &&
      Math.abs(prev.latitude - p.latitude) < 1e-7 &&
      Math.abs(prev.longitude - p.longitude) < 1e-7
    ) {
      continue
    }
    dedup.push({ latitude: p.latitude, longitude: p.longitude, orderIndex: dedup.length })
  }
  return dedup.length >= 2 ? dedup : dedup
}

export function endpointsFallbackTrack(route: Pick<Route, 'startCoord' | 'endCoord'>): RouteTrackPoint[] | null {
  const [lat0, lng0] = route.startCoord
  const [lat1, lng1] = route.endCoord
  if (![lat0, lng0, lat1, lng1].every((x) => Number.isFinite(x))) return null
  if (lat0 === lat1 && lng0 === lng1) return null
  return [
    { latitude: lat0, longitude: lng0, orderIndex: 0 },
    { latitude: lat1, longitude: lng1, orderIndex: 1 },
  ]
}

/** Puntos para la mini-animación SVG de la tarjeta (nunca miles de vértices). */
export function thumbnailTrackPoints(route: Route, maxPoints = 56): RouteTrackPoint[] {
  if (route.trackPoints.length >= 2) {
    return sampleTrackPointsAlongPath(route.trackPoints, maxPoints)
  }
  return endpointsFallbackTrack(route) ?? []
}

/**
 * Para cada ruta: descarga el track completo por `route_id` (paginado), luego deja solo un subconjunto
 * ligero para listados.
 */
export async function fetchSampledPreviewPointsByRouteIds(
  supabase: SupabaseClient,
  routeIds: string[],
  maxPointsPerRoute = ROUTE_CARD_PREVIEW_POINT_CAP
): Promise<Map<string, RouteTrackPoint[]>> {
  const map = new Map<string, RouteTrackPoint[]>()
  if (routeIds.length === 0) return map

  await Promise.all(
    routeIds.map(async (routeId) => {
      const rows = await paginateRouteTrackLatLngRows(supabase, routeId)
      if (rows.length < 2) {
        map.set(routeId, [])
        return
      }
      const asPoints: RouteTrackPoint[] = rows.map((r) => ({
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
        orderIndex: Number(r.order_index),
      }))
      map.set(routeId, sampleTrackPointsAlongPath(asPoints, maxPointsPerRoute))
    })
  )

  return map
}
