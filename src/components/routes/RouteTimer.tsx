'use client'

import { useState, useEffect, useLayoutEffect, useRef, useId, useCallback } from 'react'
import { animate } from 'animejs'
import { useRouter } from 'next/navigation'
import { useRouteTimer } from '@/hooks/useRouteTimer'
import { RoutePerformanceService } from '@/services/RoutePerformanceService'
import { createClient } from '@/core/infrastructure/supabase/client'
import { syncManager } from '@/services/SyncManager'
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
import { BrandSpinner } from '@/components/ui/BrandLogoLoader'
import { routeViewUrl } from '@/lib/routeViewNavigation'

const COUNTDOWN_STROKE_LEN = 264

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
    <div
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
        isOnline
          ? 'border-teal-500/35 bg-teal-500/15 text-teal-200'
          : 'border-red-500/30 bg-red-500/10 text-red-300'
      }`}
    >
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
    <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-gdh-card p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-amber-500/15 p-2">
          <Timer className="text-amber-400" size={20} />
        </div>
        <div>
          <p className="text-xs text-zinc-500">Tiempo</p>
          <p className="font-mono text-lg font-bold text-white">{formatTime(elapsedTime)}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-teal-500/15 p-2">
          <Gauge className="text-teal-400" size={20} />
        </div>
        <div>
          <p className="text-xs text-zinc-500">Vel. Actual</p>
          <p className="text-lg font-bold text-white">{formatSpeed(currentSpeed)}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-sky-500/15 p-2">
          <TrendingUp className="text-sky-400" size={20} />
        </div>
        <div>
          <p className="text-xs text-zinc-500">Vel. Máx</p>
          <p className="text-lg font-bold text-white">{formatSpeed(maxSpeed)}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-violet-500/15 p-2">
          <Activity className="text-violet-400" size={20} />
        </div>
        <div>
          <p className="text-xs text-zinc-500">Vel. Prom</p>
          <p className="text-lg font-bold text-white">{formatSpeed(avgSpeed)}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-teal-500/10 p-2">
          <MapPin className="text-teal-300" size={20} />
        </div>
        <div>
          <p className="text-xs text-zinc-500">Distancia</p>
          <p className="text-lg font-bold text-white">{formatDistance(distance)}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-orange-500/15 p-2">
          <Mountain className="text-orange-400" size={20} />
        </div>
        <div>
          <p className="text-xs text-zinc-500">Altitud</p>
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
      <div className="rounded-2xl border border-amber-500/35 bg-gradient-to-br from-amber-500/15 to-orange-500/10 p-6">
        <div className="text-center">
          <Trophy className="text-amber-500 mx-auto mb-2" size={40} />
          <p className="text-sm text-gray-400 mb-1">Score General</p>
          <p className="text-5xl font-bold text-amber-500">{performance.overallScore}</p>
          <p className="text-xs text-gray-400 mt-2">de 100 puntos</p>
        </div>
      </div>

      {/* Tiempo final */}
      <div className="rounded-2xl border border-white/10 bg-gdh-card p-4">
        <div className="mb-3 flex items-center justify-between">
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
      <div className="rounded-2xl border border-white/10 bg-gdh-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-white">Velocidades</h3>
          <Gauge className="text-teal-400" size={18} />
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
            <p className="text-lg font-bold text-teal-300">
              {RoutePerformanceService.formatSpeed(performance.maxSpeed)}
            </p>
          </div>
        </div>
      </div>

      {/* Eventos detectados */}
      <div className="rounded-2xl border border-white/10 bg-gdh-card p-4">
        <div className="mb-3 flex items-center justify-between">
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
          <div className="rounded-lg bg-teal-500/10 p-3">
            <p className="text-xs text-teal-300">Paradas</p>
            <p className="text-2xl font-bold text-white">{performance.stops.length}</p>
          </div>
        </div>
      </div>

      {/* Scores detallados */}
      <div className="rounded-2xl border border-white/10 bg-gdh-card p-4">
        <h3 className="mb-3 font-semibold text-white">Scores de Rendimiento</h3>
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-400">Ritmo</span>
              <span className="text-sm font-bold text-white">{performance.rhythmScore}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full bg-sky-500 transition-all"
                style={{ width: `${performance.rhythmScore}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-400">Intensidad</span>
              <span className="text-sm font-bold text-white">{performance.intensityScore}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full bg-teal-500 transition-all"
                style={{ width: `${performance.intensityScore}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-400">Agresividad</span>
              <span className="text-sm font-bold text-white">{performance.aggressionScore}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
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
  const countdownGradientId = useId().replace(/:/g, '')
  const [userId, setUserId] = useState<string | null>(null)
  const [performance, setPerformance] = useState<any>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [armCountdown, setArmCountdown] = useState<number | null>(null)
  const countdownRingRef = useRef<SVGCircleElement | null>(null)
  const countdownLabelRef = useRef<HTMLSpanElement | null>(null)
  const prevArmForRingAnim = useRef<number | null>(null)

  const { state, actions } = useRouteTimer(routeId, userId || undefined)
  const startTimerRef = useRef(actions.startTimer)
  startTimerRef.current = actions.startTimer

  useEffect(() => {
    const loadUser = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
    }
    void loadUser()
  }, [])

  useEffect(() => {
    if (armCountdown === null) return
    if (armCountdown <= 1) {
      const id = window.setTimeout(() => {
        startTimerRef.current()
        setArmCountdown(null)
      }, 900)
      return () => window.clearTimeout(id)
    }
    const id = window.setTimeout(() => setArmCountdown(armCountdown - 1), 900)
    return () => window.clearTimeout(id)
  }, [armCountdown])

  useLayoutEffect(() => {
    if (armCountdown === null) {
      prevArmForRingAnim.current = null
      return
    }
    const targetOff = COUNTDOWN_STROKE_LEN * (1 - armCountdown / 3)
    const fromOff =
      prevArmForRingAnim.current == null
        ? COUNTDOWN_STROKE_LEN
        : COUNTDOWN_STROKE_LEN * (1 - prevArmForRingAnim.current / 3)
    prevArmForRingAnim.current = armCountdown
    const ring = countdownRingRef.current
    if (ring) {
      ring.setAttribute('stroke-dashoffset', String(fromOff))
      void animate(ring, {
        strokeDashoffset: [fromOff, targetOff],
        duration: 420,
        ease: 'outCubic',
      })
    }
    const label = countdownLabelRef.current
    if (label) {
      void animate(label, { scale: [1.2, 1], opacity: [0.35, 1], duration: 280, ease: 'outCubic' })
    }
  }, [armCountdown])

  const beginCountdown = useCallback(() => {
    setArmCountdown(3)
  }, [])

  // Finalizar timer
  const handleFinish = async () => {
    const result = await actions.finishTimer()
    if (result) {
      setPerformance(result)
    }
  }

  // Guardar intento (Supabase) o ya quedó en IndexedDB si terminaste sin red
  const handleSave = async () => {
    if (!userId || !performance) return

    if (state.offlineAttemptQueued) {
      onComplete?.()
      router.push(routeViewUrl(routeId, 'record'))
      return
    }

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
        gps_points: state.gpsPoints.map((p) => ({
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
      router.push(routeViewUrl(routeId, 'record'))
    } catch (error) {
      console.error('Error guardando intento:', error)
      try {
        syncManager.init()
        await syncManager.queueRouteAttemptOffline({
          userId,
          routeId,
          routeName,
          performance,
          gpsPoints: state.gpsPoints,
        })
        alert(
          'Sin conexión o error al subir. Tu tiempo quedó guardado en este dispositivo y se enviará solo cuando haya Internet.'
        )
        onComplete?.()
        router.push(routeViewUrl(routeId, 'record'))
      } catch (e2) {
        console.error(e2)
        alert(
          e2 instanceof Error
            ? e2.message
            : 'No se pudo guardar el intento ni localmente. Comprueba espacio y permisos del navegador.'
        )
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-gdh-canvas-2 text-slate-100">
      {armCountdown !== null && (
        <div className="pointer-events-auto fixed inset-0 z-[10050]">
          <div className="absolute inset-0 bg-black/45" />
          <div className="absolute inset-x-0 top-0 flex h-[58vh] flex-col items-center justify-center border-b border-white/10 bg-gradient-to-b from-[#131a22]/95 to-[#131a22]/90 px-6 backdrop-blur-sm">
            <p className="mb-5 text-center text-2xl font-black tracking-tight text-white">
              ¡Prepárate para la ruta!
            </p>
            <p className="mb-8 max-w-md text-center text-sm leading-relaxed text-slate-300">
              El cronómetro arrancará al terminar la cuenta atrás…
            </p>
            <div className="relative h-52 w-52">
              <svg className="-rotate-90 h-full w-full" viewBox="0 0 100 100" aria-hidden>
                <circle cx="50" cy="50" r="42" stroke="#334155" strokeWidth="5.5" fill="none" />
                <circle
                  ref={countdownRingRef}
                  cx="50"
                  cy="50"
                  r="42"
                  stroke={`url(#${countdownGradientId})`}
                  strokeWidth="5.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={COUNTDOWN_STROKE_LEN}
                  strokeDashoffset={COUNTDOWN_STROKE_LEN}
                />
                <defs>
                  <linearGradient id={countdownGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#2dd4bf" />
                    <stop offset="100%" stopColor="#5eead4" />
                  </linearGradient>
                </defs>
              </svg>
              <span
                ref={countdownLabelRef}
                className="absolute inset-0 z-10 flex items-center justify-center text-7xl font-black tabular-nums text-white [transform-origin:center] [text-shadow:0_1px_0_rgba(0,0,0,0.35)]"
              >
                {armCountdown}
              </span>
            </div>
            <p className="mt-8 text-center text-sm text-slate-300">
              Sincronizando GPS para el cronómetro de ruta…
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-gdh-canvas-2/95 backdrop-blur-sm">
        <div className="px-4 py-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="rounded-lg p-2 transition-colors hover:bg-white/10"
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

      {/* Contenido: padding inferior para no solaparse con la bottom nav del dashboard */}
      <main className="mx-auto max-w-lg space-y-4 p-4 pb-28">
        {/* Errores */}
        {state.error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 p-3">
            <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
            <p className="text-sm text-red-400">{state.error}</p>
          </div>
        )}

        {/* Notificación offline */}
        {!state.isOnline && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
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
        {!state.isRunning && !state.isFinished && armCountdown === null && (
          <div className="space-y-6 py-10 text-center">
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-teal-500/15 ring-1 ring-teal-500/30">
              <Timer className="text-teal-400" size={40} />
            </div>
            <div>
              <h2 className="mb-2 text-2xl font-bold text-white">¿Listo para el reto?</h2>
              <p className="text-sm leading-relaxed text-zinc-400">
                Inicia el cronómetro y recorre la ruta lo más rápido posible
              </p>
            </div>
            <button
              type="button"
              onClick={beginCountdown}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-teal-400/35 bg-teal-600 py-4 text-lg font-bold text-white shadow-lg shadow-teal-950/30 transition-colors hover:bg-teal-500 active:bg-teal-700"
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
            <div
              className={`rounded-2xl border-2 p-4 ${
                state.isPaused
                  ? 'border-amber-500/40 bg-amber-500/10'
                  : 'border-teal-500/40 bg-teal-500/10'
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`h-3 w-3 animate-pulse rounded-full ${
                    state.isPaused ? 'bg-amber-400' : 'bg-teal-400'
                  }`}
                />
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
                  type="button"
                  onClick={actions.pauseTimer}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-amber-500 py-3.5 font-semibold text-slate-950 shadow-md shadow-amber-950/20 transition-colors hover:bg-amber-400"
                >
                  <Pause size={20} />
                  Pausar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={actions.resumeTimer}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-teal-400/40 bg-teal-600 py-3.5 font-semibold text-white transition-colors hover:bg-teal-500"
                >
                  <Play size={20} />
                  Reanudar
                </button>
              )}

              <button
                type="button"
                onClick={handleFinish}
                className="flex items-center justify-center gap-2 rounded-2xl bg-red-600 py-3.5 font-semibold text-white shadow-md shadow-red-950/25 transition-colors hover:bg-red-500"
              >
                <Square size={20} />
                Finalizar
              </button>
            </div>

            <button
              type="button"
              onClick={actions.cancelTimer}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-gdh-card py-3.5 font-semibold text-white transition-colors hover:bg-white/5"
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
              <CheckCircle2 className="mx-auto mb-2 text-teal-400" size={40} />
              <h2 className="text-2xl font-bold text-white">¡Ruta Completada!</h2>
            </div>

            {state.offlineAttemptQueued && (
              <div className="p-4 bg-teal-500/15 border border-teal-500/35 rounded-lg text-sm text-teal-100/95">
                <p className="font-semibold text-teal-200 mb-1">Guardado en el dispositivo</p>
                <p className="text-teal-100/80">
                  Sin conexión al finalizar: tu recorrido y métricas están en almacenamiento local. Se subirán a tu cuenta
                  automáticamente cuando vuelva Internet (no hace falta repetir la bajada).
                </p>
              </div>
            )}

            <ResultsPanel performance={performance} routeName={routeName} />

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-4 font-bold text-slate-950 shadow-md shadow-amber-950/20 transition-colors hover:bg-amber-400 disabled:bg-zinc-700 disabled:text-zinc-400"
            >
              {isSaving ? (
                <>
                  <BrandSpinner size={20} />
                  Guardando...
                </>
              ) : state.offlineAttemptQueued ? (
                <>
                  <Navigation size={20} />
                  Volver a la ruta
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
