'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import { Icon } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin, TrendingUp, Mountain } from 'lucide-react'
import { SupabaseRouteRepository } from '@/core/infrastructure/repositories/SupabaseRouteRepository'
import { Route } from '@/core/domain/Route'
import { createClient } from '@/core/infrastructure/supabase/client'

// Iconos personalizados para el mapa (estilo oscuro)
const createRouteIcon = (difficulty: string) => {
  const color = difficulty === 'Expert' ? '#ef4444' : 
                difficulty === 'Intermediate' ? '#3b82f6' : '#22c55e'
  
  return new Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="30" height="30">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
      </svg>
    `)}`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
  })
}

// Componente para actualizar el mapa según zoom
function MapZoomHandler({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const map = useMap()
  
  useEffect(() => {
    const handleZoom = () => {
      onZoomChange(map.getZoom())
    }
    
    map.on('zoomend', handleZoom)
    return () => {
      map.off('zoomend', handleZoom)
    }
  }, [map, onZoomChange])
  
  return null
}

interface RouteWithDistance extends Route {
  distance: number
}

// Simplificar puntos según el zoom (Douglas-Peucker simplificado)
const simplifyTrackPoints = (points: Array<{latitude: number; longitude: number}>, zoom: number) => {
  if (zoom < 14) return points.filter((_, i) => i % 10 === 0) // Muy simplificado
  if (zoom < 16) return points.filter((_, i) => i % 5 === 0) // Simplificado
  if (zoom < 18) return points.filter((_, i) => i % 2 === 0) // Moderado
  return points // Completo
}

export default function DashboardMap() {
  const [routes, setRoutes] = useState<RouteWithDistance[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null)
  const [currentZoom, setCurrentZoom] = useState(13)
  const repository = new SupabaseRouteRepository()

  // Centro del mapa (Cusco por defecto)
  const defaultCenter: [number, number] = [-13.5319, -71.9675]

  // Cargar rutas y ubicación del usuario
  useEffect(() => {
    const loadData = async () => {
      try {
        // Obtener ubicación del usuario
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              setUserLocation([
                position.coords.latitude,
                position.coords.longitude
              ])
            },
            () => console.log('No se pudo obtener ubicación')
          )
        }

        // Cargar rutas públicas
        const publicRoutes = await repository.getPublicRoutes(20)
        
        // Calcular distancia desde la ubicación del usuario
        const routesWithDistance = publicRoutes.map(route => ({
          ...route,
          distance: userLocation 
            ? calculateDistance(
                userLocation[0], userLocation[1],
                route.startCoord[0], route.startCoord[1]
              )
            : 0
        })).sort((a, b) => a.distance - b.distance)

        setRoutes(routesWithDistance.slice(0, 10))
      } catch (error) {
        console.error('Error cargando rutas:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [userLocation])

  // Calcular distancia entre dos puntos (Haversine)
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLng = ((lng2 - lng1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4" />
          <p className="text-gray-400">Cargando rutas cercanas...</p>
        </div>
      </div>
    )
  }

  return (
    <MapContainer
      center={userLocation || defaultCenter}
      zoom={userLocation ? 14 : 13}
      className="w-full h-full"
      style={{ minHeight: '500px' }}
    >
      {/* Capa satelital oscura (CartoDB Dark Matter) */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        maxZoom={19}
      />

      {/* Handler para detectar cambios de zoom */}
      <MapZoomHandler onZoomChange={setCurrentZoom} />

      {/* Marcador de ubicación del usuario */}
      {userLocation && (
        <Marker
          position={userLocation}
          icon={new Icon({
            iconUrl: `data:image/svg+xml;base64,${btoa(`
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#3b82f6" width="40" height="40">
                <circle cx="12" cy="12" r="8" stroke="white" stroke-width="2"/>
              </svg>
            `)}`,
            iconSize: [40, 40],
            iconAnchor: [20, 20],
          })}
        >
          <Popup>
            <div className="p-2 bg-slate-800 text-white">
              <strong className="text-blue-400">Tu Ubicación</strong>
            </div>
          </Popup>
        </Marker>
      )}

      {/* Marcadores de rutas */}
      {routes.map((route) => {
        const diffColor = route.difficulty === 'Expert' ? 'text-red-500' :
                         route.difficulty === 'Intermediate' ? 'text-blue-500' : 'text-green-500'
        const diffText = route.difficulty === 'Expert' ? 'Experto' :
                        route.difficulty === 'Intermediate' ? 'Intermedio' : 'Principiante'
        
        return (
          <Marker
            key={route.id}
            position={[route.startCoord[0], route.startCoord[1]]}
            icon={createRouteIcon(route.difficulty)}
          >
            <Popup>
              <div className="p-3 min-w-[250px] bg-slate-800 text-white">
                <h3 className="font-bold text-lg mb-2">{route.name}</h3>
                
                {route.description && (
                  <p className="text-sm text-gray-300 mb-3">{route.description}</p>
                )}
                
                <div className="flex items-center gap-2 mb-3">
                  <Mountain size={16} className={diffColor} />
                  <span className={diffColor + ' text-sm font-medium'}>{diffText}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="flex items-center gap-1 text-gray-300">
                    <TrendingUp size={14} />
                    <span className="text-sm font-medium">{route.distanceKm.toFixed(2)} km</span>
                  </div>
                  {route.elevationGainM && (
                    <div className="flex items-center gap-1 text-gray-300">
                      <Mountain size={14} />
                      <span className="text-sm font-medium">+{route.elevationGainM.toFixed(0)} m</span>
                    </div>
                  )}
                </div>
                
                {userLocation && route.distance > 0 && (
                  <div className="flex items-center gap-1 text-blue-400 mb-3">
                    <MapPin size={14} />
                    <span className="text-sm font-medium">A {route.distance.toFixed(2)} km de ti</span>
                  </div>
                )}
                
                <a
                  href={`/dashboard/routes/${route.id}`}
                  className="mt-3 block w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 text-center text-sm font-medium rounded transition-colors"
                >
                  Ver Detalles
                </a>
              </div>
            </Popup>
          </Marker>
        )
      })}

      {/* Líneas de las rutas (simplificadas según zoom) */}
      {routes.map((route) => {
        if (route.trackPoints.length === 0) return null
        
        // Simplificar puntos según el zoom actual
        const simplifiedPoints = simplifyTrackPoints(
          route.trackPoints.map(p => ({ latitude: p.latitude, longitude: p.longitude })),
          currentZoom
        )
        
        // Solo mostrar si hay suficientes puntos simplificados
        if (simplifiedPoints.length < 2) return null
        
        const lineColor = route.difficulty === 'Expert' ? '#ef4444' : 
                         route.difficulty === 'Intermediate' ? '#3b82f6' : '#22c55e'
        
        return (
          <Polyline
            key={`line-${route.id}`}
            positions={simplifiedPoints.map(p => [p.latitude, p.longitude] as [number, number])}
            color={lineColor}
            weight={currentZoom > 16 ? 4 : 2}
            opacity={currentZoom > 15 ? 0.8 : 0.4}
          />
        )
      })}
    </MapContainer>
  )
}
