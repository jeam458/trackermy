'use client'

import { ChevronRight } from 'lucide-react'

export function EntryChoiceModal({
  open,
  onClose,
  onNuevaRutaLibre,
  onNewRoute,
  onSelectExisting,
  /** Por encima del bottom nav del dashboard (portal con z-index muy alto). */
  overlayZIndex,
}: {
  open: boolean
  onClose: () => void
  onNuevaRutaLibre: () => void
  onNewRoute: () => void
  onSelectExisting: () => void
  overlayZIndex?: number
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 flex items-end justify-center bg-black/65 p-3 backdrop-blur-sm sm:items-center sm:p-4"
      style={{ zIndex: overlayZIndex ?? 10045 }}
      role="dialog" aria-modal="true" aria-labelledby="record-entry-choice-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#161a20] p-4 shadow-2xl">
        <h3 id="record-entry-choice-title" className="text-base font-semibold text-white">
          ¿Cómo quieres empezar la bajada?
        </h3>
        <p className="mt-1 text-xs text-slate-400">
          Elige un modo y luego pulsa <span className="text-slate-300">Iniciar ruta</span> cuando estés listo.
        </p>
        <div className="mt-4 space-y-2.5">
          <button type="button" onClick={onNuevaRutaLibre}
            className="flex w-full items-center justify-between rounded-xl border border-gdh-sun/35 bg-gdh-sun/10 px-3 py-3 text-left hover:bg-gdh-sun/15"
          >
            <span>
              <span className="block text-sm font-semibold text-gdh-sun">Ruta libre</span>
              <span className="block text-xs text-gdh-sun/80">Sin nombre obligatorio, guardado automático.</span>
            </span>
            <ChevronRight size={18} className="text-gdh-sun" />
          </button>
          <button type="button" onClick={onNewRoute}
            className="flex w-full items-center justify-between rounded-xl border border-gdh-brand/35 bg-gdh-brand/10 px-3 py-3 text-left hover:bg-gdh-brand/15"
          >
            <span>
              <span className="block text-sm font-semibold text-white">Nueva ruta</span>
              <span className="block text-xs text-slate-300/90">Define nombre y descripción desde cero.</span>
            </span>
            <ChevronRight size={18} className="text-gdh-brand-highlight" />
          </button>
          <button type="button" onClick={onSelectExisting}
            className="flex w-full items-center justify-between rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-left hover:bg-white/10"
          >
            <span>
              <span className="block text-sm font-semibold text-slate-100">Seleccionar ruta existente</span>
              <span className="block text-xs text-slate-400">Buscar una ruta y registrar intento.</span>
            </span>
            <ChevronRight size={18} className="text-slate-400" />
          </button>
        </div>
        <button type="button" onClick={onClose}
          className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 hover:bg-white/10"
        >
          Cerrar
        </button>
      </div>
    </div>
  )
}
