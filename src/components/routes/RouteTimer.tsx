'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useRouteTimer } from '@/hooks/useRouteTimer'
import { RoutePerformanceService } from '@/services/RoutePerformanceService'
import { createClient } from '@/core/infrastructure/supabase/client'
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Timer,
  Gauge,
  TrendingUp,
  Mountain,
  MapPin,
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle2,
  Trophy,
  Zap,
  Activity,
  Navigation,
} from 'lucide-react'

// Formatear tiempo
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 100)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
}

// Formatear velocidad
function formatSpeed(ms: number): string {
  const kmh = ms * 3.6
  return `${kmh.toFixed(1)} km/h`
}

// Formatear distancia
function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters.toFixed(0)} m`
  return `${(meters / 1000).toFixed(2)} km`
}

// Indicador de conexión
function ConnectionIndicator({ isOnline }: { isOnline: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
      isOnline ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
    }`}>
      {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
      <span>{isOnline ? 'Online' : 'Offline'}</span>
    </div>
  )
}

// Panel de métricas en tiempo real
function LiveMetricsPanel({
  elapsedTime,
  currentSpeed,
  maxSpeed,
  avgSpeed,
  distance,
  altitude,
}: {
  elapsedTime: number
  currentSpeed: number
  maxSpeed: number
  avgSpeed: number
  distance: number
  altitude: number | null
}) {
  return (
    <div className="grid grid-cols-2 gap-3 p-4 bg-slate-800/50 rounded-xl">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-amber-500/20 rounded-lg">
          <Timer className="text-amber-500" size={20} />
        </div>
        <div>
          <p className="text-xs text-gray-400">Tiempo</p>
          <p className="text-lg font-bold text-white font-mono">{formatTime(elapsedTime)}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="p-2 bg-green-500/20 rounded-lg">
          <Gauge className="text-green-500" size={20} />
        </div>
        <div>
          <p className="text-xs text-gray-400">Vel. Actual</p>
          <p className="text-lg font-bold text-white">{formatSpeed(currentSpeed)}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-500/20 rounded-lg">
          <TrendingUp className="text-blue-500" size={20} />
        </div>
        <div>
          <p className="text-xs text-gray-400">Vel. Máx</p>
          <p className="text-lg font-bold text-white">{formatSpeed(maxSpeed)}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="p-2 bg-purple-500/20 rounded-lg">
          <Activity className="text-purple-500" size={20} />
        </div>
        <div>
          <p className="text-xs text-gray-400">Vel. Prom</p>
          <p className="text-lg font-bold text-white">{formatSpeed(avgSpeed)}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="p-2 bg-cyan-500/20 rounded-lg">
          <MapPin className="text-cyan-500" size={20} />
        </div>
        <div>
          <p className="text-xs text-gray-400">Distancia</p>
          <p className="text-lg font-bold text-white">{formatDistance(distance)}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="p-2 bg-orange-500/20 rounded-lg">
          <Mountain className="text-orange-500" size={20} />
        </div>
        <div>
          <p className="text-xs text-gray-400">Altitud</p>
          <p className="text-lg font-bold text-white">
            {altitude !== null ? `${altitude.toFixed(0)} m` : 'N/A'}
          </p>
        </div>
      </div>
    </div>
  )
}

// Panel de resultados
function ResultsPanel({
  performance,
  routeName,
}: {
  performance: any
  routeName: string
}) {
  return (
    <div className="space-y-4">
      {/* Score general */}
      <div className="p-6 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-xl border-2 border-amber-500/30">
        <div className="text-center">
          <Trophy className="text-amber-500 mx-auto mb-2" size={40} />
          <p className="text-sm text-gray-400 mb-1">Score General</p>
          <p className="text-5xl font-bold text-amber-500">{performance.overallScore}</p>
          <p className="text-xs text-gray-400 mt-2">de 100 puntos</p>
        </div>
      </div>

      {/* Tiempo final */}
      <div className="p-4 bg-slate-800/50 rounded-xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-white">Tiempo Final</h3>
          <Timer className="text-amber-500" size={18} />
        </div>
        <p className="text-3xl font-bold text-white font-mono">
          {RoutePerformanceService.formatTime(performance.totalTime)}
        </p>
        <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
          <div>
            <p className="text-gray-400">Tiempo en movimiento</p>
            <p className="font-semibold text-white">
              {RoutePerformanceService.formatTime(performance.movingTime)}
            </p>
          </div>
          <div>
            <p className="text-gray-400">Tiempo detenido</p>
            <p className="font-semibold text-white">
              {RoutePerformanceService.formatTime(performance.stoppedTime)}
            </p>
          </div>
        </div>
      </div>

      {/* Velocidades */}
      <div className="p-4 bg-slate-800/50 rounded-xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-white">Velocidades</h3>
          <Gauge className="text-green-500" size={18} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-xs text-gray-400">Mín</p>
            <p className="text-lg font-bold text-white">
              {RoutePerformanceService.formatSpeed(performance.minSpeed)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400">Prom</p>
            <p className="text-lg font-bold text-white">
              {RoutePerformanceService.formatSpeed(performance.avgSpeed)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400">Máx</p>
            <p className="text-lg font-bold text-green-400">
              {RoutePerformanceService.formatSpeed(performance.maxSpeed)}
            </p>
          </div>
        </div>
      </div>

      {/* Eventos detectados */}
      <div className="p-4 bg-slate-800/50 rounded-xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-white">Eventos</h3>
          <Zap className="text-yellow-500" size={18} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-blue-500/10 rounded-lg">
            <p className="text-xs text-blue-400">Saltos</p>
            <p className="text-2xl font-bold text-white">{performance.jumps.length}</p>
          </div>
          <div className="p-3 bg-red-500/10 rounded-lg">
            <p className="text-xs text-red-400">Frenadas</p>
            <p className="text-2xl font-bold text-white">{performance.hardBrakes.length}</p>
          </div>
          <div className="p-3 bg-orange-500/10 rounded-lg">
            <p className="text-xs text-orange-400">Giros bruscos</p>
            <p className="text-2xl font-bold text-white">{performance.sharpMovements.length}</p>
          </div>
          <div className="p-3 bg-green-500/10 rounded-lg">
            <p className="text-xs text-green-400">Paradas</p>
            <p className="text-2xl font-bold text-white">{performance.stops.length}</p>
          </div>
        </div>
      </div>

      {/* Scores detallados */}
      <div className="p-4 bg-slate-800/50 rounded-xl">
        <h3 className="font-semibold text-white mb-3">Scores de Rendimiento</h3>
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-400">Ritmo</span>
              <span className="text-sm font-bold text-white">{performance.rhythmScore}%</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${performance.rhythmScore}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-400">Intensidad</span>
              <span className="text-sm font-bold text-white">{performance.intensityScore}%</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${performance.intensityScore}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-400">Agresividad</span>
              <span className="text-sm font-bold text-white">{performance.aggressionScore}%</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-500 transition-all"
                style={{ width: `${performance.aggressionScore}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface RouteTimerProps {
  routeId: string
  routeName: string
  onComplete?: () => void
}

export function RouteTimer({ routeId, routeName, onComplete }: RouteTimerProps) {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [performance, setPerformance] = useState<any>(null)
  const [isSaving, setIsSaving] = useState(false)

  const { state, actions } = useRouteTimer(routeId, userId || undefined)

  // Cargar usuario
  useState(() => {
    const loadUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
    }
    loadUser()
  })

  // Finalizar timer
  const handleFinish = async () => {
    const result = await actions.finishTimer()
    if (result) {
      setPerformance(result)
    }
  }

  // Guardar intento
  const handleSave = async () => {
    if (!userId || !performance) return

    setIsSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('route_attempts').insert({
        route_id: routeId,
        user_id: userId,
        total_time: performance.totalTime,
        moving_time: performance.movingTime,
        stopped_time: performance.stoppedTime,
        max_speed: performance.maxSpeed,
        avg_speed: performance.avgSpeed,
        distance: performance.totalDistance,
        elevation_gain: performance.elevationGain,
        elevation_loss: performance.elevationLoss,
        jumps_count: performance.jumps.length,
        sharp_movements_count: performance.sharpMovements.length,
        hard_brakes_count: performance.hardBrakes.length,
        stops_count: performance.stops.length,
        rhythm_score: performance.rhythmScore,
        intensity_score: performance.intensityScore,
        aggression_score: performance.aggressionScore,
        overall_score: performance.overallScore,
        gps_points: state.gpsPoints.map(p => ({
          latitude: p.latitude,
          longitude: p.longitude,
          altitude: p.altitude,
          speed: p.speed,
          timestamp: p.timestamp.toISOString(),
        })),
        is_public: true,
        completed_at: new Date().toISOString(),
      })

      if (error) throw error

      onComplete?.()
      router.push(`/dashboard/routes/${routeId}`)
    } catch (error) {
      console.error('Error guardando intento:', error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#1c2327] text-slate-100">
      {/* Header */}
      <header className="bg-slate-900/50 backdrop-blur-sm border-b border-slate-800 sticky top-0 z-50">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <Navigation size={20} />
              </button>
              <div>
                <h1 className="text-lg font-bold text-white">{routeName}</h1>
                <p className="text-xs text-gray-400">Cronómetro de Ruta</p>
              </div>
            </div>
            <ConnectionIndicator isOnline={state.isOnline} />
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="p-4 max-w-lg mx-auto space-y-4">
        {/* Errores */}
        {state.error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
            <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
            <p className="text-sm text-red-400">{state.error}</p>
          </div>
        )}

        {/* Notificación offline */}
        {!state.isOnline && (
          <div className="p-4 bg-amber-500/10 border-2 border-amber-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <WifiOff className="text-amber-500 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <h4 className="font-semibold text-amber-400 mb-1">Modo Offline</h4>
                <p className="text-sm text-amber-300/80">
                  Tu intento se guardará localmente y se sincronizará cuando haya conexión.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Estado: No iniciado */}
        {!state.isRunning && !state.isFinished && (
          <div className="text-center py-12 space-y-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-amber-500/20 rounded-full">
              <Timer className="text-amber-500" size={40} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">¿Listo para el reto?</h2>
              <p className="text-gray-400">
                Inicia el cronómetro y recorre la ruta lo más rápido posible
              </p>
            </div>
            <button
              onClick={actions.startTimer}
              className="w-full py-4 bg-green-500 hover:bg-green-400 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 text-lg"
            >
              <Play size={24} />
              Iniciar Cronómetro
            </button>
          </div>
        )}

        {/* Estado: En progreso */}
        {state.isRunning && !state.isFinished && (
          <div className="space-y-4">
            {/* Indicador de estado */}
            <div className={`p-4 rounded-lg border-2 ${
              state.isPaused
                ? 'bg-yellow-500/10 border-yellow-500/30'
                : 'bg-green-500/10 border-green-500/30'
            }`}>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full animate-pulse ${
                  state.isPaused ? 'bg-yellow-500' : 'bg-green-500'
                }`} />
                <span className="font-semibold text-white">
                  {state.isPaused ? 'PAUSADO' : 'EN PROGRESO'}
                </span>
              </div>
            </div>

            {/* Métricas */}
            <LiveMetricsPanel
              elapsedTime={state.elapsedTime}
              currentSpeed={state.currentSpeed}
              maxSpeed={state.maxSpeed}
              avgSpeed={state.avgSpeed}
              distance={state.distance}
              altitude={state.altitude}
            />

            {/* Controles */}
            <div className="grid grid-cols-2 gap-3">
              {!state.isPaused ? (
                <button
                  onClick={actions.pauseTimer}
                  className="py-3 bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-semibold rounded-lg flex items-center justify-center gap-2"
                >
                  <Pause size={20} />
                  Pausar
                </button>
              ) : (
                <button
                  onClick={actions.resumeTimer}
                  className="py-3 bg-green-500 hover:bg-green-400 text-white font-semibold rounded-lg flex items-center justify-center gap-2"
                >
                  <Play size={20} />
                  Reanudar
                </button>
              )}

              <button
                onClick={handleFinish}
                className="py-3 bg-red-500 hover:bg-red-400 text-white font-semibold rounded-lg flex items-center justify-center gap-2"
              >
                <Square size={20} />
                Finalizar
              </button>
            </div>

            <button
              onClick={actions.cancelTimer}
              className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg flex items-center justify-center gap-2"
            >
              <RotateCcw size={20} />
              Cancelar
            </button>
          </div>
        )}

        {/* Estado: Finalizado */}
        {state.isFinished && performance && (
          <div className="space-y-4">
            <div className="text-center">
              <CheckCircle2 className="text-green-500 mx-auto mb-2" size={40} />
              <h2 className="text-2xl font-bold text-white">¡Ruta Completada!</h2>
            </div>

            <ResultsPanel performance={performance} routeName={routeName} />

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full py-4 bg-amber-500 hover:bg-amber-400 disabled:bg-gray-600 text-slate-900 font-bold rounded-xl flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin h-5 w-5 border-2 border-slate-900 border-t-transparent rounded-full" />
                  Guardando...
                </>
              ) : (
                <>
                  <Trophy size={20} />
                  Guardar y Ver Ranking
                </>
              )}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
