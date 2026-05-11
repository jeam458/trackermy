import type { Route, RouteTrackPoint } from '@/core/domain/Route'
import { haversineMeters } from '@/services/recordingLocationPreflight'

export type RouteTrackDiagnostics = {
  routeId: string
  routeName: string
  pointCount: number
  sortedPointCount: number
  validCoordCount: number
  invalidCoords: Array<{ index: number; latitude: number; longitude: number; reason: string }>
  orderIndexMin: number | null
  orderIndexMax: number | null
  orderIndexDuplicateCount: number
  orderIndexNonFiniteCount: number
  duplicateConsecutiveSegments: number
  pathLengthKmApprox: number
  /** true si hay menos de 2 puntos válidos para polilínea */
  insufficientForPolyline: boolean
}

function isValidLatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  )
}

function sortTrackPoints(pts: RouteTrackPoint[]): RouteTrackPoint[] {
  return [...pts].sort((a, b) => {
    const ai = Number.isFinite(a.orderIndex) ? a.orderIndex : 0
    const bi = Number.isFinite(b.orderIndex) ? b.orderIndex : 0
    return ai - bi
  })
}

/**
 * Inspección de puntos de trazado para depurar polilíneas vacías / mapas sin ruta.
 * No lanza; apto para registrar en consola en desarrollo o soporte.
 */
export function diagnoseRouteTrackPoints(route: Route): RouteTrackDiagnostics {
  const pts = route.trackPoints ?? []
  const pointCount = pts.length
  const invalidCoords: RouteTrackDiagnostics['invalidCoords'] = []
  let validCoordCount = 0

  const orderIndices = pts.map((p) => p.orderIndex)
  const orderIndexNonFiniteCount = orderIndices.filter((i) => !Number.isFinite(i)).length
  const orderIndexMin =
    orderIndices.length && orderIndices.every((i) => Number.isFinite(i))
      ? Math.min(...(orderIndices as number[]))
      : null
  const orderIndexMax =
    orderIndices.length && orderIndices.every((i) => Number.isFinite(i))
      ? Math.max(...(orderIndices as number[]))
      : null

  const seenOrder = new Map<number, number>()
  let orderIndexDuplicateCount = 0
  for (const p of pts) {
    if (!Number.isFinite(p.orderIndex)) continue
    const c = seenOrder.get(p.orderIndex) ?? 0
    if (c >= 1) orderIndexDuplicateCount += 1
    seenOrder.set(p.orderIndex, c + 1)
  }

  pts.forEach((p, index) => {
    const lat = p.latitude
    const lng = p.longitude
    if (!isValidLatLng(lat, lng)) {
      invalidCoords.push({
        index,
        latitude: lat,
        longitude: lng,
        reason: !Number.isFinite(lat) || !Number.isFinite(lng) ? 'non-finite' : 'out-of-range',
      })
      return
    }
    validCoordCount += 1
  })

  const sorted = sortTrackPoints(pts)
  let duplicateConsecutiveSegments = 0
  let pathLengthM = 0
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1]!
    const b = sorted[i]!
    if (!isValidLatLng(a.latitude, a.longitude) || !isValidLatLng(b.latitude, b.longitude)) continue
    const d = haversineMeters(a.latitude, a.longitude, b.latitude, b.longitude)
    if (d < 0.05) duplicateConsecutiveSegments += 1
    pathLengthM += d
  }

  const validSorted = sorted.filter((p) => isValidLatLng(p.latitude, p.longitude))
  const insufficientForPolyline = validSorted.length < 2

  return {
    routeId: route.id,
    routeName: route.name,
    pointCount,
    sortedPointCount: sorted.length,
    validCoordCount,
    invalidCoords: invalidCoords.slice(0, 12),
    orderIndexMin,
    orderIndexMax,
    orderIndexDuplicateCount,
    orderIndexNonFiniteCount,
    duplicateConsecutiveSegments,
    pathLengthKmApprox: pathLengthM / 1000,
    insufficientForPolyline,
  }
}

const PREFIX = '[route-track]'

/** Registra un resumen útil en consola (activar sólo donde haga falta). */
export function logRouteTrackDiagnostics(context: string, route: Route): RouteTrackDiagnostics {
  const d = diagnoseRouteTrackPoints(route)
  const sampleInvalid = d.invalidCoords.length
    ? ` invalidFirst=${JSON.stringify(d.invalidCoords[0])}`
    : ''
  console.info(
    `${PREFIX} ${context} name="${d.routeName}" id=${d.routeId.slice(0, 8)}… ` +
      `pts=${d.pointCount} valid=${d.validCoordCount} pathKm≈${d.pathLengthKmApprox.toFixed(3)} ` +
      `orderIdx[${d.orderIndexMin},${d.orderIndexMax}] dupOrder=${d.orderIndexDuplicateCount} ` +
      `dupSeg≈${d.duplicateConsecutiveSegments} polylineOk=${!d.insufficientForPolyline}${sampleInvalid}`
  )
  if (d.insufficientForPolyline) {
    console.warn(
      `${PREFIX} ${context}: menos de 2 puntos válidos — el mapa no puede dibujar la ruta publicada.`
    )
  }
  return d
}
