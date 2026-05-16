'use client'

import type { Route } from '@/core/domain/Route'
import { Search, ChevronRight } from 'lucide-react'
import { BrandSpinner } from '@/components/ui/BrandLogoLoader'

type Props = {
  isRecording: boolean
  showRoutePresetLoading: boolean
  showRecordRouteSearch: boolean
  recordingPickQuery: string
  onRecordingPickQueryChange: (value: string) => void
  onPickFocus: () => void
  onPickBlur: () => void
  recordingPickFocused: boolean
  routesLoading: boolean
  recordingPickList: Route[]
  onPickRoute: (route: Route) => void
  recordingSearchBusy: boolean
  onOpenRouteSetup: () => void
  showCompactRouteBand: boolean
  selectedRouteForPreview: Route | null
  onChangeSelectedRoute: () => void
  recordingEntryFromDetail: boolean
  urlRecordRouteId: string | null
  onNuevaRutaLibre: () => void
  newRouteSelectedName: string | null
  onEditNewRouteName: () => void
}

export function RecordRouteSelectionPanel({
  isRecording,
  showRoutePresetLoading,
  showRecordRouteSearch,
  recordingPickQuery,
  onRecordingPickQueryChange,
  onPickFocus,
  onPickBlur,
  recordingPickFocused,
  routesLoading,
  recordingPickList,
  onPickRoute,
  recordingSearchBusy,
  onOpenRouteSetup,
  showCompactRouteBand,
  selectedRouteForPreview,
  onChangeSelectedRoute,
  recordingEntryFromDetail,
  urlRecordRouteId,
  onNuevaRutaLibre,
  newRouteSelectedName,
  onEditNewRouteName,
}: Props) {
  if (isRecording) return null

  return (
    <div className="relative z-[598] shrink-0 border-b border-white/10 bg-[#161a20]/98 px-3 py-3">
      {showRoutePresetLoading && (
        <div className="mx-auto flex max-w-4xl items-center justify-center gap-2 py-4 text-sm text-slate-400">
          <BrandSpinner size={20} />
          Preparando ruta para grabar…
        </div>
      )}

      {showRecordRouteSearch && (
        <>
          <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-start sm:gap-2">
            <div className="relative min-w-0 flex-1">
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Buscar ruta
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"
                  aria-hidden
                />
                <input
                  type="search"
                  value={recordingPickQuery}
                  onChange={(e) => onRecordingPickQueryChange(e.target.value)}
                  onFocus={onPickFocus}
                  onBlur={onPickBlur}
                  placeholder="Nombre de la ruta…"
                  className="w-full rounded-xl border border-white/10 bg-[#0d1114] py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-gdh-brand/50 focus:outline-none"
                />
              </div>
              {recordingPickFocused && (
                <div className="absolute left-0 right-0 top-full z-[610] mt-1 max-h-52 overflow-y-auto rounded-xl border border-white/10 bg-[#0d1114] shadow-xl">
                  {routesLoading ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
                      <BrandSpinner size={20} /> Cargando rutas…
                    </div>
                  ) : recordingPickList.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-500">
                      {recordingPickQuery.trim()
                        ? 'Sin resultados'
                        : 'Escribe para buscar o elige entre las cargadas'}
                    </p>
                  ) : (
                    recordingPickList.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => onPickRoute(r)}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm text-slate-200 first:rounded-t-xl last:rounded-b-xl hover:bg-white/10"
                      >
                        <span className="min-w-0 truncate font-medium">{r.name}</span>
                        <ChevronRight className="shrink-0 text-slate-500" size={18} aria-hidden />
                      </button>
                    ))
                  )}
                  {recordingSearchBusy && (
                    <div className="flex items-center justify-center gap-2 border-t border-white/5 py-2 text-xs text-slate-500">
                      <BrandSpinner size={16} /> Buscando…
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mx-auto mt-1 flex max-w-4xl justify-center sm:justify-end">
            <button
              type="button"
              onClick={onOpenRouteSetup}
              className="text-[11px] font-medium text-slate-500 underline-offset-2 hover:text-gdh-brand-highlight hover:underline sm:text-xs"
            >
              Vista previa, distancia al inicio y vías OSM…
            </button>
          </div>
        </>
      )}

      {showCompactRouteBand && selectedRouteForPreview && (
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 flex-1 text-sm">
            <span className="text-slate-500">Ruta </span>
            <span className="font-semibold text-gdh-brand-highlight">{selectedRouteForPreview.name}</span>
          </p>
          <button
            type="button"
            onClick={onChangeSelectedRoute}
            className="shrink-0 text-sm font-medium text-gdh-brand-highlight hover:underline"
          >
            Cambiar de ruta
          </button>
        </div>
      )}

      {!recordingEntryFromDetail && !urlRecordRouteId && selectedRouteForPreview && (
        <div className="mx-auto mt-3 flex max-w-4xl flex-wrap items-center gap-2 border-t border-white/5 pt-3">
          <p className="min-w-0 flex-1 text-sm">
            <span className="text-slate-500">Elegiste: </span>
            <span className="font-semibold text-gdh-brand-highlight">{selectedRouteForPreview.name}</span>
          </p>
          <button
            type="button"
            onClick={onNuevaRutaLibre}
            className="shrink-0 text-sm font-medium text-gdh-brand-highlight hover:underline"
          >
            Quitar selección
          </button>
        </div>
      )}

      {!selectedRouteForPreview && newRouteSelectedName && (
        <div className="mx-auto mt-3 flex max-w-4xl flex-wrap items-center gap-2 border-t border-white/5 pt-3">
          <p className="min-w-0 flex-1 text-sm">
            <span className="text-slate-500">Nueva ruta: </span>
            <span className="font-semibold text-gdh-brand-highlight">{newRouteSelectedName}</span>
          </p>
          <button
            type="button"
            onClick={onEditNewRouteName}
            className="shrink-0 text-sm font-medium text-gdh-brand-highlight hover:underline"
          >
            Editar nombre
          </button>
        </div>
      )}
    </div>
  )
}
