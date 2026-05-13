'use client'

import { useEffect, useRef, useCallback, useMemo } from 'react'
import type maplibregl from 'maplibre-gl'
import { MapPin, Navigation, ChevronRight, Layers } from 'lucide-react'
import {
  APP_MAP_CANVAS_HEX,
  routeColorFromId,
} from '../mapTheme'
import { PartidaSonarMaplibre } from '@/components/routes/PartidaSonarMaplibre'
import { snapLatLngToCachedOsm } from '@/lib/osmWaysOfflineCache'
import {
  MAPLIBRE_CARTO_DARK_STYLE,
  MAPLIBRE_STYLE_NATURAL_LIGHT,
} from '@/lib/maplibreAppStyles'

import type { MapPoint, RouteMapEditorProps, RouteMapViewerProps } from './types'
import {
  hexToRgba,
  normalizeRecordingAccent,
  DEFAULT_RECORDING_ACCENT,
} from './icons'
import {
  FitBoundsToPublishedRoute,
  LiveRecordingMapFollower,
  FlyToWhenReady,
  MapEventHandler,
  MapSearchPanel,
  UserLocationTracker,
  liveRecordingMarkerIndices,
} from './subcomponents'
import {
  Map,
  MapControls,
  MapMarker,
  MapRoute,
  MarkerContent,
  MarkerPopup,
  useMap,
} from '@/components/ui/map'

export type { MapPoint, RouteMapEditorProps, RouteMapViewerProps } from './types'

const isGeolocationAvailable = typeof navigator !== 'undefined' && navigator.geolocation

function latLngToLngLat([lat, lng]: [number, number]): [number, number] {
  return [lng, lat]
}

function pointsToLineCoords(points: MapPoint[]): [number, number][] {
  return points.map((p) => [p.longitude, p.latitude])
}

function MapResizeOnWindowResize() {
  const { map } = useMap()
  useEffect(() => {
    if (!map) return
    const onResize = () => {
      requestAnimationFrame(() => {
        try {
          map.resize()
        } catch {
          /* noop */
        }
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [map])
  return null
}

function ViewerDisableScrollZoom() {
  const { map, isLoaded } = useMap()
  useEffect(() => {
    if (!isLoaded || !map) return
    map.scrollZoom.disable()
    return () => {
      map.scrollZoom.enable()
    }
  }, [map, isLoaded])
  return null
}

function StartPin() {
  return (
    <MarkerContent className="flex h-[30px] w-[30px] items-center justify-center rounded-full border-[3px] border-white bg-green-600 text-xs font-bold text-white shadow-lg">
      A
    </MarkerContent>
  )
}

function EndPin() {
  return (
    <MarkerContent className="flex h-[30px] w-[30px] items-center justify-center rounded-full border-[3px] border-white bg-red-600 text-xs font-bold text-white shadow-lg">
      B
    </MarkerContent>
  )
}

function LiveRiderMarkerContent({
  liveBikeMapIconUrl,
  liveMapAvatarUrl,
  recordingAccent,
}: {
  liveBikeMapIconUrl: string | null
  liveMapAvatarUrl: string | null
  recordingAccent: string
}) {
  if (liveBikeMapIconUrl?.trim()) {
    const u = encodeURI(liveBikeMapIconUrl.trim())
    return (
      <MarkerContent className="bg-transparent p-0 shadow-none">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full p-[3px] shadow-lg ring-2 ring-offset-2 ring-offset-slate-900"
          style={{ background: recordingAccent }}
        >
          <div className="h-full w-full overflow-hidden rounded-full border-2 border-slate-900 bg-slate-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt="" className="h-full w-full object-cover" />
          </div>
        </div>
      </MarkerContent>
    )
  }
  if (liveMapAvatarUrl?.trim()) {
    const u = encodeURI(liveMapAvatarUrl.trim())
    return (
      <MarkerContent className="bg-transparent p-0 shadow-none">
        <div className="h-9 w-9 overflow-hidden rounded-full border-[3px] border-slate-900 shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={u} alt="" className="h-full w-full object-cover" />
        </div>
      </MarkerContent>
    )
  }
  return (
    <MarkerContent className="bg-transparent p-0 shadow-none">
      <div
        className="flex h-9 w-9 items-center justify-center rounded-full border-[2.5px] text-[15px] shadow-lg"
        style={{
          background: `linear-gradient(155deg, ${recordingAccent} 0%, #0f172a 92%)`,
          borderColor: recordingAccent,
        }}
      >
        🚴
      </div>
    </MarkerContent>
  )
}

function LiveGpsPin() {
  return (
    <MarkerContent className="flex h-[34px] w-[34px] items-center justify-center rounded-full border-[3px] border-slate-900 bg-gradient-to-br from-teal-400 to-teal-700 text-[15px] shadow-lg">
      🚴
    </MarkerContent>
  )
}

export function RouteMapEditor({
  startPoint,
  endPoint,
  trackPoints,
  onPointAdd,
  onPointRemove,
  onStartPointSet,
  onEndPointSet,
  isDrawing,
  pointSelectionMode = null,
  startPointSelection = () => {},
  cancelPointSelection = () => {},
  onUseCurrentLocation = () => {},
  center = [-13.5319, -71.9675],
  zoom = 18,
  liveRecording = false,
  flyToWhenReady = null,
  flyToBump = 0,
  liveMapAvatarUrl = null,
  liveBikeMapIconUrl = null,
  liveBikeColorHex = null,
  previewRiderAvatar = false,
  mapTilePreset = 'dark',
  fillViewport = false,
  publishedReferencePath = null,
  publishedReferenceRouteId = null,
  riderPreviewPosition = null,
  lockToNetwork = false,
  lockToNetworkMaxSnapMeters,
  lockToNetworkMode = 'both',
}: RouteMapEditorProps) {
  const mapRef = useRef<maplibregl.Map | null>(null)
  const mapContainerResizeRef = useRef<HTMLDivElement | null>(null)
  const forceStyle = mapTilePreset === 'outdoor' ? MAPLIBRE_STYLE_NATURAL_LIGHT : MAPLIBRE_CARTO_DARK_STYLE
  const mapCanvasBg = APP_MAP_CANVAS_HEX

  useEffect(() => {
    const el = mapContainerResizeRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      const m = mapRef.current
      if (!m) return
      requestAnimationFrame(() => {
        try {
          m.resize()
        } catch {
          /* noop */
        }
      })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /** [lat, lng] — al menos 1 punto para partida/sonar; la polilínea publicada sigue exigiendo >=2. */
  const publishedPositions = useMemo((): [number, number][] => {
    if (!publishedReferencePath || publishedReferencePath.length < 1) return []
    return publishedReferencePath.map((p) => [p.latitude, p.longitude] as [number, number])
  }, [publishedReferencePath])

  const publishedLineCoords = useMemo(
    () => publishedPositions.map(latLngToLngLat),
    [publishedPositions],
  )

  const referenceLineColor = useMemo(() => {
    if (publishedReferenceRouteId) return routeColorFromId(publishedReferenceRouteId)
    return '#ef4444'
  }, [publishedReferenceRouteId])

  const recordingAccent = useMemo(
    () => normalizeRecordingAccent(liveBikeColorHex, DEFAULT_RECORDING_ACCENT),
    [liveBikeColorHex],
  )

  const liveLineColor = useMemo(
    () => (liveRecording ? hexToRgba(recordingAccent, 0.38) : '#fbbf24'),
    [liveRecording, recordingAccent],
  )

  const showRiderIcon = liveRecording || previewRiderAvatar

  const handleMapClick = useCallback(
    async (lat: number, lng: number) => {
      if (!isDrawing) return

      let newPoint: MapPoint = { latitude: lat, longitude: lng }
      if (lockToNetwork) {
        const snapped = await snapLatLngToCachedOsm(lat, lng, {
          maxSnapMeters: lockToNetworkMaxSnapMeters ?? 95,
          mode: lockToNetworkMode,
          preferTrail: lockToNetworkMode !== 'motor',
        })
        if (snapped) newPoint = { latitude: snapped.latitude, longitude: snapped.longitude }
      }

      if (pointSelectionMode) {
        switch (pointSelectionMode) {
          case 'start':
            onStartPointSet(newPoint)
            cancelPointSelection()
            break

          case 'end':
            onEndPointSet(newPoint)
            cancelPointSelection()
            break

          case 'intermediate':
            onPointAdd(newPoint)
            break
        }
      }
    },
    [
      isDrawing,
      pointSelectionMode,
      onPointAdd,
      onStartPointSet,
      onEndPointSet,
      cancelPointSelection,
      lockToNetwork,
      lockToNetworkMaxSnapMeters,
      lockToNetworkMode,
    ],
  )

  const handleMapReady = useCallback((map: maplibregl.Map) => {
    mapRef.current = map
  }, [])

  const handleLocationUpdate = useCallback(() => {
    /* reservado */
  }, [])

  const allPoints: MapPoint[] = []
  if (startPoint) allPoints.push(startPoint)
  allPoints.push(...trackPoints)
  if (endPoint) allPoints.push(endPoint)

  const mainLineCoords = useMemo(() => {
    const pts: MapPoint[] = []
    if (startPoint) pts.push(startPoint)
    pts.push(...trackPoints)
    if (endPoint) pts.push(endPoint)
    return pointsToLineCoords(pts)
  }, [startPoint, endPoint, trackPoints])

  const liveMarkerIdx =
    liveRecording && trackPoints.length > 0
      ? liveRecordingMarkerIndices(trackPoints.length)
      : null

  const mapCenterLngLat: [number, number] = [center[1], center[0]]

  return (
    <div
      ref={mapContainerResizeRef}
      className={`relative w-full ${fillViewport ? 'h-full min-h-0' : ''}`}
    >
      <div
        className={`w-full overflow-hidden rounded-lg ${fillViewport ? 'h-full min-h-0' : 'min-h-[400px]'}`}
        style={{
          minHeight: fillViewport ? '100%' : '400px',
          height: fillViewport ? '100%' : undefined,
          background: mapCanvasBg,
        }}
      >
        <Map
          ref={mapRef}
          theme="dark"
          forceStyle={forceStyle}
          className="map-dark-ui h-full min-h-[inherit] w-full rounded-lg [&_.maplibregl-ctrl-attrib]:!text-[10px] [&_.maplibregl-ctrl-attrib]:!text-slate-400"
          center={mapCenterLngLat}
          zoom={zoom}
          minZoom={3}
          maxZoom={22}
        >
        <MapResizeOnWindowResize />
        <MapControls position="bottom-right" showZoom showCompass showFullscreen />

        {publishedPositions.length >= 2 && (
          <FitBoundsToPublishedRoute positions={publishedPositions} enabled={!liveRecording} />
        )}

        {publishedPositions.length >= 2 && (
          <MapRoute
            id={`pub-ref-${publishedReferenceRouteId ?? 'x'}`}
            coordinates={publishedLineCoords}
            color={referenceLineColor}
            width={liveRecording ? 3.5 : 5}
            opacity={liveRecording ? 0.4 : 0.92}
            interactive={false}
          />
        )}

        {publishedPositions.length >= 1 && (
          <PartidaSonarMaplibre
            position={publishedPositions[0]!}
            ringColor={referenceLineColor}
            signature={`sonar-pub-${publishedReferenceRouteId ?? 'x'}-${publishedPositions[0]![0].toFixed(5)}-${publishedPositions[0]![1].toFixed(5)}`}
            zIndexOffset={48}
            showCoreDot={false}
          />
        )}

        {publishedPositions.length >= 1 && (
          <MapMarker
            key={`pub-start-${publishedPositions[0]![0]}-${publishedPositions[0]![1]}`}
            longitude={publishedPositions[0]![1]}
            latitude={publishedPositions[0]![0]}
          >
            <StartPin />
            <MarkerPopup className="max-w-62 border border-white/10 bg-slate-900 p-2 text-slate-100 shadow-xl">
              <div className="p-2">
                <strong className="text-green-400">Salida (ruta publicada)</strong>
                <p className="mt-1 text-xs text-slate-400">
                  {publishedPositions[0]![0].toFixed(5)}, {publishedPositions[0]![1].toFixed(5)}
                </p>
              </div>
            </MarkerPopup>
          </MapMarker>
        )}

        {publishedPositions.length >= 2 && (
          <MapMarker
            key={`pub-end-${publishedPositions[publishedPositions.length - 1]![0]}-${publishedPositions[publishedPositions.length - 1]![1]}`}
            longitude={publishedPositions[publishedPositions.length - 1]![1]}
            latitude={publishedPositions[publishedPositions.length - 1]![0]}
          >
            <EndPin />
            <MarkerPopup className="max-w-62 border border-white/10 bg-slate-900 p-2 text-slate-100 shadow-xl">
              <div className="p-2">
                <strong className="text-red-400">Meta (ruta publicada)</strong>
                <p className="mt-1 text-xs text-slate-400">
                  {publishedPositions[publishedPositions.length - 1]![0].toFixed(5)},{' '}
                  {publishedPositions[publishedPositions.length - 1]![1].toFixed(5)}
                </p>
              </div>
            </MarkerPopup>
          </MapMarker>
        )}

        {isDrawing && <MapSearchPanel onPickStart={onStartPointSet} onPickEnd={onEndPointSet} />}

        {startPoint && (
          <MapMarker
            key={liveRecording ? 'recording-start-fixed' : `start-${startPoint.latitude}-${startPoint.longitude}`}
            longitude={startPoint.longitude}
            latitude={startPoint.latitude}
          >
            <StartPin />
            <MarkerPopup className="max-w-62 border border-white/10 bg-slate-900 p-2 text-slate-100 shadow-xl">
              <div className="p-2">
                <strong className="text-green-400">
                  {liveRecording ? 'Inicio de la bajada' : 'Punto de Partida'}
                </strong>
                <p className="mt-1 text-xs text-slate-400">
                  {startPoint.latitude.toFixed(6)}, {startPoint.longitude.toFixed(6)}
                </p>
                {startPoint.accuracy != null && (
                  <p className="text-xs text-slate-500">Precisión: ±{startPoint.accuracy.toFixed(1)}m</p>
                )}
              </div>
            </MarkerPopup>
          </MapMarker>
        )}

        {!liveRecording && riderPreviewPosition && previewRiderAvatar && (
          <MapMarker
            key={`rider-preview-${riderPreviewPosition.latitude}-${riderPreviewPosition.longitude}`}
            longitude={riderPreviewPosition.longitude}
            latitude={riderPreviewPosition.latitude}
          >
            {showRiderIcon ? (
              <LiveRiderMarkerContent
                liveBikeMapIconUrl={liveBikeMapIconUrl}
                liveMapAvatarUrl={liveMapAvatarUrl}
                recordingAccent={recordingAccent}
              />
            ) : (
              <LiveGpsPin />
            )}
            <MarkerPopup className="max-w-62 border border-white/10 bg-slate-900 p-2 text-slate-100 shadow-xl">
              <div className="p-2">
                <strong className="text-teal-400">Tu posición (GPS)</strong>
                <p className="mt-1 text-xs text-slate-400">
                  {riderPreviewPosition.latitude.toFixed(6)}, {riderPreviewPosition.longitude.toFixed(6)}
                </p>
                {riderPreviewPosition.accuracy != null && (
                  <p className="text-xs text-slate-500">Precisión: ±{riderPreviewPosition.accuracy.toFixed(1)}m</p>
                )}
              </div>
            </MarkerPopup>
          </MapMarker>
        )}

        {endPoint && (
          <MapMarker
            key={
              liveRecording
                ? `end-live-${endPoint.latitude.toFixed(5)}-${endPoint.longitude.toFixed(5)}`
                : `end-${endPoint.latitude}-${endPoint.longitude}`
            }
            longitude={endPoint.longitude}
            latitude={endPoint.latitude}
          >
            {liveRecording || previewRiderAvatar ? (
              showRiderIcon ? (
                <LiveRiderMarkerContent
                  liveBikeMapIconUrl={liveBikeMapIconUrl}
                  liveMapAvatarUrl={liveMapAvatarUrl}
                  recordingAccent={recordingAccent}
                />
              ) : (
                <LiveGpsPin />
              )
            ) : (
              <EndPin />
            )}
            <MarkerPopup className="max-w-62 border border-white/10 bg-slate-900 p-2 text-slate-100 shadow-xl">
              <div className="p-2">
                <strong
                  className={
                    liveRecording
                      ? 'text-red-400'
                      : previewRiderAvatar
                        ? 'text-teal-400'
                        : 'text-red-400'
                  }
                >
                  {liveRecording
                    ? 'Posición actual'
                    : previewRiderAvatar
                      ? 'Tu posición (GPS)'
                      : 'Punto de Llegada'}
                </strong>
                <p className="mt-1 text-xs text-slate-400">
                  {endPoint.latitude.toFixed(6)}, {endPoint.longitude.toFixed(6)}
                </p>
                {endPoint.accuracy != null && (
                  <p className="text-xs text-slate-500">Precisión: ±{endPoint.accuracy.toFixed(1)}m</p>
                )}
              </div>
            </MarkerPopup>
          </MapMarker>
        )}

        {(liveMarkerIdx ?? trackPoints.map((_, i) => i)).map((index) => {
          const point = trackPoints[index]
          if (!point) return null
          const r = liveRecording ? 3 : 8
          const w = liveRecording ? 1 : 2
          const fill = liveRecording ? recordingAccent : '#0ea5e9'
          const stroke = liveRecording ? hexToRgba(recordingAccent, 0.55) : '#38bdf8'
          return (
            <MapMarker
              key={liveRecording ? `live-tp-${index}` : `tp-${index}`}
              longitude={point.longitude}
              latitude={point.latitude}
              onClick={(e) => {
                e.stopPropagation()
                if (isDrawing) onPointRemove(index)
              }}
            >
              <MarkerContent className="cursor-pointer bg-transparent p-0 shadow-none">
                <div
                  className="rounded-full shadow-md"
                  style={{
                    width: r * 2,
                    height: r * 2,
                    backgroundColor: fill,
                    borderWidth: w,
                    borderStyle: 'solid',
                    borderColor: stroke,
                    opacity: liveRecording ? 0.35 : 0.75,
                  }}
                />
              </MarkerContent>
              <MarkerPopup className="max-w-62 border border-white/10 bg-slate-900 p-2 text-slate-100 shadow-xl">
                <div className="p-2">
                  <strong className="text-slate-100">Punto {index + 1}</strong>
                  <p className="mt-1 text-xs text-slate-400">
                    {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
                  </p>
                  {point.altitude != null && (
                    <p className="text-xs text-slate-500">Altitud: {point.altitude.toFixed(0)}m</p>
                  )}
                  {isDrawing && <p className="mt-2 text-xs text-sky-400">Click para eliminar</p>}
                </div>
              </MarkerPopup>
            </MapMarker>
          )
        })}

        {allPoints.length > 1 && (
          <MapRoute
            id={liveRecording ? `live-line-${allPoints.length}` : 'editor-main-line'}
            coordinates={mainLineCoords}
            color={liveLineColor}
            width={liveRecording ? 2.5 : 5}
            opacity={liveRecording ? 1 : 0.92}
            dashArray={isDrawing ? ([10, 10] as [number, number]) : undefined}
            interactive={false}
          />
        )}

        {liveRecording && <LiveRecordingMapFollower enabled={liveRecording} allLinePoints={allPoints} />}

        {flyToWhenReady != null && (
          <FlyToWhenReady target={flyToWhenReady} zoomMin={16} bump={flyToBump} />
        )}

        <MapEventHandler onMapClick={handleMapClick} onMapReady={handleMapReady} />

        <UserLocationTracker onLocationUpdate={handleLocationUpdate} enabled={isDrawing && !liveRecording} />
        </Map>
      </div>

      {isDrawing && (
        <div
          className="absolute left-4 top-4 max-w-xs rounded-lg border border-slate-600 bg-slate-900/95 p-4 text-slate-100 shadow-xl backdrop-blur-sm"
          style={{ zIndex: 9999 }}
        >
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-white">
            <Navigation size={18} className="text-amber-400" />
            Dibujar Ruta
          </h3>

          <div className="mb-4 border-b border-slate-600 pb-4">
            <div className="mb-2 flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${startPoint ? 'bg-green-500' : 'bg-slate-600'}`} />
              <span className="text-sm text-slate-300">Partida {startPoint ? '✓' : ''}</span>
            </div>
            <div className="mb-2 flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${endPoint ? 'bg-red-500' : 'bg-slate-600'}`} />
              <span className="text-sm text-slate-300">Meta {endPoint ? '✓' : ''}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-sky-500" />
              <span className="text-sm text-slate-300">Intermedios</span>
              <span className="ml-auto rounded-full bg-sky-500/20 px-2 py-0.5 text-xs text-sky-300">
                {trackPoints.length}
              </span>
            </div>
          </div>

          {startPoint && !endPoint && !pointSelectionMode && (
            <button
              type="button"
              onClick={() => startPointSelection?.('end')}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-3 py-2.5 text-sm font-bold text-slate-900 shadow-lg transition-colors hover:bg-amber-400"
            >
              Siguiente: marcar meta
              <ChevronRight size={18} />
            </button>
          )}

          {endPoint && !pointSelectionMode && (
            <button
              type="button"
              onClick={() => startPointSelection?.('intermediate')}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-500"
            >
              Siguiente: puntos del trazado
              <ChevronRight size={16} />
            </button>
          )}

          {startPoint && !pointSelectionMode && (
            <div className="space-y-2">
              <p className="mb-2 text-sm text-slate-400">
                {!endPoint ? 'O elige en el mapa / buscador' : 'Refina el recorrido con puntos intermedios'}
              </p>

              {!endPoint ? (
                <>
                  <button
                    type="button"
                    onClick={() => startPointSelection?.('end')}
                    className="flex w-full items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500"
                  >
                    <MapPin size={16} />
                    Tocar mapa: meta
                  </button>

                  <button
                    type="button"
                    onClick={() => startPointSelection?.('intermediate')}
                    className="flex w-full items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-500"
                  >
                    <Navigation size={16} />
                    Punto intermedio (mapa)
                  </button>

                  {isGeolocationAvailable && (
                    <button
                      type="button"
                      onClick={() => {
                        onUseCurrentLocation?.()
                      }}
                      className="flex w-full items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
                    >
                      <Navigation size={16} />
                      Mi ubicación
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => startPointSelection?.('intermediate')}
                    className="flex w-full items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-500"
                  >
                    <Navigation size={16} />
                    Otro intermedio
                  </button>

                  {isGeolocationAvailable && (
                    <button
                      type="button"
                      onClick={() => {
                        onUseCurrentLocation?.()
                      }}
                      className="flex w-full items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
                    >
                      <Navigation size={16} />
                      Mi ubicación
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {pointSelectionMode && (
            <div className="space-y-3">
              <div
                className={`rounded-lg border-2 p-3 ${
                  pointSelectionMode === 'start'
                    ? 'border-green-500 bg-green-950/80'
                    : pointSelectionMode === 'end'
                      ? 'border-red-500 bg-red-950/80'
                      : 'border-sky-500 bg-sky-950/80'
                }`}
              >
                <p className="mb-1 flex items-center gap-2 text-sm font-medium text-white">
                  {pointSelectionMode === 'start' && <MapPin className="text-green-400" size={16} />}
                  {pointSelectionMode === 'end' && <MapPin className="text-red-400" size={16} />}
                  {pointSelectionMode === 'intermediate' && <Navigation className="text-sky-400" size={16} />}
                  {pointSelectionMode === 'start' && 'Toca el mapa: INICIO'}
                  {pointSelectionMode === 'end' && 'Toca el mapa: META'}
                  {pointSelectionMode === 'intermediate' && 'Toca el mapa: punto intermedio'}
                </p>
              </div>

              <button
                type="button"
                onClick={cancelPointSelection}
                className="w-full rounded-lg bg-slate-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-500"
              >
                Cancelar
              </button>
            </div>
          )}

          <div className="mt-4 border-t border-slate-600 pt-4">
            <p className="text-xs text-slate-500">
              Total puntos: <span className="font-medium text-slate-200">{allPoints.length}</span>
            </p>
          </div>

          <div
            className="absolute -right-2 -top-2 rounded-full border border-slate-600 bg-slate-800 p-2 shadow-lg"
            title="Mapa vectorial"
          >
            <Layers size={16} className="text-amber-400" />
          </div>
        </div>
      )}
    </div>
  )
}

export function RouteMapViewer({
  startPoint,
  endPoint,
  trackPoints,
  center,
  zoom = 18,
}: RouteMapViewerProps) {
  const allPoints = [startPoint, ...trackPoints, endPoint]

  let centerPair = center
  if (!centerPair && allPoints.length > 0) {
    const sumLat = allPoints.reduce((sum, p) => sum + p.latitude, 0)
    const sumLng = allPoints.reduce((sum, p) => sum + p.longitude, 0)
    centerPair = [sumLat / allPoints.length, sumLng / allPoints.length]
  }

  const c = centerPair ?? ([-13.5319, -71.9675] as [number, number])
  const centerLngLat: [number, number] = [c[1], c[0]]
  const lineCoords = pointsToLineCoords(allPoints.filter(Boolean) as MapPoint[])

  return (
    <div
      className="map-dark-ui h-full min-h-[300px] w-full overflow-hidden rounded-lg"
      style={{ background: APP_MAP_CANVAS_HEX }}
    >
      <Map
        theme="dark"
        forceStyle={MAPLIBRE_CARTO_DARK_STYLE}
        className="map-dark-ui h-full min-h-[300px] w-full rounded-lg [&_.maplibregl-ctrl-attrib]:!text-[10px] [&_.maplibregl-ctrl-attrib]:!text-slate-400"
        center={centerLngLat}
        zoom={zoom}
        minZoom={3}
        maxZoom={22}
      >
        <ViewerDisableScrollZoom />
        <MapResizeOnWindowResize />
      <MapControls position="bottom-right" showZoom showCompass />

      {startPoint && (
        <MapMarker key={`v-s-${startPoint.latitude}-${startPoint.longitude}`} longitude={startPoint.longitude} latitude={startPoint.latitude}>
          <StartPin />
        </MapMarker>
      )}

      {endPoint && (
        <MapMarker key={`v-e-${endPoint.latitude}-${endPoint.longitude}`} longitude={endPoint.longitude} latitude={endPoint.latitude}>
          <EndPin />
        </MapMarker>
      )}

      {trackPoints.map((point: MapPoint, index: number) => (
        <MapMarker key={index} longitude={point.longitude} latitude={point.latitude}>
          <MarkerContent className="h-3 w-3 rounded-full border-2 border-blue-400 bg-blue-500 opacity-80 shadow-md" />
        </MapMarker>
      ))}

      {lineCoords.length > 1 && (
        <MapRoute id="route-viewer-line" coordinates={lineCoords} color="#fbbf24" width={5} opacity={0.9} interactive={false} />
      )}
    </Map>
    </div>
  )
}
