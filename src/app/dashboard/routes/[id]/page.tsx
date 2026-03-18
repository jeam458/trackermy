'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/core/infrastructure/supabase/client'
import { SupabaseRouteRepository } from '@/core/infrastructure/repositories/SupabaseRouteRepository'
import { RouteMapViewerDynamic } from '@/components/routes/MapWrapper'
import {
  ArrowLeft,
  Edit2,
  MapPin,
  TrendingUp,
  Mountain,
  Loader2,
  Calendar,
  User,
  Eye,
  EyeOff,
  CheckCircle2,
} from 'lucide-react'
import { Route } from '@/core/domain/Route'

export default function RouteDetailPage() {
  const router = useRouter()
  const params = useParams()
  const routeId = params.id as string

  const [isLoading, setIsLoading] = useState(true)
  const [route, setRoute] = useState<Route | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [calculatedStats, setCalculatedStats] = useState({
    distance: 0,
    elevationGain: 0,
    elevationLoss: 0,
  })

  const repository = new SupabaseRouteRepository()

  // Calcular estadísticas desde los puntos GPS
  const calculateStats = (points: Array<{latitude: number; longitude: number; altitude?: number}>) => {
    if (points.length < 2) {
      setCalculatedStats({ distance: 0, elevationGain: 0, elevationLoss: 0 })
      return
    }

    let distance = 0
    let elevationGain = 0
    let elevationLoss = 0

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]
      const curr = points[i]

      // Distancia (Haversine)
      const R = 6371000
      const dLat = ((curr.latitude - prev.latitude) * Math.PI) / 180
      const dLng = ((curr.longitude - prev.longitude) * Math.PI) / 180
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((prev.latitude * Math.PI) / 180) *
          Math.cos((curr.latitude * Math.PI) / 180) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      distance += R * c

      // Elevación
      if (prev.altitude !== undefined && curr.altitude !== undefined) {
        const diff = curr.altitude - prev.altitude
        if (diff > 0) {
          elevationGain += diff
        } else {
          elevationLoss += Math.abs(diff)
        }
      }
    }

    setCalculatedStats({
      distance: distance / 1000, // km
      elevationGain,
      elevationLoss,
    })
  }

  useEffect(() => {
    const loadRoute = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          router.push('/login')
          return
        }

        const loadedRoute = await repository.getRouteById(routeId)

        if (!loadedRoute) {
          router.push('/dashboard/routes')
          return
        }

        setRoute(loadedRoute)
        setIsOwner(loadedRoute.createdBy === user.id)

        // Calcular estadísticas desde los puntos GPS
        const allPoints = loadedRoute.trackPoints.map(p => ({
          latitude: p.latitude,
          longitude: p.longitude,
          altitude: p.altitude,
        }))
        calculateStats(allPoints)
      } catch (error) {
        console.error('Error cargando ruta:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadRoute()
  }, [routeId])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1c2327] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto text-amber-500 mb-4" size={40} />
          <p className="text-gray-400">Cargando ruta...</p>
        </div>
      </div>
    )
  }

  if (!route) {
    return null
  }

  return (
    <div className="min-h-screen bg-[#1c2327] text-slate-100">
      {/* Header */}
      <header className="bg-slate-900/50 backdrop-blur-sm border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              title="Volver a la página anterior"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">{route.name}</h1>
              <p className="text-sm text-gray-400">
                {route.difficulty} • {route.distanceKm.toFixed(2)} km
              </p>
            </div>
          </div>

          {isOwner && (
            <button
              onClick={() => router.push(`/dashboard/routes/${routeId}/edit`)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-lg transition-colors flex items-center gap-2"
            >
              <Edit2 size={18} />
              Editar Ruta
            </button>
          )}
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Mapa */}
        <div className="bg-slate-900/50 rounded-xl overflow-hidden border border-slate-800">
          <div className="h-[500px]">
            <RouteMapViewerDynamic
              startPoint={{
                latitude: route.startCoord[0],
                longitude: route.startCoord[1],
              }}
              endPoint={{
                latitude: route.endCoord[0],
                longitude: route.endCoord[1],
              }}
              trackPoints={route.trackPoints.slice(1, -1).map(p => ({
                latitude: p.latitude,
                longitude: p.longitude,
                altitude: p.altitude,
              }))}
              zoom={15}
            />
          </div>
        </div>

        {/* Información */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Estadísticas */}
          <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
            <h3 className="font-semibold text-white mb-4">Estadísticas</h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-400">
                  <TrendingUp size={18} />
                  <span>Distancia</span>
                </div>
                <span className="text-xl font-bold text-white">
                  {calculatedStats.distance > 0 
                    ? `${calculatedStats.distance.toFixed(2)} km` 
                    : `${route.distanceKm.toFixed(2)} km`}
                </span>
              </div>

              {(calculatedStats.elevationGain > 0 || route.elevationGainM) && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Mountain size={18} />
                    <span>Elevación +</span>
                  </div>
                  <span className="text-xl font-bold text-green-400">
                    +{calculatedStats.elevationGain > 0 
                      ? calculatedStats.elevationGain.toFixed(0) 
                      : route.elevationGainM?.toFixed(0)} m
                  </span>
                </div>
              )}

              {(calculatedStats.elevationLoss > 0 || route.elevationLossM) && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Mountain size={18} className="rotate-180" />
                    <span>Elevación -</span>
                  </div>
                  <span className="text-xl font-bold text-red-400">
                    -{calculatedStats.elevationLoss > 0 
                      ? calculatedStats.elevationLoss.toFixed(0) 
                      : route.elevationLossM?.toFixed(0)} m
                  </span>
                </div>
              )}
            </div>

            {calculatedStats.distance > 0 && (
              <p className="text-xs text-gray-400 mt-4 flex items-center gap-2">
                <CheckCircle2 size={12} className="text-green-500" />
                Estadísticas calculadas desde {route.trackPoints.length} puntos GPS
              </p>
            )}
          </div>

          {/* Detalles */}
          <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
            <h3 className="font-semibold text-white mb-4">Detalles</h3>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-gray-400">
                <User size={18} />
                <span>Creado por</span>
              </div>
              <p className="text-white">Usuario</p>

              <div className="flex items-center gap-2 text-gray-400">
                <Calendar size={18} />
                <span>Fecha de creación</span>
              </div>
              <p className="text-white">
                {new Date(route.createdAt).toLocaleDateString('es-ES')}
              </p>

              <div className="flex items-center gap-2 text-gray-400">
                {route.isPublic ? <Eye size={18} /> : <EyeOff size={18} />}
                <span>Visibilidad</span>
              </div>
              <p className="text-white">
                {route.isPublic ? 'Pública' : 'Privada'}
              </p>
            </div>
          </div>
        </div>

        {/* Descripción */}
        {route.description && (
          <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
            <h3 className="font-semibold text-white mb-4">Descripción</h3>
            <p className="text-gray-300">{route.description}</p>
          </div>
        )}

        {/* Puntos del track */}
        <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
          <h3 className="font-semibold text-white mb-4">
            Puntos del Track ({route.trackPoints.length})
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {route.trackPoints.slice(0, 9).map((point, index) => (
              <div
                key={index}
                className="bg-slate-800 rounded-lg p-3 text-sm"
              >
                <div className="flex items-center gap-2 mb-1">
                  <MapPin size={14} className="text-amber-500" />
                  <span className="text-gray-400">Punto {index + 1}</span>
                </div>
                <p className="text-white font-mono text-xs">
                  {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
                </p>
                {point.altitude && (
                  <p className="text-gray-400 text-xs">
                    Altitud: {point.altitude.toFixed(0)}m
                  </p>
                )}
              </div>
            ))}
            {route.trackPoints.length > 9 && (
              <div className="bg-slate-800 rounded-lg p-3 text-sm flex items-center justify-center">
                <span className="text-gray-400">
                  +{route.trackPoints.length - 9} puntos más
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
