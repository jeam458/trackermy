export interface MapPoint {
  latitude: number
  longitude: number
  altitude?: number
  accuracy?: number
  speed?: number
}

export interface RouteMapEditorProps {
  startPoint?: MapPoint | null
  endPoint?: MapPoint | null
  trackPoints: MapPoint[]
  onPointAdd: (point: MapPoint) => void
  onPointRemove: (index: number) => void
  onStartPointSet: (point: MapPoint) => void
  onEndPointSet: (point: MapPoint) => void
  isDrawing: boolean
  pointSelectionMode?: 'start' | 'end' | 'intermediate' | null
  startPointSelection?: (type: 'start' | 'end' | 'intermediate') => void
  cancelPointSelection?: () => void
  onUseCurrentLocation?: () => void
  center?: [number, number]
  zoom?: number
  liveRecording?: boolean
  flyToWhenReady?: [number, number] | null
  flyToBump?: number
  liveMapAvatarUrl?: string | null
  liveBikeMapIconUrl?: string | null
  liveBikeColorHex?: string | null
  previewRiderAvatar?: boolean
  mapTilePreset?: 'dark' | 'outdoor'
  fillViewport?: boolean
  publishedReferencePath?: MapPoint[] | null
  publishedReferenceRouteId?: string | null
  riderPreviewPosition?: MapPoint | null
  lockToNetwork?: boolean
  lockToNetworkMaxSnapMeters?: number
  lockToNetworkMode?: 'motor' | 'trail' | 'both'
}

export interface RouteMapViewerProps {
  startPoint: MapPoint
  endPoint: MapPoint
  trackPoints: MapPoint[]
  center?: [number, number]
  zoom?: number
}
