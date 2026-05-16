'use client'

import { X, PlusCircle } from 'lucide-react'

export function CreateRouteModal({
  open,
  onClose,
  name,
  onNameChange,
  description,
  onDescriptionChange,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  name: string
  onNameChange: (v: string) => void
  description: string
  onDescriptionChange: (v: string) => void
  onCreate: () => void
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[10060] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      role="dialog" aria-modal="true" aria-labelledby="new-route-modal-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#161a20] p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 id="new-route-modal-title" className="text-base font-semibold text-white">Crear nueva ruta</h3>
          <button type="button" onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
          ><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Nombre de la ruta *</label>
            <input type="text" value={name} onChange={(e) => onNameChange(e.target.value)}
              placeholder="Ej: Bajada Casa-laguna" autoFocus
              className="w-full rounded-xl border border-white/10 bg-[#0d1114] px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-gdh-brand/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Descripción (opcional)</label>
            <textarea value={description} onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="Describe la ruta, terreno o recomendaciones." rows={3}
              className="w-full resize-y rounded-xl border border-white/10 bg-[#0d1114] px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-gdh-brand/50 focus:outline-none"
            />
          </div>
          <button type="button" onClick={onCreate} disabled={!name.trim()}
            className="mt-1 flex min-h-[3rem] w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-gdh-brand to-gdh-brand-muted px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[0_8px_24px_rgba(197,90,47,0.35)] [text-shadow:0_1px_2px_rgba(0,0,0,0.35)] hover:from-gdh-brand-highlight hover:to-gdh-brand disabled:opacity-50"
          >
            <PlusCircle size={18} /> Crear
          </button>
        </div>
      </div>
    </div>
  )
}
