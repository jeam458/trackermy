'use client'

import { useState, useEffect } from 'react'
import { useMobileGPSTracker, GPSTrackPoint } from '@/hooks/useMobileGPSTracker'
import { MapPoint } from '@/components/routes/RouteMapEditor'
import {
  MapPin,
  Navigation,
  Play,
  Pause,
  Square,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Gauge,
  Route,
  RotateCcw,
  Save,
  Target,
  Flag,
  Wifi,
  WifiOff,
  RefreshCw,
  Database,
} from 'lucide-react'

// Formatear segundos a MM:SS
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// Formatear metros a km
function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters.toFixed(0)} m`
  }
  return `${(meters / 1000).toFixed(2)} km`
}

// Formatear m/s a km/h
function formatSpeed(ms: number): string {
  const kmh = ms * 3.6
  return `${kmh.toFixed(1)} km/h`
}

// Indicador de precisión GPS
function GPSAccuracyIndicator({ accuracy }: { accuracy: number | null }) {
  if (accuracy === null) return null

  let color = 'text-green-500'
  let label = 'Excelente'
  
  if (accuracy > 20) {
    color = 'text-red-500'
    label = 'Pobre'
  } else if (accuracy > 10) {
    color = 'text-yellow-500'
    label = 'Regular'
  } else if (accuracy > 5) {
    color = 'text-blue-500'
    label = 'Buena'
  }

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${color.replace('text-', 'bg-')} animate-pulse`} />
      <span className="text-xs text-gray-400">
        ±{accuracy.toFixed(0)}m ({label})
      </span>
    </div>
  )
}

// Indicador de estado de conexión
function ConnectionStatusIndicator({
  isOnline,
  syncStatus,
  pendingSync,
  onSync,
}: {
  isOnline: boolean
  syncStatus: string
  pendingSync: boolean
  onSync?: () => void
}) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
      isOnline
        ? 'bg-green-500/10 text-green-400'
        : 'bg-red-500/10 text-red-400'
    }`}>
      {isOnline ? (
        <Wifi size={14} className="text-green-400" />
      ) : (
        <WifiOff size={14} className="text-red-400" />
      )}
      
      <span className="font-medium">
        {isOnline ? 'Online' : 'Offline'}
      </span>

      {!isOnline && (
        <span className="text-gray-400">
          • Datos guardados localmente
        </span>
      )}

      {isOnline && pendingSync && (
        <>
          <span className="text-gray-400">•</span>
          <Database size={12} className="text-amber-400" />
          <span className="text-amber-400">Pendiente de sincronización</span>
          {onSync && (
            <button
              onClick={onSync}
              disabled={syncStatus === 'syncing'}
              className="ml-2 p-1 hover:bg-white/10 rounded transition-colors"
              title="Sincronizar ahora"
            >
              <RefreshCw
                size={12}
                className={syncStatus === 'syncing' ? 'animate-spin' : ''}
              />
            </button>
          )}
        </>
      )}

      {isOnline && syncStatus === 'syncing' && (
        <>
          <span className="text-gray-400">•</span>
          <Loader2 size={12} className="animate-spin text-blue-400" />
          <span className="text-blue-400">Sincronizando...</span>
        </>
      )}

      {isOnline && syncStatus === 'success' && (
        <>
          <span className="text-gray-400">•</span>
          <CheckCircle2 size={12} className="text-green-400" />
          <span className="text-green-400">Sincronizado</span>
        </>
      )}
    </div>
  )
}

// Panel de métricas en tiempo real
function MetricsPanel({
  distance,
  time,
  currentSpeed,
  averageSpeed,
  maxSpeed,
  pointsCount,
}: {
  distance: number
  time: number
  currentSpeed: number
  averageSpeed: number
  maxSpeed: number
  pointsCount: number
}) {
  return (
    <div className="grid grid-cols-2 gap-3 p-3 bg-slate-800/50 rounded-lg">
      <div className="flex items-center gap-2">
        <Route className="text-amber-500" size={16} />
        <div>
          <p className="text-xs text-gray-400">Distancia</p>
          <p className="text-sm font-bold text-white">{formatDistance(distance)}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <Clock className="text-blue-500" size={16} />
        <div>
          <p className="text-xs text-gray-400">Tiempo</p>
          <p className="text-sm font-bold text-white">{formatTime(time)}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <Gauge className="text-green-500" size={16} />
        <div>
          <p className="text-xs text-gray-400">Vel. Actual</p>
          <p className="text-sm font-bold text-white">{formatSpeed(currentSpeed)}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <TrendingUp className="text-purple-500" size={16} />
        <div>
          <p className="text-xs text-gray-400">Vel. Promedio</p>
          <p className="text-sm font-bold text-white">{formatSpeed(averageSpeed)}</p>
        </div>
      </div>
      
      <div className="col-span-2 flex items-center justify-between px-2 pt-2 border-t border-slate-700">
        <span className="text-xs text-gray-400">Vel. Máxima:</span>
        <span className="text-sm font-bold text-red-400">{formatSpeed(maxSpeed)}</span>
      </div>
      
      <div className="col-span-2 flex items-center justify-between px-2">
        <span className="text-xs text-gray-400">Puntos GPS:</span>
        <span className="text-sm font-bold text-blue-400">{pointsCount}</span>
      </div>
    </div>
  )
}

// Paso 1: Establecer punto de partida
function SetStartPointStep({
  onSet,
  isLoading,
}: {
  onSet: () => void
  isLoading: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-full mb-4">
          <Target className="text-green-500" size={32} />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">Punto de Partida</h3>
        <p className="text-sm text-gray-400">
          Coloca el punto de inicio de tu ruta
        </p>
      </div>

      <button
        onClick={onSet}
        disabled={isLoading}
        className="w-full py-4 bg-green-500 hover:bg-green-400 disabled:bg-gray-600 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="animate-spin" size={20} />
            Obteniendo ubicación...
          </>
        ) : (
          <>
            <MapPin size={20} />
            Usar Mi Ubicación Actual
          </>
        )}
      </button>
    </div>
  )
}

// Paso 2: Establecer punto de llegada
function SetEndPointStep({
  onSet,
  isLoading,
}: {
  onSet: () => void
  isLoading: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/20 rounded-full mb-4">
          <Flag className="text-red-500" size={32} />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">Punto de Llegada</h3>
        <p className="text-sm text-gray-400">
          Coloca el punto final de tu ruta
        </p>
      </div>

      <button
        onClick={onSet}
        disabled={isLoading}
        className="w-full py-4 bg-red-500 hover:bg-red-400 disabled:bg-gray-600 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="animate-spin" size={20} />
            Obteniendo ubicación...
          </>
        ) : (
          <>
            <MapPin size={20} />
            Usar Mi Ubicación Actual
          </>
        )}
      </button>
    </div>
  )
}

// Paso 3: Tracking en progreso
function TrackingStep({
  state,
  onPause,
  onResume,
  onComplete,
}: {
  state: any
  onPause: () => void
  onResume: () => void
  onComplete: () => void
}) {
  return (
    <div className="space-y-4">
      {/* Estado del tracking */}
      <div className={`p-4 rounded-lg border-2 ${
        state.isPaused
          ? 'bg-yellow-500/10 border-yellow-500/30'
          : state.isStopped
          ? 'bg-orange-500/10 border-orange-500/30'
          : 'bg-green-500/10 border-green-500/30'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full animate-pulse ${
              state.isPaused ? 'bg-yellow-500' :
              state.isStopped ? 'bg-orange-500' : 'bg-green-500'
            }`} />
            <span className="font-semibold text-white">
              {state.isPaused ? 'PAUSADO' :
               state.isStopped ? 'DETECTADA PARADA' : 'GRABANDO RUTA'}
            </span>
          </div>
          
          <GPSAccuracyIndicator accuracy={state.accuracy} />
        </div>

        {state.isStopped && !state.isPaused && (
          <p className="text-xs text-orange-400">
            Velocidad baja. Pausa automática en {Math.ceil((5000 - state.stopDuration) / 1000)}s...
          </p>
        )}

        {state.isPaused && (
          <p className="text-xs text-yellow-400">
            Tracking pausado. Reanuda para continuar.
          </p>
        )}
      </div>

      {/* Métricas */}
      <MetricsPanel
        distance={state.distanceTraveled}
        time={state.elapsedTime}
        currentSpeed={state.currentSpeed}
        averageSpeed={state.averageSpeed}
        maxSpeed={state.maxSpeed}
        pointsCount={state.pointsCount}
      />

      {/* Controles */}
      <div className="grid grid-cols-2 gap-3">
        {!state.isPaused ? (
          <button
            onClick={onPause}
            className="py-3 bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Pause size={20} />
            Pausar
          </button>
        ) : (
          <button
            onClick={onResume}
            className="py-3 bg-green-500 hover:bg-green-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Play size={20} />
            Reanudar
          </button>
        )}

        <button
          onClick={onComplete}
          className="py-3 bg-red-500 hover:bg-red-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <Square size={20} />
          Finalizar
        </button>
      </div>
    </div>
  )
}

// Paso completado
function CompletedStep({
  state,
  onSave,
  onRestart,
}: {
  state: any
  onSave: () => void
  onRestart: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-full mb-4">
          <CheckCircle2 className="text-green-500" size={32} />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">¡Ruta Completada!</h3>
        <p className="text-sm text-gray-400">
          Tu ruta ha sido grabada exitosamente
        </p>
      </div>

      {/* Resumen final */}
      <MetricsPanel
        distance={state.distanceTraveled}
        time={state.elapsedTime}
        currentSpeed={state.currentSpeed}
        averageSpeed={state.averageSpeed}
        maxSpeed={state.maxSpeed}
        pointsCount={state.pointsCount}
      />

      {/* Acciones */}
      <div className="space-y-3">
        <button
          onClick={onSave}
          className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <Save size={20} />
          Guardar Ruta
        </button>

        <button
          onClick={onRestart}
          className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <RotateCcw size={20} />
          Grabar Nueva Ruta
        </button>
      </div>
    </div>
  )
}

// Componente principal
interface MobileGPSTrackerProps {
  onComplete?: (trackPoints: GPSTrackPoint[], startPoint: GPSTrackPoint, endPoint: GPSTrackPoint) => void
  onCancel?: () => void
}

export function MobileGPSTracker({ onComplete, onCancel }: MobileGPSTrackerProps) {
  const { state, actions } = useMobileGPSTracker({
    minMovementSpeed: 0.5, // ~1.8 km/h
    minStopDuration: 5000, // 5 segundos
    samplingInterval: 2000, // 2 segundos
    maxAccuracyThreshold: 30, // 30 metros
    minDistanceBetweenPoints: 5, // 5 metros
  })

  const [isGettingLocation, setIsGettingLocation] = useState(false)

  // Manejar completado
  const handleComplete = async () => {
    await actions.completeTracking()
    if (state.startPoint && state.endPoint && state.trackPoints.length > 0) {
      onComplete?.(state.trackPoints, state.startPoint, state.endPoint)
    }
  }

  // Manejar reinicio
  const handleRestart = () => {
    actions.cancelTracking()
  }

  // Manejar sincronización manual
  const handleManualSync = async () => {
    const { syncManager } = await import('@/services/SyncManager')
    await syncManager.forceSync()
  }

  return (
    <div className="min-h-screen bg-[#1c2327] text-slate-100">
      {/* Header */}
      <header className="bg-slate-900/50 backdrop-blur-sm border-b border-slate-800 sticky top-0 z-50">
        <div className="px-4 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <Navigation size={20} />
                </button>
              )}
              <div>
                <h1 className="text-lg font-bold text-white">GPS Tracker</h1>
                <p className="text-xs text-gray-400">
                  {state.step === 'set-start' && 'Paso 1 de 3'}
                  {state.step === 'set-end' && 'Paso 2 de 3'}
                  {(state.step === 'tracking' || state.step === 'paused') && 'Paso 3 de 3'}
                  {state.step === 'completed' && 'Completado'}
                </p>
              </div>
            </div>

            {state.step !== 'completed' && state.step !== 'set-start' && (
              <button
                onClick={handleRestart}
                className="px-3 py-2 text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors"
              >
                Cancelar
              </button>
            )}
          </div>

          {/* Indicador de conexión */}
          <ConnectionStatusIndicator
            isOnline={state.isOnline}
            syncStatus={state.syncStatus}
            pendingSync={state.pendingSync}
            onSync={handleManualSync}
          />
        </div>
      </header>

      {/* Contenido principal */}
      <main className="p-4 max-w-lg mx-auto">
        {/* Notificación de modo offline */}
        {!state.isOnline && (
          <div className="mb-4 p-4 bg-amber-500/10 border-2 border-amber-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <WifiOff className="text-amber-500 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <h4 className="font-semibold text-amber-400 mb-1">Modo Offline</h4>
                <p className="text-sm text-amber-300/80">
                  Sin conexión a internet. Tu ruta se guardará localmente y se sincronizará
                  automáticamente cuando vuelvas a tener conexión.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Barra de progreso */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400">Progreso</span>
            <span className="text-xs text-gray-400">
              {state.step === 'set-start' && '33%'}
              {state.step === 'set-end' && '66%'}
              {(state.step === 'tracking' || state.step === 'paused') && '90%'}
              {state.step === 'completed' && '100%'}
            </span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all duration-300"
              style={{
                width: state.step === 'set-start' ? '33%' :
                       state.step === 'set-end' ? '66%' :
                       (state.step === 'tracking' || state.step === 'paused') ? '90%' :
                       '100%'
              }}
            />
          </div>
        </div>

        {/* Errores */}
        {state.error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
            <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
            <p className="text-sm text-red-400">{state.error}</p>
          </div>
        )}

        {/* Pasos */}
        {state.step === 'set-start' && (
          <SetStartPointStep
            onSet={() => {
              setIsGettingLocation(true)
              actions.setStartPoint()
              setTimeout(() => setIsGettingLocation(false), 2000)
            }}
            isLoading={isGettingLocation}
          />
        )}

        {state.step === 'set-end' && (
          <SetEndPointStep
            onSet={() => {
              setIsGettingLocation(true)
              actions.setEndPoint()
              setTimeout(() => setIsGettingLocation(false), 2000)
            }}
            isLoading={isGettingLocation}
          />
        )}

        {(state.step === 'tracking' || state.step === 'paused') && (
          <TrackingStep
            state={state}
            onPause={actions.pauseTracking}
            onResume={actions.resumeTracking}
            onComplete={handleComplete}
          />
        )}

        {state.step === 'completed' && (
          <CompletedStep
            state={state}
            onSave={() => {
              // Aquí se puede navegar a la página de guardado
              handleComplete()
            }}
            onRestart={handleRestart}
          />
        )}

        {/* Información adicional */}
        <div className="mt-6 p-4 bg-slate-800/30 rounded-lg border border-slate-700">
          <h4 className="text-sm font-semibold text-white mb-2">💡 Consejos</h4>
          <ul className="text-xs text-gray-400 space-y-1">
            <li>• Mantén el dispositivo en un lugar con buena señal GPS</li>
            <li>• El tracking se pausa automáticamente si te detienes</li>
            <li>• Mayor precisión = mejor calidad de ruta</li>
            <li>• Evita obstrucciones como edificios altos</li>
            {!state.isOnline && (
              <li className="text-amber-400">• 📴 Modo offline: tus datos se guardan localmente</li>
            )}
            {state.pendingSync && (
              <li className="text-blue-400">• 🔄 Hay rutas pendientes de sincronización</li>
            )}
          </ul>
        </div>
      </main>
    </div>
  )
}
