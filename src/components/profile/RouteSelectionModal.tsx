'use client'

import { useEffect, useState } from 'react'
import { MapPin, X, Check, Loader2 } from 'lucide-react'
import { RoutePreviewRepository, SimpleRoute } from '@/core/infrastructure/repositories/RoutePreviewRepository'

export interface Route {
  id: string
  name: string
  difficulty: 'Beginner' | 'Intermediate' | 'Expert'
  distance: string
  location: string
}

interface RouteSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  selectedRouteIds: string[]
  onToggleRoute: (routeId: string) => void
}

const repository = new RoutePreviewRepository()

export function RouteSelectionModal({
  isOpen,
  onClose,
  selectedRouteIds,
  onToggleRoute,
}: RouteSelectionModalProps) {
  const [availableRoutes, setAvailableRoutes] = useState<Route[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Cargar rutas cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      loadRoutes()
    }
  }, [isOpen])

  const loadRoutes = async () => {
    setIsLoading(true)
    try {
      const routes = await repository.getPublicRoutes(50)
      
      // Convertir a formato Route
      const formattedRoutes: Route[] = routes.map(route => ({
        id: route.id,
        name: route.name,
        difficulty: route.difficulty,
        distance: `${route.distanceKm.toFixed(2)} km`,
        location: 'Cusco, Perú', // Por defecto, todas son de Cusco
      }))
      
      setAvailableRoutes(formattedRoutes)
    } catch (error) {
      console.error('Error loading routes:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1e2529] w-full max-w-md rounded-3xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-[#2A3439]">
          <div>
            <h3 className="font-bold text-lg text-slate-100">Rutas Cercanas</h3>
            <p className="text-xs text-slate-400">
              {isLoading ? 'Cargando...' : `${availableRoutes.length} rutas disponibles`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* List of routes */}
        <div className="overflow-y-auto p-4 space-y-3 flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-amber-500" size={32} />
            </div>
          ) : availableRoutes.length === 0 ? (
            <div className="text-center py-12">
              <MapPin className="mx-auto text-slate-600 mb-4" size={48} />
              <p className="text-slate-400">No hay rutas disponibles</p>
            </div>
          ) : (
            availableRoutes.map((route) => {
              const isSelected = selectedRouteIds.includes(route.id)
              return (
                <button
                  key={route.id}
                  onClick={() => onToggleRoute(route.id)}
                  className={`w-full text-left flex items-center p-3 rounded-2xl border transition-all ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500/50'
                      : 'bg-[#2A3439] border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <div className="flex-1">
                    <h4 className={`font-semibold ${isSelected ? 'text-amber-400' : 'text-slate-200'}`}>
                      {route.name}
                    </h4>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <MapPin size={12} /> {route.location}
                      </span>
                      <span>•</span>
                      <span>{route.difficulty}</span>
                      <span>•</span>
                      <span>{route.distance}</span>
                    </div>
                  </div>

                  {/* Selection Indicator */}
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center border ${
                      isSelected
                        ? 'bg-amber-500 border-amber-500 text-[#1e2529]'
                        : 'border-slate-600 border-dashed'
                    }`}
                  >
                    {isSelected && <Check size={14} strokeWidth={3} />}
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 bg-[#2A3439]">
          <button
            onClick={onClose}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-[#1e2529] font-bold rounded-xl transition-colors"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  )
}
