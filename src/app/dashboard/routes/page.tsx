'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/core/infrastructure/supabase/client'
import { SupabaseRouteRepository } from '@/core/infrastructure/repositories/SupabaseRouteRepository'
import { Route } from '@/core/domain/Route'
import {
  Plus,
  MapPin,
  TrendingUp,
  Mountain,
  Clock,
  MoreVertical,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  Navigation,
} from 'lucide-react'

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const config: Record<string, { color: string; label: string; icon: string }> = {
    Beginner: { color: 'bg-green-500/20 text-green-400 border-green-500/30', label: 'Principiante', icon: '🟢' },
    Intermediate: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', label: 'Intermedio', icon: '🔵' },
    Expert: { color: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'Experto', icon: '🔴' },
  }

  const { color, label, icon } = config[difficulty] || config.Beginner

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${color}`}>
      {icon} {label}
    </span>
  )
}

function RouteCard({
  route,
  onDelete,
  onToggleVisibility,
}: {
  route: Route
  onDelete: (id: string) => void
  onToggleVisibility: (id: string, isPublic: boolean) => void
}) {
  const [showMenu, setShowMenu] = useState(false)

  return (
    <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden hover:border-slate-700 transition-colors">
      {/* Header con imagen o mapa placeholder */}
      <div className="h-32 bg-gradient-to-br from-amber-500/20 to-slate-800 relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <MapPin className="text-amber-500/50" size={48} />
        </div>
        
        {/* Badge de visibilidad */}
        <div className="absolute top-3 right-3">
          {route.isPublic ? (
            <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs flex items-center gap-1">
              <Eye size={12} />
              Pública
            </span>
          ) : (
            <span className="px-2 py-1 bg-slate-700 text-gray-400 rounded-full text-xs flex items-center gap-1">
              <EyeOff size={12} />
              Privada
            </span>
          )}
        </div>
      </div>

      {/* Contenido */}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white truncate">{route.name}</h3>
            {route.description && (
              <p className="text-sm text-gray-400 truncate mt-1">{route.description}</p>
            )}
          </div>

          {/* Menú */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <MoreVertical size={16} className="text-gray-400" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-10 min-w-[150px]">
                <button
                  onClick={() => {
                    onToggleVisibility(route.id, !route.isPublic)
                    setShowMenu(false)
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-700 flex items-center gap-2"
                >
                  {route.isPublic ? <EyeOff size={16} /> : <Eye size={16} />}
                  {route.isPublic ? 'Hacer privada' : 'Hacer pública'}
                </button>
                <button
                  onClick={() => {
                    // TODO: Implementar edición
                    setShowMenu(false)
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-700 flex items-center gap-2"
                >
                  <Edit2 size={16} />
                  Editar
                </button>
                <button
                  onClick={() => {
                    onDelete(route.id)
                    setShowMenu(false)
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-red-500/20 text-red-400 flex items-center gap-2"
                >
                  <Trash2 size={16} />
                  Eliminar
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <DifficultyBadge difficulty={route.difficulty} />
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-amber-400 mb-1">
              <TrendingUp size={14} />
            </div>
            <p className="text-sm font-bold text-white">{route.distanceKm.toFixed(2)}</p>
            <p className="text-xs text-gray-400">km</p>
          </div>
          <div className="text-center border-l border-slate-800">
            <div className="flex items-center justify-center gap-1 text-green-400 mb-1">
              <Mountain size={14} />
            </div>
            <p className="text-sm font-bold text-white">
              {route.elevationGainM ? `+${route.elevationGainM.toFixed(0)}` : '-'}
            </p>
            <p className="text-xs text-gray-400">m ↑</p>
          </div>
          <div className="text-center border-l border-slate-800">
            <div className="flex items-center justify-center gap-1 text-blue-400 mb-1">
              <Clock size={14} />
            </div>
            <p className="text-sm font-bold text-white">-</p>
            <p className="text-xs text-gray-400">record</p>
          </div>
        </div>

        {/* Ver ruta en mapa */}
        <Link
          href={`/dashboard/routes/${route.id}`}
          className="block w-full py-2 bg-slate-800 hover:bg-slate-700 text-center text-sm font-medium rounded-lg transition-colors"
        >
          Ver detalles
        </Link>
      </div>
    </div>
  )
}

export default function RoutesPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [routes, setRoutes] = useState<Route[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const repository = new SupabaseRouteRepository()

  // Cargar usuario
  useEffect(() => {
    const loadUser = async () => {
      const supabase = createClient()
      const { data: { user: supaUser } } = await supabase.auth.getUser()

      if (supaUser) {
        setUser({ id: supaUser.id })
      }
    }

    loadUser()
  }, [])

  // Cargar rutas
  useEffect(() => {
    if (!user) return

    const loadRoutes = async () => {
      try {
        setIsLoading(true)
        const userRoutes = await repository.getUserRoutes(user.id)
        setRoutes(userRoutes)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error cargando rutas')
      } finally {
        setIsLoading(false)
      }
    }

    loadRoutes()
  }, [user])

  // Eliminar ruta
  const handleDelete = async (routeId: string) => {
    if (!confirm('¿Estás seguro de eliminar esta ruta?')) return

    try {
      await repository.deleteRoute(routeId)
      setRoutes((prev) => prev.filter((r) => r.id !== routeId))
    } catch (err) {
      alert('Error eliminando la ruta')
    }
  }

  // Cambiar visibilidad
  const handleToggleVisibility = async (routeId: string, isPublic: boolean) => {
    try {
      await repository.updateRoute(routeId, { isPublic })
      setRoutes((prev) =>
        prev.map((r) => (r.id === routeId ? { ...r, isPublic } : r))
      )
    } catch (err) {
      alert('Error actualizando la ruta')
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

  return (
    <div className="min-h-screen bg-[#1c2327] text-slate-100">
      {/* Header */}
      <header className="bg-slate-900/50 backdrop-blur-sm border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Mis Rutas</h1>
              <p className="text-sm text-gray-400 mt-1">
                {routes.length} {routes.length === 1 ? 'ruta' : 'rutas'} creadas
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/routes/record"
                className="px-4 py-2 bg-green-500 hover:bg-green-400 text-slate-900 font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <Navigation size={18} />
                Grabar
              </Link>
              <Link
                href="/dashboard/routes/create"
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <Plus size={18} />
                Crear Ruta
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="max-w-7xl mx-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-amber-500" size={40} />
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
            <p className="text-red-400">{error}</p>
          </div>
        ) : routes.length === 0 ? (
          <div className="text-center py-20">
            <MapPin className="mx-auto text-gray-600 mb-4" size={64} />
            <h2 className="text-xl font-semibold text-white mb-2">
              No tienes rutas creadas
            </h2>
            <p className="text-gray-400 mb-6">
              Crea tu primera ruta dibujándola en el mapa o grabándola en tiempo real
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link
                href="/dashboard/routes/create"
                className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <Plus size={20} />
                Crear Ruta
              </Link>
              <Link
                href="/dashboard/routes/record"
                className="px-6 py-3 bg-green-500 hover:bg-green-400 text-slate-900 font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <Navigation size={20} />
                Grabar Ruta
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {routes.map((route) => (
              <RouteCard
                key={route.id}
                route={route}
                onDelete={handleDelete}
                onToggleVisibility={handleToggleVisibility}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
