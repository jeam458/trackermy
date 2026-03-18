'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/core/infrastructure/supabase/client'
import { SupabaseRouteRepository } from '@/core/infrastructure/repositories/SupabaseRouteRepository'
import { RouteEnhancementService } from '@/core/application/RouteEnhancementService'
import { RouteMapEditorDynamic } from '@/components/routes/MapWrapper'
import { MapPoint } from '@/components/routes/RouteMapEditor'
import {
  ArrowLeft,
  Save,
  MapPin,
  TrendingUp,
  Mountain,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Undo2,
  Trash2,
} from 'lucide-react'
import { Route } from '@/core/domain/Route'
import { useToast } from '@/components/ui/Toast'

export default function EditRoutePage() {
  const router = useRouter()
  const params = useParams()
  const routeId = params.id as string
  const toast = useToast()

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [route, setRoute] = useState<Route | null>(null)
  const [user, setUser] = useState<{ id: string } | null>(null)

  // Estados del formulario
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [difficulty, setDifficulty] = useState<'Beginner' | 'Intermediate' | 'Expert'>('Intermediate')
  const [isPublic, setIsPublic] = useState(true)

  // Estados del mapa
  const [startPoint, setStartPoint] = useState<MapPoint | null>(null)
  const [endPoint, setEndPoint] = useState<MapPoint | null>(null)
  const [trackPoints, setTrackPoints] = useState<MapPoint[]>([])
  const [isDrawing, setIsDrawing] = useState(false)

  // Estadísticas calculadas
  const [calculatedStats, setCalculatedStats] = useState({
    distance: 0,
    elevationGain: 0,
    elevationLoss: 0,
    maxAltitude: undefined as number | undefined,
    minAltitude: undefined as number | undefined,
    elevationRange: 0,
  })

  const repository = new SupabaseRouteRepository()
  const enhancementService = new RouteEnhancementService()

  // Cargar datos de la ruta
  useEffect(() => {
    const loadRoute = async () => {
      try {
        const supabase = createClient()
        const { data: { user: supaUser } } = await supabase.auth.getUser()

        if (!supaUser) {
          toast.error('Debes iniciar sesión', 'Para editar rutas necesitas estar autenticado')
          router.push('/login')
          return
        }

        setUser(supaUser)

        // Cargar ruta
        const loadedRoute = await repository.getRouteById(routeId)

        if (!loadedRoute) {
          toast.error('Ruta no encontrada')
          router.push('/dashboard/routes')
          return
        }

        // Verificar que el usuario es el dueño
        if (loadedRoute.createdBy !== supaUser.id) {
          toast.error('No tienes permiso', 'No puedes editar rutas de otros usuarios')
          router.push('/dashboard/routes')
          return
        }

        setRoute(loadedRoute)
        setName(loadedRoute.name)
        setDescription(loadedRoute.description || '')
        setDifficulty(loadedRoute.difficulty)
        setIsPublic(loadedRoute.isPublic)

        // Cargar puntos del mapa
        if (loadedRoute.trackPoints.length > 0) {
          const points: MapPoint[] = loadedRoute.trackPoints.map(p => ({
            latitude: p.latitude,
            longitude: p.longitude,
            altitude: p.altitude,
            accuracy: p.accuracy,
          }))

          setStartPoint({
            latitude: loadedRoute.startCoord[0],
            longitude: loadedRoute.startCoord[1],
          })
          setEndPoint({
            latitude: loadedRoute.endCoord[0],
            longitude: loadedRoute.endCoord[1],
          })
          setTrackPoints(points.slice(1, -1)) // Excluir inicio y fin

          // Calcular estadísticas
          calculateStats(points)
        }
      } catch (error) {
        console.error('Error cargando ruta:', error)
        alert('Error cargando la ruta')
      } finally {
        setIsLoading(false)
      }
    }

    loadRoute()
  }, [routeId])

  // Calcular estadísticas desde los puntos GPS
  const calculateStats = (points: MapPoint[]) => {
    if (points.length < 2) {
      setCalculatedStats({
        distance: 0,
        elevationGain: 0,
        elevationLoss: 0,
        maxAltitude: undefined,
        minAltitude: undefined,
        elevationRange: 0,
      })
      return
    }

    let distance = 0
    let elevationGain = 0
    let elevationLoss = 0
    let maxAltitude = -Infinity
    let minAltitude = Infinity

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
        
        // Altitud máxima y mínima
        maxAltitude = Math.max(maxAltitude, curr.altitude)
        minAltitude = Math.min(minAltitude, curr.altitude)
      }
    }

    setCalculatedStats({
      distance: distance / 1000, // km
      elevationGain,
      elevationLoss,
      maxAltitude: maxAltitude === -Infinity ? undefined : maxAltitude,
      minAltitude: minAltitude === Infinity ? undefined : minAltitude,
      elevationRange: maxAltitude === -Infinity || minAltitude === Infinity 
        ? 0 
        : maxAltitude - minAltitude,
    })
  }

  // Recalcular estadísticas cuando cambian los puntos
  useEffect(() => {
    if (startPoint && endPoint && trackPoints.length > 0) {
      const allPoints = [startPoint, ...trackPoints, endPoint]
      calculateStats(allPoints)
    }
  }, [startPoint, endPoint, trackPoints])

  // Guardar cambios
  const handleSave = async () => {
    if (!user || !route) return

    if (!name.trim()) {
      toast.error('Nombre requerido', 'El nombre de la ruta es obligatorio')
      return
    }

    if (!startPoint || !endPoint) {
      toast.warning('Puntos incompletos', 'Debes tener punto de partida y llegada')
      return
    }

    if (trackPoints.length === 0) {
      toast.warning('Ruta muy corta', 'Debes tener al menos un punto intermedio')
      return
    }

    setIsSaving(true)

    try {
      // Crear array completo de puntos
      const allPoints = [startPoint, ...trackPoints, endPoint]

      // Calcular estadísticas finales
      calculateStats(allPoints)

      // Mejorar ruta automáticamente
      const partialRoute = {
        name,
        description,
        difficulty,
        startCoord: [startPoint.latitude, startPoint.longitude] as [number, number],
        endCoord: [endPoint.latitude, endPoint.longitude] as [number, number],
        trackPoints: allPoints.map((p, i) => ({
          latitude: p.latitude,
          longitude: p.longitude,
          altitude: p.altitude,
          accuracy: p.accuracy,
          orderIndex: i,
        })),
      }

      const enhancementResult = enhancementService.enhanceRoute(partialRoute)

      console.log('Mejoras aplicadas:', enhancementResult.changes)
      console.log('Estadísticas calculadas:', calculatedStats)

      // Actualizar en Supabase con las estadísticas calculadas
      await repository.updateRoute(routeId, {
        name: name.trim(),
        description: description.trim(),
        difficulty,
        isPublic,
        trackPoints: enhancementResult.enhanced.trackPoints?.map((p, i) => ({
          id: undefined,
          routeId: undefined,
          latitude: p.latitude,
          longitude: p.longitude,
          altitude: p.altitude,
          accuracy: p.accuracy,
          timestamp: undefined,
          orderIndex: i,
        })),
      })

      toast.success('¡Ruta actualizada!', 'Los cambios se guardaron correctamente')
      router.push(`/dashboard/routes/${routeId}`)
    } catch (error) {
      console.error('Error guardando ruta:', error)
      toast.error('Error al guardar', 'Hubo un problema al guardar la ruta. Inténtalo de nuevo.')
    } finally {
      setIsSaving(false)
    }
  }

  // Cancelar y volver
  const handleCancel = () => {
    router.back()
  }

  // Limpiar puntos
  const handleClearPoints = () => {
    if (confirm('¿Estás seguro de que quieres borrar todos los puntos?')) {
      setStartPoint(null)
      setEndPoint(null)
      setTrackPoints([])
      setCalculatedStats({
        distance: 0,
        elevationGain: 0,
        elevationLoss: 0,
        maxAltitude: undefined,
        minAltitude: undefined,
        elevationRange: 0,
      })
    }
  }

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
              onClick={handleCancel}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">Editar Ruta</h1>
              <p className="text-sm text-gray-400">Modifica los detalles y puntos de tu ruta</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleClearPoints}
              className="px-4 py-2 text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors flex items-center gap-2"
            >
              <Trash2 size={16} />
              Limpiar Puntos
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-2"
            >
              <Undo2 size={16} />
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-gray-600 text-slate-900 font-semibold rounded-lg transition-colors flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Guardando...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Guardar Cambios
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Columna izquierda - Mapa */}
        <div className="lg:col-span-2 space-y-4">
          {/* Mapa */}
          <div className="bg-slate-900/50 rounded-xl overflow-hidden border border-slate-800">
            <div className="h-[600px]">
              <RouteMapEditorDynamic
                startPoint={startPoint}
                endPoint={endPoint}
                trackPoints={trackPoints}
                onPointAdd={(point) => setTrackPoints([...trackPoints, point])}
                onPointRemove={(index) => setTrackPoints(trackPoints.filter((_, i) => i !== index))}
                onStartPointSet={setStartPoint}
                onEndPointSet={setEndPoint}
                isDrawing={true}
                center={startPoint ? [startPoint.latitude, startPoint.longitude] : [-13.5319, -71.9675]}
                zoom={16}
              />
            </div>
          </div>

          {/* Estadísticas calculadas */}
          {trackPoints.length > 0 && (
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <CheckCircle2 className="text-green-500" size={20} />
                Estadísticas Calculadas (desde GPS)
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-slate-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-amber-400 mb-2">
                    <TrendingUp size={20} />
                    <span className="text-sm font-medium">Distancia</span>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {calculatedStats.distance.toFixed(2)} km
                  </p>
                </div>

                <div className="bg-slate-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-400 mb-2">
                    <Mountain size={20} />
                    <span className="text-sm font-medium">Elevación +</span>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    +{calculatedStats.elevationGain.toFixed(0)} m
                  </p>
                </div>

                <div className="bg-slate-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-red-400 mb-2">
                    <Mountain size={20} className="rotate-180" />
                    <span className="text-sm font-medium">Elevación -</span>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    -{calculatedStats.elevationLoss.toFixed(0)} m
                  </p>
                </div>

                {calculatedStats.maxAltitude !== undefined && (
                  <div className="bg-slate-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-blue-400 mb-2">
                      <Mountain size={20} />
                      <span className="text-sm font-medium">Altitud Máx</span>
                    </div>
                    <p className="text-2xl font-bold text-white">
                      {calculatedStats.maxAltitude.toFixed(0)} m
                    </p>
                  </div>
                )}

                {calculatedStats.minAltitude !== undefined && (
                  <div className="bg-slate-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-purple-400 mb-2">
                      <Mountain size={20} className="rotate-180" />
                      <span className="text-sm font-medium">Altitud Mín</span>
                    </div>
                    <p className="text-2xl font-bold text-white">
                      {calculatedStats.minAltitude.toFixed(0)} m
                    </p>
                  </div>
                )}

                <div className="bg-slate-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-orange-400 mb-2">
                    <TrendingUp size={20} />
                    <span className="text-sm font-medium">Desnivel</span>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {calculatedStats.elevationRange.toFixed(0)} m
                  </p>
                </div>
              </div>

              <p className="text-xs text-gray-400 mt-4 flex items-center gap-2">
                <AlertCircle size={12} />
                Estas estadísticas se recalculan automáticamente desde los puntos GPS en tiempo real
              </p>
            </div>
          )}
        </div>

        {/* Columna derecha - Formulario */}
        <div className="space-y-4">
          {/* Información básica */}
          <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800 space-y-4">
            <h3 className="font-semibold text-white">Información de la Ruta</h3>

            {/* Nombre */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Nombre *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre de la ruta"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-white"
              />
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Descripción
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe las características de la ruta..."
                rows={4}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-white resize-none"
              />
            </div>

            {/* Dificultad */}
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

            {/* Visibilidad */}
            <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
              <div className="flex items-center gap-2">
                {isPublic ? (
                  <MapPin className="text-green-400" size={20} />
                ) : (
                  <MapPin className="text-gray-400" size={20} />
                )}
                <div>
                  <p className="text-sm font-medium text-white">Visibilidad</p>
                  <p className="text-xs text-gray-400">
                    {isPublic ? 'Pública (otros pueden ver)' : 'Privada (solo tú)'}
                  </p>
                </div>
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

          {/* Puntos actuales */}
          <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
            <h3 className="font-semibold text-white mb-3">Puntos de la Ruta</h3>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-gray-300">Partida:</span>
                <span className="text-white font-medium">
                  {startPoint ? `${startPoint.latitude.toFixed(4)}, ${startPoint.longitude.toFixed(4)}` : 'No definido'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-gray-300">Intermedios:</span>
                <span className="text-white font-medium">{trackPoints.length} puntos</span>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-gray-300">Llegada:</span>
                <span className="text-white font-medium">
                  {endPoint ? `${endPoint.latitude.toFixed(4)}, ${endPoint.longitude.toFixed(4)}` : 'No definido'}
                </span>
              </div>
            </div>

            <p className="text-xs text-gray-400 mt-4">
              Click en el mapa para agregar o modificar puntos
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
