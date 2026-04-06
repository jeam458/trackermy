'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/core/infrastructure/supabase/client'
import { RouteTimer } from '@/components/routes/RouteTimer'
import {
  Trophy,
  Clock,
  Users,
  TrendingUp,
  Gauge,
  Mountain,
  Play,
  BarChart3,
  AlertTriangle,
  Loader2,
} from 'lucide-react'

interface RouteStatistics {
  total_attempts: number
  unique_riders: number
  best_time: number | null
  avg_time: number | null
  best_score: number | null
  avg_score: number | null
  max_recorded_speed: number | null
  avg_jumps: number | null
  avg_stops: number | null
}

interface RouteData {
  id: string
  name: string
  description: string | null
  distance_km: number
  elevation_gain_m: number | null
  difficulty: string
  is_public: boolean
}

export default function RouteDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [routeId, setRouteId] = useState<string | null>(null)
  const [route, setRoute] = useState<RouteData | null>(null)
  const [statistics, setStatistics] = useState<RouteStatistics | null>(null)
  const [bestTime, setBestTime] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showTimer, setShowTimer] = useState(false)

  // Obtener routeId de params
  useEffect(() => {
    params.then(p => setRouteId(p.id))
  }, [params])

  // Cargar datos de la ruta
  useEffect(() => {
    if (!routeId) return

    const loadRouteData = async () => {
      try {
        const supabase = createClient()

        // Cargar ruta
        const { data: routeData, error: routeError } = await supabase
          .from('routes')
          .select('*')
          .eq('id', routeId)
          .single()

        if (routeError) throw routeError
        setRoute(routeData)

        // Cargar estadísticas
        const { data: statsData } = await supabase
          .rpc('get_route_statistics', { p_route_id: routeId })

        if (statsData && statsData.length > 0) {
          setStatistics(statsData[0])
        }

        // Cargar mejor tiempo
        const { data: bestTimeData } = await supabase
          .from('route_attempts')
          .select('*')
          .eq('route_id', routeId)
          .eq('is_public', true)
          .order('total_time', { ascending: true })
          .limit(1)
          .single()

        if (bestTimeData) {
          setBestTime(bestTimeData)
        }
      } catch (err) {
        console.error('Error cargando ruta:', err)
        setError('No se pudo cargar la ruta')
      } finally {
        setLoading(false)
      }
    }

    loadRouteData()
  }, [routeId])

  // Formatear tiempo
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 100)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
  }

  // Formatear velocidad
  const formatSpeed = (ms: number): string => {
    const kmh = ms * 3.6
    return `${kmh.toFixed(1)} km/h`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1c2327] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto text-amber-500 mb-4" size={40} />
          <p className="text-gray-400">Cargando ruta...</p>
        </div>
      </div>
    )
  }

  if (error || !route) {
    return (
      <div className="min-h-screen bg-[#1c2327] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto text-red-500 mb-4" size={40} />
          <p className="text-gray-400 mb-4">{error || 'Ruta no encontrada'}</p>
          <button
            onClick={() => router.back()}
            className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-lg"
          >
            Volver
          </button>
        </div>
      </div>
    )
  }

  // Mostrar timer
  if (showTimer) {
    return (
      <RouteTimer
        routeId={route.id}
        routeName={route.name}
        onComplete={() => setShowTimer(false)}
      />
    )
  }

  return (
    <div className="min-h-screen bg-[#1c2327] text-slate-100">
      {/* Header */}
      <header className="bg-slate-900/50 backdrop-blur-sm border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <button
            onClick={() => router.back()}
            className="text-gray-400 hover:text-white mb-4 flex items-center gap-2"
          >
            ← Volver
          </button>
          <h1 className="text-3xl font-bold text-white mb-2">{route.name}</h1>
          <p className="text-gray-400">{route.description || 'Sin descripción'}</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Info de ruta */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-800/50 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="text-amber-500" size={18} />
              <span className="text-xs text-gray-400">Distancia</span>
            </div>
            <p className="text-xl font-bold text-white">{route.distance_km.toFixed(2)} km</p>
          </div>

          <div className="p-4 bg-slate-800/50 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Mountain className="text-green-500" size={18} />
              <span className="text-xs text-gray-400">Elevación</span>
            </div>
            <p className="text-xl font-bold text-white">
              {route.elevation_gain_m ? `+${route.elevation_gain_m.toFixed(0)} m` : 'N/A'}
            </p>
          </div>

          <div className="p-4 bg-slate-800/50 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Gauge className="text-blue-500" size={18} />
              <span className="text-xs text-gray-400">Dificultad</span>
            </div>
            <p className="text-xl font-bold text-white">{route.difficulty}</p>
          </div>

          {statistics && (
            <div className="p-4 bg-slate-800/50 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Users className="text-purple-500" size={18} />
                <span className="text-xs text-gray-400">Riders</span>
              </div>
              <p className="text-xl font-bold text-white">{statistics.unique_riders}</p>
            </div>
          )}
        </div>

        {/* Botón iniciar intento */}
        <button
          onClick={() => setShowTimer(true)}
          className="w-full py-6 bg-green-500 hover:bg-green-400 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-3 text-xl"
        >
          <Play size={28} />
          Iniciar Recorrido
        </button>

        {/* Mejor tiempo */}
        {bestTime && (
          <div className="p-6 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-xl border-2 border-amber-500/30">
            <div className="flex items-center gap-3 mb-4">
              <Trophy className="text-amber-500" size={32} />
              <div>
                <h3 className="text-sm text-gray-400">Mejor Tiempo</h3>
                <p className="text-3xl font-bold text-amber-500 font-mono">
                  {formatTime(bestTime.total_time)}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-400">Velocidad máxima</p>
                <p className="font-semibold text-white">{formatSpeed(bestTime.max_speed)}</p>
              </div>
              <div>
                <p className="text-gray-400">Score</p>
                <p className="font-semibold text-white">{bestTime.overall_score}/100</p>
              </div>
            </div>
          </div>
        )}

        {/* Estadísticas */}
        {statistics && (
          <div className="p-6 bg-slate-800/50 rounded-xl space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="text-blue-500" size={24} />
              <h3 className="text-xl font-bold text-white">Estadísticas de la Ruta</h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-700/50 rounded-lg">
                <p className="text-xs text-gray-400 mb-1">Total de intentos</p>
                <p className="text-2xl font-bold text-white">{statistics.total_attempts}</p>
              </div>

              <div className="p-4 bg-slate-700/50 rounded-lg">
                <p className="text-xs text-gray-400 mb-1">Tiempo promedio</p>
                <p className="text-2xl font-bold text-white">
                  {statistics.avg_time ? formatTime(statistics.avg_time) : 'N/A'}
                </p>
              </div>

              <div className="p-4 bg-slate-700/50 rounded-lg">
                <p className="text-xs text-gray-400 mb-1">Score promedio</p>
                <p className="text-2xl font-bold text-white">
                  {statistics.avg_score ? statistics.avg_score.toFixed(0) : 'N/A'}
                </p>
              </div>

              <div className="p-4 bg-slate-700/50 rounded-lg">
                <p className="text-xs text-gray-400 mb-1">Vel. máxima registrada</p>
                <p className="text-2xl font-bold text-green-400">
                  {statistics.max_recorded_speed ? formatSpeed(statistics.max_recorded_speed) : 'N/A'}
                </p>
              </div>

              <div className="p-4 bg-slate-700/50 rounded-lg">
                <p className="text-xs text-gray-400 mb-1">Saltos promedio</p>
                <p className="text-2xl font-bold text-white">
                  {statistics.avg_jumps ? statistics.avg_jumps.toFixed(1) : '0'}
                </p>
              </div>

              <div className="p-4 bg-slate-700/50 rounded-lg">
                <p className="text-xs text-gray-400 mb-1">Paradas promedio</p>
                <p className="text-2xl font-bold text-white">
                  {statistics.avg_stops ? statistics.avg_stops.toFixed(1) : '0'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Link a ranking */}
        <button
          onClick={() => router.push(`/dashboard/routes/${routeId}/ranking`)}
          className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <Trophy size={20} className="text-amber-500" />
          Ver Ranking Completo
        </button>
      </main>
    </div>
  )
}
