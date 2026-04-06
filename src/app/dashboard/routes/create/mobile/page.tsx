'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/core/infrastructure/supabase/client'
import { User } from '@/core/domain/User'
import { MobileGPSTracker } from '@/components/mobile/MobileGPSTracker'
import { GPSTrackPoint } from '@/hooks/useMobileGPSTracker'
import { MapPoint } from '@/components/routes/RouteMapEditor'
import { GPSTrackProcessingService } from '@/core/application/CreateRouteUseCase'
import { SupabaseRouteRepository } from '@/core/infrastructure/repositories/SupabaseRouteRepository'
import { RouteCreationRequest } from '@/core/domain/Route'
import { GPSPoint } from '@/core/domain/GPSTrack'
import {
  Smartphone,
  Globe,
  ArrowLeft,
  Loader2,
} from 'lucide-react'

// Verificar si es dispositivo móvil
function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const hasTouchPoints = navigator.maxTouchPoints !== undefined && navigator.maxTouchPoints > 2
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || hasTouchPoints
}

export default function MobileRouteCreatePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [useMobileTracker, setUseMobileTracker] = useState<boolean | null>(null)
  const [showTracker, setShowTracker] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Datos del tracking
  const [trackData, setTrackData] = useState<{
    startPoint: GPSTrackPoint | null
    endPoint: GPSTrackPoint | null
    trackPoints: GPSTrackPoint[]
  }>({
    startPoint: null,
    endPoint: null,
    trackPoints: [],
  })

  // Información de la ruta
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [difficulty, setDifficulty] = useState<'Beginner' | 'Intermediate' | 'Expert'>('Intermediate')
  const [isPublic, setIsPublic] = useState(true)

  // Cargar usuario y detectar dispositivo
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

        // Auto-detectar si es móvil
        const isMobile = isMobileDevice()
        setUseMobileTracker(isMobile)
      }
    }

    loadUser()
  }, [])

  // Manejar completado del tracking móvil
  const handleTrackingComplete = async (
    points: GPSTrackPoint[],
    start: GPSTrackPoint,
    end: GPSTrackPoint
  ) => {
    setTrackData({
      startPoint: start,
      endPoint: end,
      trackPoints: points,
    })
    setShowTracker(false)
  }

  // Convertir GPSTrackPoint a GPSPoint
  const toGPSPoint = (point: GPSTrackPoint): GPSPoint => {
    return {
      latitude: point.latitude,
      longitude: point.longitude,
      altitude: point.altitude,
      accuracy: point.accuracy,
      timestamp: point.timestamp,
    }
  }

  // Guardar ruta desde datos móviles
  const handleSaveMobileRoute = async () => {
    if (!user || !trackData.startPoint || !trackData.endPoint || trackData.trackPoints.length === 0) {
      setError('Datos de ruta incompletos')
      return
    }

    if (!name.trim()) {
      setError('El nombre de la ruta es requerido')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()

      if (!authUser) {
        throw new Error('Usuario no autenticado')
      }

      // Procesar track
      const processingService = new GPSTrackProcessingService()
      const gpsPoints = trackData.trackPoints.map(toGPSPoint)
      const processedTrack = processingService.processTrack(gpsPoints)

      // Validar
      const validation = processingService.validateRoute(
        [trackData.startPoint.latitude, trackData.startPoint.longitude],
        [trackData.endPoint.latitude, trackData.endPoint.longitude],
        processedTrack.points
      )

      if (!validation.valid) {
        throw new Error(validation.errors.join(', '))
      }

      // Crear request
      const routeData: RouteCreationRequest = {
        name: name.trim(),
        description: description.trim() || undefined,
        difficulty,
        startCoord: [trackData.startPoint.latitude, trackData.startPoint.longitude],
        endCoord: [trackData.endPoint.latitude, trackData.endPoint.longitude],
        trackPoints: processedTrack.points.map((p) => ({
          latitude: p.latitude,
          longitude: p.longitude,
          altitude: p.altitude,
          accuracy: p.accuracy,
        })),
        isPublic,
      }

      // Guardar en Supabase
      const routeRepository = new SupabaseRouteRepository()
      await routeRepository.createRoute(routeData, authUser.id)

      // Redirigir al perfil
      router.push('/dashboard/profile')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error guardando la ruta'
      setError(errorMessage)
    } finally {
      setIsSaving(false)
    }
  }

  // Cargando usuario
  if (!user || useMobileTracker === null) {
    return (
      <div className="min-h-screen bg-[#1c2327] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto text-amber-500 mb-4" size={40} />
          <p className="text-gray-400">Cargando...</p>
        </div>
      </div>
    )
  }

  // Mostrar selector de modo
  if (useMobileTracker === null) {
    return (
      <div className="min-h-screen bg-[#1c2327] text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-2">Crear Nueva Ruta</h1>
            <p className="text-gray-400">Selecciona el método de creación</p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => setUseMobileTracker(true)}
              className="w-full p-6 bg-slate-800 hover:bg-slate-700 rounded-xl border-2 border-slate-700 hover:border-amber-500 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center">
                  <Smartphone className="text-amber-500" size={24} />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-white mb-1">GPS Tracker (Móvil)</h3>
                  <p className="text-sm text-gray-400">
                    Graba tu ruta en tiempo real caminando/pedaleando
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                setUseMobileTracker(false)
                router.push('/dashboard/routes/create')
              }}
              className="w-full p-6 bg-slate-800 hover:bg-slate-700 rounded-xl border-2 border-slate-700 hover:border-blue-500 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                  <Globe className="text-blue-500" size={24} />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-white mb-1">Editor Manual (Web)</h3>
                  <p className="text-sm text-gray-400">
                    Dibuja la ruta manualmente en el mapa
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Mostrar tracker móvil
  if (useMobileTracker && showTracker) {
    return (
      <MobileGPSTracker
        onComplete={handleTrackingComplete}
        onCancel={() => setShowTracker(false)}
      />
    )
  }

  // Mostrar formulario post-tracking o inicio
  if (useMobileTracker && !showTracker) {
    const hasTrackData = trackData.startPoint && trackData.endPoint && trackData.trackPoints.length > 0

    return (
      <div className="min-h-screen bg-[#1c2327] text-slate-100">
        {/* Header */}
        <header className="bg-slate-900/50 backdrop-blur-sm border-b border-slate-800 sticky top-0 z-50">
          <div className="px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-lg font-bold text-white">Crear Ruta (Móvil)</h1>
                <p className="text-xs text-gray-400">
                  {hasTrackData ? 'Completa la información' : 'Graba tu ruta con GPS'}
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 max-w-lg mx-auto space-y-4">
          {/* Errores */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Si no hay datos de tracking, mostrar botón para iniciar */}
          {!hasTrackData ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-amber-500/20 rounded-full mb-6">
                <Smartphone className="text-amber-500" size={40} />
              </div>
              <h2 className="text-xl font-bold text-white mb-3">Grabar Ruta con GPS</h2>
              <p className="text-sm text-gray-400 mb-6">
                Usa el GPS de tu dispositivo para grabar la ruta en tiempo real
              </p>
              <button
                onClick={() => setShowTracker(true)}
                className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Smartphone size={20} />
                Iniciar GPS Tracker
              </button>
            </div>
          ) : (
            <>
              {/* Datos de tracking */}
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <h3 className="font-semibold text-green-400">Ruta Grabada</h3>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-400">Puntos GPS</p>
                    <p className="font-bold text-white">{trackData.trackPoints.length}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Distancia</p>
                    <p className="font-bold text-white">
                      {(trackData.trackPoints.length * 0.005).toFixed(2)} km
                    </p>
                  </div>
                </div>
              </div>

              {/* Formulario */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: La Bestia Dorada"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Descripción
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe las características de la ruta..."
                    rows={3}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-white resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Dificultad *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Beginner', 'Intermediate', 'Expert'] as const).map((level) => (
                      <button
                        key={level}
                        onClick={() => setDifficulty(level)}
                        className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                          difficulty === level
                            ? level === 'Beginner'
                              ? 'bg-green-500 text-white'
                              : level === 'Intermediate'
                              ? 'bg-blue-500 text-white'
                              : 'bg-red-500 text-white'
                            : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
                        }`}
                      >
                        {level === 'Beginner' && '🟢'}
                        {level === 'Intermediate' && '🔵'}
                        {level === 'Expert' && '🔴'}
                        {' '}
                        {level === 'Beginner' && 'Principiante'}
                        {level === 'Intermediate' && 'Intermedio'}
                        {level === 'Expert' && 'Experto'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-white">Visibilidad</p>
                    <p className="text-xs text-gray-400">
                      {isPublic ? 'Pública (otros pueden ver)' : 'Privada (solo tú)'}
                    </p>
                  </div>
                  <button
                    onClick={() => setIsPublic(!isPublic)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      isPublic ? 'bg-green-500' : 'bg-slate-600'
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        isPublic ? 'left-7' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="space-y-3">
                <button
                  onClick={handleSaveMobileRoute}
                  disabled={isSaving || !name.trim()}
                  className="w-full py-4 bg-amber-500 hover:bg-amber-400 disabled:bg-gray-600 text-slate-900 font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      Guardando...
                    </>
                  ) : (
                    <>
                      Guardar Ruta
                    </>
                  )}
                </button>

                <button
                  onClick={() => {
                    setTrackData({ startPoint: null, endPoint: null, trackPoints: [] })
                    setShowTracker(true)
                  }}
                  className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition-colors"
                >
                  Grabar Nueva Ruta
                </button>
              </div>
            </>
          )}
        </main>
      </div>
    )
  }

  // Fallback: redirigir a creación web
  return null
}
