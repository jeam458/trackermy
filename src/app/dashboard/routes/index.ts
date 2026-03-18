/**
 * exports para el módulo de rutas
 */

// Componentes de mapa
export { RouteMapEditor, RouteMapViewer } from '@/components/routes/RouteMapEditor'
export type { MapPoint } from '@/components/routes/RouteMapEditor'

// Hooks
export { useRouteCreator } from '@/hooks/useRouteCreator'
export type { UseRouteCreatorReturn, RouteCreationState } from '@/hooks/useRouteCreator'

export { useGPSRecorder, formatTime, formatDistance, formatSpeed } from '@/hooks/useGPSRecorder'
export type { UseGPSRecorderReturn, RecordingOptions, RecordingState } from '@/hooks/useGPSRecorder'

// Casos de uso
export { GPSTrackProcessingService } from '@/core/application/CreateRouteUseCase'

// Dominio
export type {
  Route,
  RouteStatus,
  RouteTrackPoint,
  RouteCreationRequest,
  RouteUpdateRequest,
  RouteRepository,
} from '@/core/domain/Route'

export type {
  GPSPoint,
  ProcessedTrackPoint,
  ProcessedTrack,
  TrackQuality,
  GPSFilterConfig,
  DEFAULT_GPS_FILTER_CONFIG,
} from '@/core/domain/GPSTrack'

// Repositorio
export { SupabaseRouteRepository } from '@/core/infrastructure/repositories/SupabaseRouteRepository'
