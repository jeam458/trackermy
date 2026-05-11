import type { ProcessedTrack } from '@/core/domain/GPSTrack'
import type { RouteTrackType } from '@/core/domain/Route'
import { GPSTrackProcessingService } from '@/core/application/CreateRouteUseCase'
import { snapProcessedTrackToOsmNetwork } from '@/lib/osmTrackSnap'

export type OsmSnapToggles = {
  /** Ajuste a vías asfaltadas (OSM motor). */
  useOsmRoad: boolean
  /** Ajuste a sendas / camino blando mapeado en OSM. */
  useOsmTrail: boolean
}

/**
 * Valores sugeridos al elegir "tipo de pista" al crear ruta; el rider puede activar o quitar.
 * - pavimento: conviene ajuste a calzada por offset GPS frecuente.
 * - trail/DH: por defecto sin OSM; la línea grabada manda; senda OSM es opcional si está mapeada.
 */
export function defaultSnapTogglesForTrackType(trackType: RouteTrackType): OsmSnapToggles {
  switch (trackType) {
    case 'pavement':
      return { useOsmRoad: true, useOsmTrail: false }
    case 'trail':
    case 'mixed':
    default:
      return { useOsmRoad: false, useOsmTrail: false }
  }
}

/**
 * Aplica cadenas de proyección OSM (no ambas a la vez: prioridad pavimento y luego senda si ambas vinieran true).
 */
export async function applyOsmSnapsToProcessedTrack(
  processingService: GPSTrackProcessingService,
  base: ProcessedTrack,
  toggles: OsmSnapToggles
): Promise<ProcessedTrack> {
  let t = base
  if (toggles.useOsmRoad && toggles.useOsmTrail) {
    // Un solo pase combinado no existe; priorizar calzada, luego senda (poco habitual).
    const afterRoad = await snapProcessedTrackToOsmNetwork(t.points, { network: 'motor' })
    t = processingService.rebuildProcessedTrack(t, afterRoad)
    const afterTrail = await snapProcessedTrackToOsmNetwork(t.points, { network: 'trail' })
    return processingService.rebuildProcessedTrack(t, afterTrail)
  }
  if (toggles.useOsmRoad) {
    const p = await snapProcessedTrackToOsmNetwork(t.points, { network: 'motor' })
    return processingService.rebuildProcessedTrack(t, p)
  }
  if (toggles.useOsmTrail) {
    const p = await snapProcessedTrackToOsmNetwork(t.points, { network: 'trail' })
    return processingService.rebuildProcessedTrack(t, p)
  }
  return t
}
