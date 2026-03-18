import { Route } from './RouteSelectionModal'
import { Plus, MapPin } from 'lucide-react'

interface PreferredRoutesProps {
  selectedRoutes: Route[]
  isEditing: boolean
  onAddRouteClick: () => void
}

export function PreferredRoutes({ selectedRoutes, isEditing, onAddRouteClick }: PreferredRoutesProps) {
  return (
    <section className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-lg text-slate-100 flex items-center gap-2">
            Rutas Preferidas
          </h3>
          <p className="text-sm text-slate-400 mt-1">Tus circuitos locales favoritos</p>
        </div>
        {isEditing && (
          <button
            onClick={onAddRouteClick}
            className="p-2 bg-amber-500/20 text-amber-500 rounded-xl hover:bg-amber-500/30 transition-colors"
            title="Agregar ruta"
          >
            <Plus size={20} />
          </button>
        )}
      </div>

      <div className="space-y-3">
        {selectedRoutes.length === 0 ? (
          <div className="text-center p-6 border-2 border-dashed border-slate-700/50 rounded-2xl bg-slate-800/30">
            <p className="text-slate-500 text-sm">No has seleccionado tutas preferidas aún.</p>
            {isEditing && (
              <button 
                onClick={onAddRouteClick}
                className="mt-3 text-amber-500 text-sm font-medium hover:underline"
              >
                + Buscar rutas cercanas
              </button>
            )}
          </div>
        ) : (
          selectedRoutes.map((route) => (
            <div
              key={route.id}
              className="flex items-center gap-4 bg-[#2A3439]/60 p-4 rounded-xl border border-slate-700/50 backdrop-blur-sm"
            >
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 shrink-0">
                 <MapPin size={20} />
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-slate-100 text-base truncate">
                  {route.name}
                </h4>
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  {route.difficulty} • {route.distance} • {route.location}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
