'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/core/infrastructure/supabase/client'
import { User } from '@/core/domain/User'
import { RouteMapEditorDynamic } from '@/components/routes/MapWrapper'
import { useGPSRecorder, formatTime, formatDistance, formatSpeed } from '@/hooks/useGPSRecorder'
import { GPSTrackProcessingService } from '@/core/application/CreateRouteUseCase'
import { SupabaseRouteRepository } from '@/core/infrastructure/repositories/SupabaseRouteRepository'
import {
  Circle,
  Square,
  Pause,
  Play,
  MapPin,
  Clock,
  TrendingUp,
  Navigation,
  AlertCircle,
  Loader2,
  Save,
  X,
  Trash2,
} from 'lucide-react'

export default function RecordRoutePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [routeName, setRouteName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Hook de grabación GPS
  const {
    isRecording,
    isPaused,
    points,
    elapsedTime,
    currentAccuracy,
    currentSpeed,
    error: gpsError,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearRecording,
    exportPoints,
  } = useGPSRecorder({
    recordingInterval: 1000,
    minAccuracy: 15,
    minDistance: 3,
  })

  // Cargar usuario
  useEffect(() => {
    const loadUser = async () => {
      const supabase = createClient()
      const { data: { user: supaUser } } = await supabase.auth.getUser()

      if (supaUser) {
        setUser({
          id: supaUser.id,
          email: supaUser.email || '',
          fullName: supaUser.user_metadata?.fullName || supaUser.email?.split('@')[0] || 'Usuario',
          avatarUrl: supaUser.user_metadata?.avatarUrl,
        })
      }
    }

    loadUser()
  }, [])

  // Calcular distancia total
  const calculateDistance = () => {
    if (points.length < 2) return 0

    let total = 0
    for (let i = 1; i < points.length; i++) {
      const R = 6371000
      const dLat = ((points[i].latitude - points[i - 1].latitude) * Math.PI) / 180
      const dLng = ((points[i].longitude - points[i - 1].longitude) * Math.PI) / 180
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((points[i - 1].latitude * Math.PI) / 180) *
          Math.cos((points[i].latitude * Math.PI) / 180) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      total += R * c
    }
    return total
  }

  const distanceM = calculateDistance()
  const distanceKm = distanceM / 1000

  // Calcular velocidad promedio
  const avgSpeed = currentSpeed !== null && elapsedTime > 0
    ? (distanceM / elapsedTime)
    : 0

  // Manejar inicio de grabación
  const handleStart = () => {
    startRecording()
  }

  // Manejar pausa/reanudar
  const handlePauseResume = () => {
    if (isPaused) {
      resumeRecording()
    } else {
      pauseRecording()
    }
  }

  // Manejar detención
  const handleStop = () => {
    stopRecording()
    if (points.length > 1) {
      setShowSaveModal(true)
    }
  }

  // Manejar cancelación
  const handleCancel = () => {
    stopRecording()
    clearRecording()
    setShowSaveModal(false)
    setRouteName('')
    setSaveError(null)
  }

  // Manejar guardado de ruta
  const handleSave = async () => {
    if (!user || !routeName.trim()) {
      setSaveError('El nombre de la ruta es requerido')
      return
    }

    if (points.length < 2) {
      setSaveError('Se requieren al menos 2 puntos')
      return
    }

    setIsSaving(true)
    setSaveError(null)

    try {
      const exportedPoints = exportPoints()
      
      // Procesar puntos
      const processingService = new GPSTrackProcessingService()
      const gpsPoints = exportedPoints.map(p => ({
        latitude: p.latitude,
        longitude: p.longitude,
        altitude: p.altitude,
        accuracy: p.accuracy,
        timestamp: p.timestamp,
      }))

      const processed = processingService.processTrack(gpsPoints)

      // Validar
      const validation = processingService.validateRoute(
        [exportedPoints[0].latitude, exportedPoints[0].longitude],
        [exportedPoints[exportedPoints.length - 1].latitude, exportedPoints[exportedPoints.length - 1].longitude],
        processed.points
      )

      if (!validation.valid) {
        setSaveError(validation.errors.join(', '))
        setIsSaving(false)
        return
      }

      // Guardar en Supabase
      const repository = new SupabaseRouteRepository()
      
      await repository.createRoute(
        {
          name: routeName.trim(),
          difficulty: 'Intermediate',
          startCoord: [exportedPoints[0].latitude, exportedPoints[0].longitude],
          endCoord: [
            exportedPoints[exportedPoints.length - 1].latitude,
            exportedPoints[exportedPoints.length - 1].longitude,
          ],
          trackPoints: processed.points.map(p => ({
            latitude: p.latitude,
            longitude: p.longitude,
            altitude: p.altitude,
            accuracy: p.accuracy,
          })),
          isPublic: true,
        },
        user.id
      )

      // Éxito
      setIsSaving(false)
      setShowSaveModal(false)
      clearRecording()
      setRouteName('')
      router.push('/dashboard/profile')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Error guardando la ruta')
      setIsSaving(false)
    }
  }

  // Centro del mapa
  const mapCenter: [number, number] = points.length > 0
    ? [points[Math.floor(points.length / 2)].latitude, points[Math.floor(points.length / 2)].longitude]
    : [-13.5319, -71.9675] // Cusco

  if (!user) {
    return (
      <div className="min-h-screen bg-[#1c2327] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto text-amber-500 mb-4" size={40} />
          <p className="text-gray-400">Cargando...</p>
        </div>
      </div>
    )
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
            >
              <X size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">Grabar Ruta</h1>
              <p className="text-sm text-gray-400">Recorre la ruta mientras grabas</p>
            </div>
          </div>

          {isRecording && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm text-red-400">
                {isPaused ? 'Pausado' : 'Grabando'}
              </span>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 space-y-4">
        {/* Mapa */}
        <div className="bg-slate-900/50 rounded-xl overflow-hidden border border-slate-800">
          <div className="h-[500px]">
            <RouteMapEditorDynamic
              startPoint={points.length > 0 ? points[0] : null}
              endPoint={points.length > 1 ? points[points.length - 1] : null}
              trackPoints={points.slice(1, -1)}
              onPointAdd={() => {}}
              onPointRemove={() => {}}
              onStartPointSet={() => {}}
              onEndPointSet={() => {}}
              isDrawing={false}
              center={mapCenter}
              zoom={18} // Zoom máximo detalle
            />
          </div>
        </div>

        {/* Estadísticas en tiempo real */}
        {isRecording && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Tiempo */}
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
              <div className="flex items-center gap-2 text-blue-400 mb-2">
                <Clock size={18} />
                <span className="text-sm">Tiempo</span>
              </div>
              <p className="text-2xl font-bold text-white font-mono">
                {formatTime(elapsedTime)}
              </p>
            </div>

            {/* Distancia */}
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
              <div className="flex items-center gap-2 text-amber-400 mb-2">
                <TrendingUp size={18} />
                <span className="text-sm">Distancia</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {formatDistance(distanceM)}
              </p>
            </div>

            {/* Velocidad */}
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
              <div className="flex items-center gap-2 text-green-400 mb-2">
                <Navigation size={18} />
                <span className="text-sm">Velocidad</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {currentSpeed ? formatSpeed(currentSpeed) : '--'}
              </p>
              {avgSpeed > 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  Prom: {formatSpeed(avgSpeed)}
                </p>
              )}
            </div>

            {/* Puntos */}
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
              <div className="flex items-center gap-2 text-purple-400 mb-2">
                <MapPin size={18} />
                <span className="text-sm">Puntos</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {points.length}
              </p>
              {currentAccuracy && (
                <p className="text-xs text-gray-400 mt-1">
                  ±{currentAccuracy.toFixed(1)}m
                </p>
              )}
            </div>
          </div>
        )}

        {/* Error de GPS */}
        {gpsError && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="text-red-400" size={24} />
            <div>
              <p className="font-semibold text-red-400">Error de GPS</p>
              <p className="text-sm text-red-300">{gpsError}</p>
            </div>
          </div>
        )}

        {/* Controles de grabación */}
        <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-sm border-t border-slate-800 p-4">
          <div className="max-w-md mx-auto flex items-center justify-center gap-4">
            {!isRecording ? (
              <button
                onClick={handleStart}
                className="flex-1 py-4 bg-green-500 hover:bg-green-400 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Circle size={24} className="fill-current" />
                Iniciar Grabación
              </button>
            ) : (
              <>
                <button
                  onClick={handlePauseResume}
                  className="p-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors"
                >
                  {isPaused ? <Play size={24} /> : <Pause size={24} />}
                </button>

                <button
                  onClick={handleStop}
                  className="flex-1 py-4 bg-red-500 hover:bg-red-400 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <Square size={24} className="fill-current" />
                  Detener
                </button>
              </>
            )}
          </div>
        </div>

        {/* Espacio para el controls fijo */}
        <div className="h-32" />
      </div>

      {/* Modal de guardado */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-2xl p-6 max-w-md w-full border border-slate-800">
            <h2 className="text-xl font-bold text-white mb-4">Guardar Ruta</h2>

            <div className="space-y-4">
              {/* Resumen */}
              <div className="bg-slate-800 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Distancia</span>
                  <span className="text-white font-medium">{formatDistance(distanceM)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Tiempo</span>
                  <span className="text-white font-medium">{formatTime(elapsedTime)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Puntos</span>
                  <span className="text-white font-medium">{points.length}</span>
                </div>
              </div>

              {/* Nombre */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Nombre de la ruta *
                </label>
                <input
                  type="text"
                  value={routeName}
                  onChange={(e) => setRouteName(e.target.value)}
                  placeholder="Ej: Mi ruta de downhill"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-white"
                  autoFocus
                />
              </div>

              {/* Error */}
              {saveError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={18} />
                  <p className="text-sm text-red-300">{saveError}</p>
                </div>
              )}

              {/* Acciones */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCancel}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 size={18} />
                  Descartar
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || !routeName.trim()}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 disabled:bg-gray-600 text-slate-900 font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      Guardar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
