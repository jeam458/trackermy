'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/core/infrastructure/supabase/client'
import { User } from '@/core/domain/User'
import { RouteMapEditorDynamic } from '@/components/routes/MapWrapper'
import { useRouteCreator } from '@/hooks/useRouteCreator'
import {
  MapPin,
  Navigation,
  Save,
  X,
  Undo2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  TrendingUp,
  Mountain,
  Eye,
  EyeOff,
} from 'lucide-react'

// Badge de calidad del track
function TrackQualityBadge({ quality }: { quality: string | null }) {
  if (!quality) return null

  const config = {
    excellent: { color: 'bg-green-500/20 text-green-400 border-green-500/30', label: 'Excelente' },
    good: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', label: 'Buena' },
    fair: { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', label: 'Regular' },
    poor: { color: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'Deficiente' },
  }

  const { color, label } = config[quality as keyof typeof config] || config.poor

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${color}`}>
      Calidad: {label}
    </span>
  )
}

// Estadísticas del track
function TrackStats({
  distance,
  pointsCount,
  filteredCount,
}: {
  distance: number
  pointsCount: number
  filteredCount: number
}) {
  return (
    <div className="grid grid-cols-3 gap-3 p-3 bg-slate-800/50 rounded-lg">
      <div className="text-center">
        <div className="flex items-center justify-center gap-1 text-amber-400 mb-1">
          <TrendingUp size={14} />
        </div>
        <p className="text-lg font-bold text-white">{distance.toFixed(2)}</p>
        <p className="text-xs text-gray-400">km</p>
      </div>
      <div className="text-center border-l border-slate-700">
        <div className="flex items-center justify-center gap-1 text-blue-400 mb-1">
          <MapPin size={14} />
        </div>
        <p className="text-lg font-bold text-white">{pointsCount}</p>
        <p className="text-xs text-gray-400">puntos</p>
      </div>
      <div className="text-center border-l border-slate-700">
        <div className="flex items-center justify-center gap-1 text-purple-400 mb-1">
          <Mountain size={14} />
        </div>
        <p className="text-lg font-bold text-white">{filteredCount}</p>
        <p className="text-xs text-gray-400">filtrados</p>
      </div>
    </div>
  )
}

export default function CreateRoutePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [showStats, setShowStats] = useState(false)

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

  // Hook de creación de ruta
  const {
    startPoint,
    endPoint,
    trackPoints,
    isDrawing,
    isProcessing,
    isSaving,
    pointSelectionMode,
    name,
    description,
    difficulty,
    isPublic,
    processedTrack,
    quality,
    errors,
    validationErrors,
    startDrawing,
    cancelDrawing,
    startPointSelection,
    cancelPointSelection,
    setStartPoint,
    setEndPoint,
    addTrackPoint,
    removeTrackPoint,
    undoLastPoint,
    useCurrentLocation,
    setName,
    setDescription,
    setDifficulty,
    setIsPublic,
    processTrack,
    saveRoute,
    canSave,
    canProcess,
    getEstimatedDistance,
  } = useRouteCreator(user as User)

  // Manejar guardado exitoso
  const handleSave = async () => {
    const result = await saveRoute()
    if (result.success) {
      router.push('/dashboard/profile')
    }
  }

  // Manejar procesamiento
  const handleProcess = () => {
    const result = processTrack()
    if (result.success) {
      setShowStats(true)
    }
  }

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

  const allPointsCount = [startPoint, ...trackPoints, endPoint].filter(Boolean).length

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
              <h1 className="text-xl font-bold text-white">Crear Nueva Ruta</h1>
              <p className="text-sm text-gray-400">Dibuja tu ruta de downhill en el mapa</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isDrawing && (
              <>
                <button
                  onClick={undoLastPoint}
                  className="px-3 py-2 text-sm bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Undo2 size={16} />
                  Deshacer
                </button>
                <button
                  onClick={cancelDrawing}
                  className="px-3 py-2 text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Trash2 size={16} />
                  Cancelar
                </button>
              </>
            )}
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
                onPointAdd={addTrackPoint}
                onPointRemove={removeTrackPoint}
                onStartPointSet={setStartPoint}
                onEndPointSet={setEndPoint}
                isDrawing={isDrawing}
                pointSelectionMode={pointSelectionMode}
                startPointSelection={startPointSelection}
                cancelPointSelection={cancelPointSelection}
                onUseCurrentLocation={useCurrentLocation}
                center={[-13.5319, -71.9675]} // Cusco
                zoom={18} // Zoom máximo detalle
              />
            </div>
          </div>

          {/* Estadísticas después de procesar */}
          {showStats && processedTrack && (
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <CheckCircle2 className="text-green-500" size={20} />
                  Ruta Procesada
                </h3>
                <TrackQualityBadge quality={quality} />
              </div>

              <TrackStats
                distance={processedTrack.distanceKm}
                pointsCount={processedTrack.points.length}
                filteredCount={processedTrack.filteredCount}
              />

              {processedTrack.elevationGainM !== undefined && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-500/10 rounded-lg p-3 border border-green-500/20">
                    <p className="text-xs text-green-400 mb-1">Desnivel positivo</p>
                    <p className="text-xl font-bold text-white">
                      +{processedTrack.elevationGainM.toFixed(0)} m
                    </p>
                  </div>
                  <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/20">
                    <p className="text-xs text-red-400 mb-1">Desnivel negativo</p>
                    <p className="text-xl font-bold text-white">
                      -{processedTrack.elevationLossM.toFixed(0)} m
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Columna derecha - Formulario y controles */}
        <div className="space-y-4">
          {/* Controles de dibujo */}
          <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <Navigation className="text-amber-500" size={20} />
              Herramientas
            </h3>

            {!isDrawing ? (
              <button
                onClick={startDrawing}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <MapPin size={20} />
                Comenzar a Dibujar
              </button>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-slate-800 rounded-lg">
                  <p className="text-sm text-gray-300 mb-2">Estado:</p>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      !startPoint ? 'bg-green-500 animate-pulse' :
                      !endPoint ? 'bg-red-500 animate-pulse' :
                      'bg-blue-500'
                    }`} />
                    <span className="text-sm">
                      {!startPoint && 'Selecciona punto de partida'}
                      {startPoint && !endPoint && 'Selecciona punto de llegada'}
                      {startPoint && endPoint && 'Agrega puntos intermedios'}
                    </span>
                  </div>
                </div>

                <div className="text-center py-2 bg-slate-800 rounded-lg">
                  <p className="text-sm text-gray-400">Puntos trazados</p>
                  <p className="text-2xl font-bold text-white">{allPointsCount}</p>
                </div>

                {canProcess && !processedTrack && (
                  <button
                    onClick={handleProcess}
                    disabled={isProcessing}
                    className="w-full py-3 bg-green-500 hover:bg-green-400 disabled:bg-gray-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="animate-spin" size={20} />
                        Procesando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={20} />
                        Procesar Ruta
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Formulario de información */}
          <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800 space-y-4">
            <h3 className="font-semibold text-white mb-2">Información de la Ruta</h3>

            {/* Nombre */}
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

            {/* Descripción */}
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
                  <Eye className="text-green-400" size={20} />
                ) : (
                  <EyeOff className="text-gray-400" size={20} />
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

            {/* Distancia estimada */}
            {allPointsCount > 1 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-sm text-amber-400 mb-1">Distancia estimada</p>
                <p className="text-2xl font-bold text-white">
                  {getEstimatedDistance().toFixed(2)} km
                </p>
              </div>
            )}
          </div>

          {/* Errores */}
          {(errors.length > 0 || validationErrors.length > 0) && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle size={20} />
                <p className="font-semibold">Errores</p>
              </div>
              <ul className="text-sm text-red-300 space-y-1">
                {[...errors, ...validationErrors].map((error, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span>•</span>
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Botón guardar */}
          {processedTrack && (
            <button
              onClick={handleSave}
              disabled={!canSave || isSaving}
              className="w-full py-4 bg-amber-500 hover:bg-amber-400 disabled:bg-gray-600 text-slate-900 font-bold rounded-xl transition-colors flex items-center justify-center gap-2 text-lg"
            >
              {isSaving ? (
                <>
                  <Loader2 className="animate-spin" size={24} />
                  Guardando...
                </>
              ) : (
                <>
                  <Save size={24} />
                  Guardar Ruta
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
