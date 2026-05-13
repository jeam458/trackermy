'use client'

import { Search, X, MapPinned, ChevronRight } from 'lucide-react'
import { BrandSpinner } from '@/components/ui/BrandLogoLoader'
import type { Route } from '@/core/domain/Route'
import dynamic from 'next/dynamic'

const SelectedRoutePreviewMap = dynamic(
  () => import('@/components/routes/SelectedRoutePreviewMap').then((m) => ({ default: m.SelectedRoutePreviewMap })),
  { ssr: false, loading: () => <div className="h-32 rounded-xl border border-white/10 bg-gdh-card flex items-center justify-center text-sm text-slate-500">Cargando vista previa del mapa…</div> }
)

const PROXIMITY_START_M = 100

export function RouteSetupPanel({
  open,
  existingOnly,
  onClose,
  recordingPickQuery,
  onRecordingPickQueryChange,
  routesLoading,
  recordingPickList,
  onPickRoute,
  recordingSearchBusy,
  selectedRouteForPreview,
  distanceToStartM,
  checkingPosition,
  onRefreshDistance,
  onNuevaRutaLibre,
  onCreateRoute,
  onLoadOsmWays,
  osmMapLoading,
  osmMapError,
  mapBootstrapPos,
  onDownloadOfflineTiles,
  tileDownloadBusy,
  tileDownloadProgress,
  offlineTileRegionsCount,
}: {
  open: boolean
  existingOnly: boolean
  onClose: () => void
  recordingPickQuery: string
  onRecordingPickQueryChange: (v: string) => void
  routesLoading: boolean
  recordingPickList: Route[]
  onPickRoute: (r: Route) => void
  recordingSearchBusy: boolean
  selectedRouteForPreview: Route | null
  distanceToStartM: number | null
  checkingPosition: boolean
  onRefreshDistance: () => void
  onNuevaRutaLibre: () => void
  onCreateRoute: () => void
  onLoadOsmWays: () => void
  osmMapLoading: boolean
  osmMapError: string | null
  mapBootstrapPos: [number, number] | null
  onDownloadOfflineTiles: () => void
  tileDownloadBusy: boolean
  tileDownloadProgress: { done: number; total: number } | null
  offlineTileRegionsCount: number
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[10030] flex flex-col justify-end bg-black/60 backdrop-blur-sm sm:justify-center sm:p-4"
      role="dialog" aria-modal="true" aria-labelledby="route-setup-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="mx-auto mb-0 flex max-h-[min(88vh,780px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-white/15 bg-[#161a20] shadow-2xl sm:mb-0 sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <h2 id="route-setup-title" className="text-base font-semibold text-white">
            {existingOnly ? 'Seleccionar ruta existente' : '¿Qué ruta deseas recorrer?'}
          </h2>
          <button type="button" onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
          ><X size={20} /></button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {!existingOnly && (
            <>
              <button type="button" onClick={onCreateRoute}
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-teal-500/30 bg-teal-500/10 px-4 py-3 text-left transition hover:bg-teal-500/15"
              >
                <span className="font-medium text-teal-100">Nueva ruta libre</span>
                <ChevronRight className="shrink-0 text-teal-400" size={20} />
              </button>
              <div className="rounded-xl border border-white/10 bg-[#12161c] p-3">
                <p className="mb-2 text-xs text-slate-400">
                  Opcional: descargar vías OSM para &ldquo;nueva ruta&rdquo; en la zona donde está centrado el mapa (usa primero{' '}
                  <span className="text-teal-300">Centrar mapa en mi GPS</span>).
                </p>
                <button type="button" disabled={osmMapLoading || !mapBootstrapPos} onClick={onLoadOsmWays}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15 disabled:opacity-45"
                >
                  {osmMapLoading ? <BrandSpinner size={20} /> : <MapPinned className="size-5 shrink-0" />}
                  Descargar vías en el área
                </button>
                {osmMapError && <p className="mt-2 text-xs text-amber-200">{osmMapError}</p>}
              </div>
              <div className="rounded-xl border border-white/10 bg-[#12161c] p-3">
                <p className="mb-2 text-xs text-slate-400">
                  Modo sin señal: descarga tiles del mapa para esta zona/ruta.
                </p>
                <button type="button" disabled={tileDownloadBusy || (!mapBootstrapPos && !selectedRouteForPreview)}
                  onClick={onDownloadOfflineTiles}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600/85 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-45"
                >
                  {tileDownloadBusy ? <BrandSpinner size={18} /> : <MapPinned className="size-5 shrink-0" />}
                  {tileDownloadBusy ? 'Descargando tiles…' : 'Descargar mapa offline'}
                </button>
                {tileDownloadProgress && (
                  <p className="mt-2 text-xs text-teal-200/90">Progreso: {tileDownloadProgress.done}/{tileDownloadProgress.total}</p>
                )}
                <p className="mt-1 text-[11px] text-slate-500">Zonas offline guardadas: {offlineTileRegionsCount}</p>
              </div>
            </>
          )}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Buscar ruta publicada o tuya</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              <input type="search" value={recordingPickQuery} onChange={(e) => onRecordingPickQueryChange(e.target.value)}
                placeholder="Nombre de la ruta…"
                className="w-full rounded-xl border border-white/10 bg-[#0d1114] py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-teal-500/50 focus:outline-none"
              />
            </div>
            <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-xl border border-white/5 bg-[#0d1114] p-1">
              {routesLoading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500"><BrandSpinner size={20} /> Cargando rutas…</div>
              ) : recordingPickList.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-500">
                  {recordingPickQuery.trim() ? 'Sin resultados' : 'No hay rutas disponibles'}
                </p>
              ) : (
                recordingPickList.map((r) => (
                  <button key={r.id} type="button" onClick={() => onPickRoute(r)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-slate-200 hover:bg-white/10"
                  >
                    <span className="min-w-0 truncate font-medium">{r.name}</span>
                    <ChevronRight className="shrink-0 text-slate-500" size={18} />
                  </button>
                ))
              )}
              {recordingSearchBusy && (
                <div className="flex items-center justify-center gap-2 py-2 text-xs text-slate-500"><BrandSpinner size={16} /> Buscando…</div>
              )}
            </div>
          </div>
          {!existingOnly && selectedRouteForPreview && (
            <div className="space-y-3 border-t border-white/10 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-white">Ruta seleccionada</p>
                <button type="button" onClick={onRefreshDistance} disabled={checkingPosition}
                  className="text-xs font-medium text-teal-300 underline-offset-2 hover:underline disabled:opacity-50"
                >
                  {checkingPosition ? 'Midiendo…' : 'Actualizar distancia al inicio'}
                </button>
              </div>
              <SelectedRoutePreviewMap route={selectedRouteForPreview} className="h-40 w-full overflow-hidden rounded-xl border border-white/10" />
              <p className="text-xs text-slate-400">
                Debes estar a ≤ {PROXIMITY_START_M} m del inicio para poder{' '}
                <span className="text-slate-200">Iniciar ruta</span>.
                {distanceToStartM != null && (
                  <> Ahora: <strong className="text-teal-200">{Math.round(distanceToStartM)} m</strong></>
                )}
                {distanceToStartM != null && distanceToStartM > PROXIMITY_START_M && (
                  <span className="block pt-1 text-amber-200/90">Acércate al punto de salida o elige otra ruta.</span>
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
