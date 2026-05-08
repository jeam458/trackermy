'use client'

import { AlertCircle, Save, Trash2 } from 'lucide-react'
import { RecordedTrackOverview } from '@/components/routes/RecordedTrackOverview'
import { BrandSpinner } from '@/components/ui/BrandLogoLoader'
import { formatDistance, formatTime, type MapPoint } from '@/hooks/useGPSRecorder'
import { defaultSnapTogglesForTrackType } from '@/lib/trackSnapPipeline'
import type { RouteTrackType } from '@/core/domain/Route'

type Props = {
  show: boolean
  saveContext: 'new' | { routeId: string }
  distanceM: number
  elapsedTime: number
  points: MapPoint[]
  trackType: RouteTrackType
  onTrackTypeChange: (t: RouteTrackType) => void
  routeName: string
  onRouteNameChange: (value: string) => void
  routeDescription: string
  onRouteDescriptionChange: (value: string) => void
  useOsmRoadSnap: boolean
  onUseOsmRoadSnapChange: (value: boolean) => void
  useOsmTrailSnap: boolean
  onUseOsmTrailSnapChange: (value: boolean) => void
  saveError: string | null
  isSaving: boolean
  onCancel: () => void
  onSave: () => void
}

export function RecordSaveModal({
  show,
  saveContext,
  distanceM,
  elapsedTime,
  points,
  trackType,
  onTrackTypeChange,
  routeName,
  onRouteNameChange,
  routeDescription,
  onRouteDescriptionChange,
  useOsmRoadSnap,
  onUseOsmRoadSnapChange,
  useOsmTrailSnap,
  onUseOsmTrailSnapChange,
  saveError,
  isSaving,
  onCancel,
  onSave,
}: Props) {
  if (!show) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[2147483646] p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 rounded-2xl p-4 sm:p-6 w-full max-w-2xl max-h-[min(95vh,900px)] overflow-y-auto border border-slate-800 my-auto">
        <h2 className="text-xl font-bold text-white mb-3">
          {saveContext !== 'new' ? 'Guardar intento' : 'Guardar ruta nueva'}
        </h2>

        <div className="space-y-4">
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

          {points.length > 0 && (
            <RecordedTrackOverview points={points} totalElapsedSec={elapsedTime} totalDistanceM={distanceM} />
          )}

          {saveContext === 'new' && (
            <>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Tipo de trazado *</label>
                <select
                  value={trackType}
                  onChange={(e) => {
                    const t = e.target.value as RouteTrackType
                    const d = defaultSnapTogglesForTrackType(t)
                    onTrackTypeChange(t)
                    onUseOsmRoadSnapChange(d.useOsmRoad)
                    onUseOsmTrailSnapChange(d.useOsmTrail)
                  }}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-white"
                >
                  <option value="trail">Senda, trocha o DH (blando)</option>
                  <option value="pavement">Carretera o pavimento</option>
                  <option value="mixed">Mixto (tramos de ambos)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Nombre de la ruta (opcional)</label>
                <input
                  type="text"
                  value={routeName}
                  onChange={(e) => onRouteNameChange(e.target.value)}
                  placeholder="Opcional. Si lo dejas vacío usamos un nombre sugerido automático."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-white"
                  autoFocus
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Ejemplo sugerido: <span className="text-slate-400">Ruta libre 08/05 12:53</span>
                </p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Descripción (opcional)</label>
                <textarea
                  value={routeDescription}
                  onChange={(e) => onRouteDescriptionChange(e.target.value)}
                  rows={3}
                  placeholder="Ej: Bajada técnica con piedras sueltas en el tramo medio."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-white"
                />
              </div>
              <div className="space-y-2 p-3 bg-slate-800/80 rounded-lg border border-slate-700">
                <p className="text-sm font-medium text-white">Ajuste GPS a OpenStreetMap</p>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useOsmRoadSnap}
                    onChange={(e) => onUseOsmRoadSnapChange(e.target.checked)}
                    className="mt-1 rounded border-slate-600 text-amber-500 focus:ring-amber-500"
                  />
                  <span className="text-sm text-gray-300">Vía pavimentada (autopista, calle)</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useOsmTrailSnap}
                    onChange={(e) => onUseOsmTrailSnapChange(e.target.checked)}
                    className="mt-1 rounded border-slate-600 text-amber-500 focus:ring-amber-500"
                  />
                  <span className="text-sm text-gray-300">Senda / camino mapeado (OSM)</span>
                </label>
              </div>
            </>
          )}

          {saveError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={18} />
              <p className="text-sm text-red-300">{saveError}</p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={onCancel}
              className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 size={18} />
              Descartar
            </button>
            <button
              onClick={onSave}
              disabled={isSaving}
              className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 disabled:bg-gray-600 text-slate-900 font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <BrandSpinner size={18} />
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
  )
}
