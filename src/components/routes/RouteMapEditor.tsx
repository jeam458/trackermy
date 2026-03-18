'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, CircleMarker, Popup } from 'react-leaflet'
import { Icon, LatLng, Map } from 'leaflet'
import { MapPin, Navigation, Trash2, Undo2, Layers } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import { HYBRID_MAP_LAYERS, DOWNHILL_HYBRID_CONFIG } from './hybridMapStyle'

// Fix para iconos de Leaflet en React
const createCustomIcon = (color: string, size = 25) => {
  // Usar encodeURIComponent en lugar de btoa para evitar problemas con SSR
  const svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="${size}" height="${size}">
        <circle cx="12" cy="12" r="10" stroke="white" stroke-width="2"/>
      </svg>
    `.trim()
  
  return new Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svgContent)}`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  })
}

const startIcon = createCustomIcon('#22c55e', 30) // verde
const endIcon = createCustomIcon('#ef4444', 30) // rojo
const pointIcon = createCustomIcon('#3b82f6', 15) // azul

export interface MapPoint {
  latitude: number
  longitude: number
  altitude?: number
  accuracy?: number
}

interface RouteMapEditorProps {
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
}

// Verificar si la geolocalización está disponible
const isGeolocationAvailable = typeof navigator !== 'undefined' && navigator.geolocation

// Componente para manejar eventos del mapa
function MapEventHandler({
  onMapClick,
  onMapReady,
}: {
  onMapClick: (lat: number, lng: number) => void
  onMapReady: (map: Map) => void
}) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng)
    },
    load: (e) => {
      onMapReady(e.target)
    },
  })
  return null
}

// Componente para controles personalizados de Leaflet
function LeafletControlPanel({
  startPoint,
  endPoint,
  trackPoints,
  pointSelectionMode,
  startPointSelection,
  cancelPointSelection,
  onUseCurrentLocation,
  allPointsCount,
}: {
  startPoint: MapPoint | null
  endPoint: MapPoint | null
  trackPoints: MapPoint[]
  pointSelectionMode: 'start' | 'end' | 'intermediate' | null
  startPointSelection?: (type: 'start' | 'end' | 'intermediate') => void
  cancelPointSelection?: () => void
  onUseCurrentLocation?: () => void
  allPointsCount: number
}) {
  // Verificar si la geolocalización está disponible
  const isGeolocationAvailable = typeof navigator !== 'undefined' && navigator.geolocation

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-4 max-w-xs" style={{ zIndex: 1000 }}>
      <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <Navigation size={18} className="text-amber-500" />
        Dibujar Ruta
      </h3>

      {/* Estado actual */}
      <div className="mb-4 pb-4 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-3 h-3 rounded-full ${
            startPoint ? 'bg-green-500' : 'bg-gray-300'
          }`} />
          <span className="text-sm text-gray-600">Partida</span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-3 h-3 rounded-full ${
            endPoint ? 'bg-red-500' : 'bg-gray-300'
          }`} />
          <span className="text-sm text-gray-600">Llegada</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-sm text-gray-600">Intermedios</span>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full ml-auto">
            {trackPoints.length}
          </span>
        </div>
      </div>

      {/* Panel de selección - Mostrar después de poner el punto de partida */}
      {startPoint && !pointSelectionMode && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600 mb-2">
            {!endPoint 
              ? "¿Qué quieres hacer ahora?" 
              : "Agrega más puntos o guarda la ruta"
            }
          </p>

          {!endPoint ? (
            <>
              <button
                onClick={() => startPointSelection?.('end')}
                className="w-full py-2 px-3 bg-red-500 hover:bg-red-400 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <MapPin size={16} />
                Agregar Punto de Llegada
              </button>
              
              <button
                onClick={() => startPointSelection?.('intermediate')}
                className="w-full py-2 px-3 bg-blue-500 hover:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <Navigation size={16} />
                Agregar Punto Intermedio
              </button>

              {isGeolocationAvailable && (
                <button
                  onClick={() => {
                    onUseCurrentLocation?.()
                  }}
                  className="w-full py-2 px-3 bg-green-500 hover:bg-green-400 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  <Navigation size={16} />
                  Usar Mi Ubicación
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={() => startPointSelection?.('intermediate')}
                className="w-full py-2 px-3 bg-blue-500 hover:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <Navigation size={16} />
                Agregar Punto Intermedio
              </button>
              
              {isGeolocationAvailable && (
                <button
                  onClick={() => {
                    onUseCurrentLocation?.()
                  }}
                  className="w-full py-2 px-3 bg-green-500 hover:bg-green-400 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  <Navigation size={16} />
                  Usar Mi Ubicación Actual
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Modo de selección activo */}
      {pointSelectionMode && (
        <div className="space-y-3">
          <div className={`p-3 rounded-lg ${
            pointSelectionMode === 'start' ? 'bg-green-100 border-2 border-green-500' :
            pointSelectionMode === 'end' ? 'bg-red-100 border-2 border-red-500' :
            'bg-blue-100 border-2 border-blue-500'
          }`}>
            <p className="text-sm font-medium mb-1 flex items-center gap-2">
              {pointSelectionMode === 'start' && <MapPin className="text-green-600" size={16} />}
              {pointSelectionMode === 'end' && <MapPin className="text-red-600" size={16} />}
              {pointSelectionMode === 'intermediate' && <Navigation className="text-blue-600" size={16} />}
              {pointSelectionMode === 'start' && 'Click para marcar el INICIO'}
              {pointSelectionMode === 'end' && 'Click para marcar el FIN'}
              {pointSelectionMode === 'intermediate' && 'Click para agregar punto'}
            </p>
          </div>

          <button
            onClick={cancelPointSelection}
            className="w-full py-2 px-3 bg-gray-500 hover:bg-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Puntos totales */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Total puntos: <span className="font-medium text-gray-700">{allPointsCount}</span>
        </p>
      </div>
    </div>
  )
}

// Componente para agregar control personalizado a Leaflet
// (Eliminado - usaremos div absoluto con z-index alto)
function UserLocationTracker({
  onLocationUpdate,
  enabled = false,
}: {
  onLocationUpdate: (point: MapPoint) => void
  enabled: boolean
}) {
  const map = useMapEvents({})
  const watchIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled || !navigator.geolocation) {
      return
    }

    // Limpiar watch anterior si existe
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const point: MapPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          altitude: position.coords.altitude ?? undefined,
          accuracy: position.coords.accuracy ?? undefined,
        }
        onLocationUpdate(point)
        // No hacer setView automáticamente para no molestar al usuario
        // El usuario puede usar el botón "Usar Mi Ubicación" si lo desea
      },
      (error) => {
        // Solo loguear errores, no mostrar alertas molestas
        if (error.code === error.PERMISSION_DENIED) {
          console.log('Permiso de ubicación denegado')
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          console.log('Ubicación no disponible')
        } else if (error.code === error.TIMEOUT) {
          console.log('Timeout al obtener ubicación')
        } else {
          console.error('Error de geolocalización:', error)
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000, // Aceptar ubicación de hasta 5 segundos
        timeout: 10000, // 10 segundos timeout
      }
    )

    // Cleanup
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [enabled, onLocationUpdate])

  return null
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
  center = [-13.5319, -71.9675], // Cusco, Peru por defecto
  zoom = 18, // Zoom máximo detalle (se ven casas, árboles, senderos de 1m)
}: RouteMapEditorProps) {
  const mapRef = useRef<Map | null>(null)
  const [mapType, setMapType] = useState<'satellite' | 'street'>('satellite')

  // Solo modo satelital - Sin cambio automático

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (!isDrawing) return

      const newPoint: MapPoint = {
        latitude: lat,
        longitude: lng,
      }

      // Si hay un modo de selección activo, usarlo
      if (pointSelectionMode) {
        switch (pointSelectionMode) {
          case 'start':
            onStartPointSet(newPoint)
            // Después de poner el inicio, limpiar selección para mostrar el panel
            break

          case 'end':
            onEndPointSet(newPoint)
            // Después de poner el fin, limpiar selección
            break

          case 'intermediate':
            onPointAdd(newPoint)
            // Mantener en modo intermedio para agregar más puntos
            break
        }
      }
      // Si no hay modo de selección, no hacer nada (el usuario debe seleccionar del panel)
    },
    [isDrawing, pointSelectionMode, onPointAdd, onStartPointSet, onEndPointSet]
  )

  const handleMapReady = useCallback((map: Map) => {
    mapRef.current = map
  }, [])

  const handleLocationUpdate = useCallback(
    (point: MapPoint) => {
      if (isDrawing && !startPoint) {
        // Usar ubicación actual como punto de inicio si el usuario lo desea
        // Esto es opcional, el usuario puede hacer click manualmente
      }
    },
    [isDrawing, startPoint]
  )

  // Construir array completo de puntos para el polyline
  const allPoints: MapPoint[] = []
  if (startPoint) allPoints.push(startPoint)
  allPoints.push(...trackPoints)
  if (endPoint) allPoints.push(endPoint)

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={center}
        zoom={zoom}
        minZoom={3}
        maxZoom={19} // Zoom máximo 19 (OpenStreetMap vectorial)
        className="w-full h-full rounded-lg"
        style={{ minHeight: '400px' }}
      >
        {/* Capa satelital (Esri World Imagery) - Zoom máximo 19 */}
        <TileLayer
          attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
        />

        {/* Capa de etiquetas de calles (referencia) */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://stamen-tiles.a.ssl.fastly.net/toner-labels/{z}/{x}/{y}.png"
          opacity={0.4}
          maxZoom={19}
        />

        {/* Marker de inicio */}
        {startPoint && (
          <Marker
            position={[startPoint.latitude, startPoint.longitude]}
            icon={startIcon}
          >
            <Popup>
              <div className="p-2">
                <strong className="text-green-600">Punto de Partida</strong>
                <p className="text-xs text-gray-500 mt-1">
                  {startPoint.latitude.toFixed(6)}, {startPoint.longitude.toFixed(6)}
                </p>
                {startPoint.accuracy && (
                  <p className="text-xs text-gray-400">
                    Precisión: ±{startPoint.accuracy.toFixed(1)}m
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Marker de fin */}
        {endPoint && (
          <Marker
            position={[endPoint.latitude, endPoint.longitude]}
            icon={endIcon}
          >
            <Popup>
              <div className="p-2">
                <strong className="text-red-600">Punto de Llegada</strong>
                <p className="text-xs text-gray-500 mt-1">
                  {endPoint.latitude.toFixed(6)}, {endPoint.longitude.toFixed(6)}
                </p>
                {endPoint.accuracy && (
                  <p className="text-xs text-gray-400">
                    Precisión: ±{endPoint.accuracy.toFixed(1)}m
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Puntos intermedios */}
        {trackPoints.map((point, index) => (
          <CircleMarker
            key={index}
            center={[point.latitude, point.longitude]}
            radius={8}
            color="#3b82f6"
            fillColor="#3b82f6"
            fillOpacity={0.6}
            eventHandlers={{
              click: (e) => {
                e.originalEvent.stopPropagation()
                if (isDrawing) {
                  onPointRemove(index)
                }
              },
            }}
          >
            <Popup>
              <div className="p-2">
                <strong>Punto {index + 1}</strong>
                <p className="text-xs text-gray-500 mt-1">
                  {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
                </p>
                {point.altitude && (
                  <p className="text-xs text-gray-400">
                    Altitud: {point.altitude.toFixed(0)}m
                  </p>
                )}
                {isDrawing && (
                  <p className="text-xs text-blue-500 mt-2">
                    Click para eliminar
                  </p>
                )}
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* Línea de la ruta */}
        {allPoints.length > 1 && (
          <Polyline
            positions={allPoints.map((p) => [p.latitude, p.longitude] as [number, number])}
            color="#f59e0b"
            weight={4}
            opacity={0.8}
            dashArray={isDrawing ? '10, 10' : undefined}
          />
        )}

        {/* Manejador de eventos */}
        <MapEventHandler onMapClick={handleMapClick} onMapReady={handleMapReady} />

        {/* Tracker de ubicación del usuario */}
        <UserLocationTracker
          onLocationUpdate={handleLocationUpdate}
          enabled={isDrawing}
        />
      </MapContainer>

      {/* Overlay de instrucciones y selección - CON Z-INDEX ALTO PARA ESTAR ENCIMA DEL MAPA */}
      {isDrawing && (
        <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-4 max-w-xs" style={{ zIndex: 9999 }}>
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Navigation size={18} className="text-amber-500" />
            Dibujar Ruta
          </h3>

          {/* Estado actual */}
          <div className="mb-4 pb-4 border-b border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-3 h-3 rounded-full ${
                startPoint ? 'bg-green-500' : 'bg-gray-300'
              }`} />
              <span className="text-sm text-gray-600">Partida</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-3 h-3 rounded-full ${
                endPoint ? 'bg-red-500' : 'bg-gray-300'
              }`} />
              <span className="text-sm text-gray-600">Llegada</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-sm text-gray-600">Intermedios</span>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full ml-auto">
                {trackPoints.length}
              </span>
            </div>
          </div>

          {/* Panel de selección - Mostrar después de poner el punto de partida */}
          {startPoint && !pointSelectionMode && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600 mb-2">
                {!endPoint 
                  ? "¿Qué quieres hacer ahora?" 
                  : "Agrega más puntos o guarda la ruta"
                }
              </p>

              {!endPoint ? (
                <>
                  <button
                    onClick={() => startPointSelection?.('end')}
                    className="w-full py-2 px-3 bg-red-500 hover:bg-red-400 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                  >
                    <MapPin size={16} />
                    Agregar Punto de Llegada
                  </button>
                  
                  <button
                    onClick={() => startPointSelection?.('intermediate')}
                    className="w-full py-2 px-3 bg-blue-500 hover:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Navigation size={16} />
                    Agregar Punto Intermedio
                  </button>

                  {isGeolocationAvailable && (
                    <button
                      onClick={() => {
                        onUseCurrentLocation?.()
                      }}
                      className="w-full py-2 px-3 bg-green-500 hover:bg-green-400 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                      <Navigation size={16} />
                      Usar Mi Ubicación
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    onClick={() => startPointSelection?.('intermediate')}
                    className="w-full py-2 px-3 bg-blue-500 hover:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Navigation size={16} />
                    Agregar Punto Intermedio
                  </button>
                  
                  {isGeolocationAvailable && (
                    <button
                      onClick={() => {
                        onUseCurrentLocation?.()
                      }}
                      className="w-full py-2 px-3 bg-green-500 hover:bg-green-400 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                      <Navigation size={16} />
                      Usar Mi Ubicación Actual
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Modo de selección activo */}
          {pointSelectionMode && (
            <div className="space-y-3">
              <div className={`p-3 rounded-lg ${
                pointSelectionMode === 'start' ? 'bg-green-100 border-2 border-green-500' :
                pointSelectionMode === 'end' ? 'bg-red-100 border-2 border-red-500' :
                'bg-blue-100 border-2 border-blue-500'
              }`}>
                <p className="text-sm font-medium mb-1 flex items-center gap-2">
                  {pointSelectionMode === 'start' && <MapPin className="text-green-600" size={16} />}
                  {pointSelectionMode === 'end' && <MapPin className="text-red-600" size={16} />}
                  {pointSelectionMode === 'intermediate' && <Navigation className="text-blue-600" size={16} />}
                  {pointSelectionMode === 'start' && 'Click para marcar el INICIO'}
                  {pointSelectionMode === 'end' && 'Click para marcar el FIN'}
                  {pointSelectionMode === 'intermediate' && 'Click para agregar punto'}
                </p>
              </div>

              <button
                onClick={cancelPointSelection}
                className="w-full py-2 px-3 bg-gray-500 hover:bg-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          )}

          {/* Puntos totales */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              Total puntos: <span className="font-medium text-gray-700">{allPoints.length}</span>
            </p>
          </div>

          {/* Control de tipo de mapa - Solo informativo */}
          <div className="absolute -top-2 -right-2 bg-slate-800 rounded-full shadow-lg p-2" title="Vista satelital">
            <Layers size={16} className="text-white" />
          </div>
        </div>
      )}
    </div>
  )
}

// Componente de visualización de ruta (solo lectura)
interface RouteMapViewerProps {
  startPoint: MapPoint
  endPoint: MapPoint
  trackPoints: MapPoint[]
  center?: [number, number]
  zoom?: number
}

export function RouteMapViewer({
  startPoint,
  endPoint,
  trackPoints,
  center,
  zoom = 18, // Zoom máximo detalle
}: RouteMapViewerProps) {
  const allPoints = [startPoint, ...trackPoints, endPoint]

  // Calcular centro si no se proporciona
  if (!center && allPoints.length > 0) {
    const sumLat = allPoints.reduce((sum, p) => sum + p.latitude, 0)
    const sumLng = allPoints.reduce((sum, p) => sum + p.longitude, 0)
    center = [sumLat / allPoints.length, sumLng / allPoints.length]
  }

  return (
    <MapContainer
      center={center || [-13.5319, -71.9675]} // Cusco por defecto
      zoom={zoom}
      className="w-full h-full rounded-lg"
      style={{ minHeight: '300px' }}
      scrollWheelZoom={false}
    >
      {/* Capa satelital (Esri World Imagery) - Base */}
      <TileLayer
        attribution={HYBRID_MAP_LAYERS.satellite.attribution}
        url={HYBRID_MAP_LAYERS.satellite.url}
        opacity={HYBRID_MAP_LAYERS.satellite.opacity}
      />

      {/* 2. Relieve sombreado (terrain) */}
      <TileLayer
        attribution={HYBRID_MAP_LAYERS.terrain.attribution}
        url={HYBRID_MAP_LAYERS.terrain.url}
        opacity={HYBRID_MAP_LAYERS.terrain.opacity}
      />

      {/* 3. Hidrografía (ríos, lagos, quebradas) */}
      <TileLayer
        attribution={HYBRID_MAP_LAYERS.hydrography.attribution}
        url={HYBRID_MAP_LAYERS.hydrography.url}
        opacity={HYBRID_MAP_LAYERS.hydrography.opacity}
      />

      {/* 4. Parques y áreas verdes */}
      <TileLayer
        attribution={HYBRID_MAP_LAYERS.parks.attribution}
        url={HYBRID_MAP_LAYERS.parks.url}
        opacity={HYBRID_MAP_LAYERS.parks.opacity}
      />

      {/* 5. Edificios y estructuras */}
      <TileLayer
        attribution={HYBRID_MAP_LAYERS.buildings.attribution}
        url={HYBRID_MAP_LAYERS.buildings.url}
        opacity={HYBRID_MAP_LAYERS.buildings.opacity}
      />

      {/* 6. Transporte (carreteras, avenidas, pasajes) */}
      <TileLayer
        attribution={HYBRID_MAP_LAYERS.transport.attribution}
        url={HYBRID_MAP_LAYERS.transport.url}
        opacity={HYBRID_MAP_LAYERS.transport.opacity}
      />

      {/* 7. Límites administrativos */}
      <TileLayer
        attribution={HYBRID_MAP_LAYERS.boundaries.attribution}
        url={HYBRID_MAP_LAYERS.boundaries.url}
        opacity={HYBRID_MAP_LAYERS.boundaries.opacity}
      />

      {/* 8. Etiquetas de calles */}
      <TileLayer
        attribution={HYBRID_MAP_LAYERS.labelsRoads.attribution}
        url={HYBRID_MAP_LAYERS.labelsRoads.url}
        opacity={HYBRID_MAP_LAYERS.labelsRoads.opacity}
      />

      {/* 9. Etiquetas de lugares (ciudades, pueblos, locales) */}
      <TileLayer
        attribution={HYBRID_MAP_LAYERS.labelsPlaces.attribution}
        url={HYBRID_MAP_LAYERS.labelsPlaces.url}
        opacity={HYBRID_MAP_LAYERS.labelsPlaces.opacity}
      />

      {startPoint && (
        <Marker position={[startPoint.latitude, startPoint.longitude]} icon={startIcon} />
      )}

      {endPoint && (
        <Marker position={[endPoint.latitude, endPoint.longitude]} icon={endIcon} />
      )}

      {trackPoints.map((point, index) => (
        <CircleMarker
          key={index}
          center={[point.latitude, point.longitude]}
          radius={6}
          color="#3b82f6"
          fillColor="#3b82f6"
          fillOpacity={0.5}
        />
      ))}

      {allPoints.length > 1 && (
        <Polyline
          positions={allPoints.map((p) => [p.latitude, p.longitude] as [number, number])}
          color="#f59e0b"
          weight={4}
          opacity={0.8}
        />
      )}
    </MapContainer>
  )
}
