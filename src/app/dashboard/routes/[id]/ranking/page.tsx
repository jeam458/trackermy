'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/core/infrastructure/supabase/client'
import {
  Trophy,
  Medal,
  Clock,
  Gauge,
  TrendingUp,
  ArrowLeft,
  Loader2,
  Crown,
  Star,
  Zap,
} from 'lucide-react'

interface RankingEntry {
  rank: number
  user_id: string
  user_name: string
  avatar_url: string | null
  total_time: number
  max_speed: number
  avg_speed: number
  overall_score: number
  completed_at: string
  is_personal_best: boolean
}

interface RouteData {
  id: string
  name: string
  distance_km: number
}

// Formatear tiempo
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 100)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
}

// Formatear velocidad
function formatSpeed(ms: number): string {
  const kmh = ms * 3.6
  return `${kmh.toFixed(1)} km/h`
}

// Formatear fecha
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Medalla según posición
function getMedal(rank: number) {
  switch (rank) {
    case 1:
      return { icon: Crown, color: 'text-yellow-400', bg: 'bg-yellow-500/20' }
    case 2:
      return { icon: Medal, color: 'text-gray-400', bg: 'bg-gray-400/20' }
    case 3:
      return { icon: Medal, color: 'text-amber-600', bg: 'bg-amber-600/20' }
    default:
      return { icon: Star, color: 'text-gray-500', bg: 'bg-gray-500/10' }
  }
}

export default function RouteRankingPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [routeId, setRouteId] = useState<string | null>(null)
  const [route, setRoute] = useState<RouteData | null>(null)
  const [ranking, setRanking] = useState<RankingEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  // Obtener routeId
  useEffect(() => {
    params.then(p => setRouteId(p.id))
  }, [params])

  // Cargar ranking
  useEffect(() => {
    if (!routeId) return

    const loadRanking = async () => {
      try {
        const supabase = createClient()

        // Cargar ruta
        const { data: routeData } = await supabase
          .from('routes')
          .select('id, name, distance_km')
          .eq('id', routeId)
          .single()

        if (routeData) setRoute(routeData)

        // Cargar ranking
        const limit = 10
        const { data: attemptsData, error } = await supabase
          .from('route_attempts')
          .select(`
            *,
            users:user_id (
              user_metadata
            )
          `)
          .eq('route_id', routeId)
          .eq('is_public', true)
          .order('total_time', { ascending: true })
          .range(page * limit, (page + 1) * limit - 1)

        if (error) throw error

        if (attemptsData) {
          const formatted: RankingEntry[] = attemptsData.map((attempt: any, index: number) => ({
            rank: page * limit + index + 1,
            user_id: attempt.user_id,
            user_name: attempt.users?.user_metadata?.fullName || 'Rider Anónimo',
            avatar_url: attempt.users?.user_metadata?.avatarUrl || null,
            total_time: attempt.total_time,
            max_speed: attempt.max_speed,
            avg_speed: attempt.avg_speed,
            overall_score: attempt.overall_score,
            completed_at: attempt.completed_at,
            is_personal_best: index === 0,
          }))

          setRanking(prev => page === 0 ? formatted : [...prev, ...formatted])
          setHasMore(attemptsData.length === limit)
        }
      } catch (err) {
        console.error('Error cargando ranking:', err)
      } finally {
        setLoading(false)
      }
    }

    loadRanking()
  }, [routeId, page])

  if (loading && ranking.length === 0) {
    return (
      <div className="min-h-screen bg-[#1c2327] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto text-amber-500 mb-4" size={40} />
          <p className="text-gray-400">Cargando ranking...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1c2327] text-slate-100">
      {/* Header */}
      <header className="bg-slate-900/50 backdrop-blur-sm border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-2"
          >
            <ArrowLeft size={16} />
            <span className="text-sm">Volver</span>
          </button>
          <h1 className="text-2xl font-bold text-white">
            {route?.name || 'Ranking'}
          </h1>
          <p className="text-sm text-gray-400">
            {route ? `${route.distance_km.toFixed(2)} km` : ''} • {ranking.length} riders
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Top 3 */}
        {ranking.length >= 3 && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            {/* 2do lugar */}
            <div className="text-center p-4 bg-slate-800/50 rounded-xl border-2 border-gray-400/30">
              <Medal className="text-gray-400 mx-auto mb-2" size={32} />
              <p className="text-3xl font-bold text-gray-400 mb-1">2°</p>
              <p className="text-sm font-semibold text-white truncate">
                {ranking[1].user_name.split(' ')[0]}
              </p>
              <p className="text-lg font-bold text-white font-mono mt-2">
                {formatTime(ranking[1].total_time)}
              </p>
            </div>

            {/* 1er lugar */}
            <div className="text-center p-6 bg-gradient-to-br from-amber-500/20 to-yellow-500/20 rounded-xl border-2 border-amber-500/50 -mt-4">
              <Crown className="text-yellow-400 mx-auto mb-2" size={48} />
              <p className="text-4xl font-bold text-yellow-400 mb-1">1°</p>
              <p className="text-base font-semibold text-white truncate">
                {ranking[0].user_name.split(' ')[0]}
              </p>
              <p className="text-2xl font-bold text-white font-mono mt-2">
                {formatTime(ranking[0].total_time)}
              </p>
              <div className="mt-2 text-xs text-gray-400">
                {formatSpeed(ranking[0].max_speed)}
              </div>
            </div>

            {/* 3er lugar */}
            <div className="text-center p-4 bg-slate-800/50 rounded-xl border-2 border-amber-600/30">
              <Medal className="text-amber-600 mx-auto mb-2" size={32} />
              <p className="text-3xl font-bold text-amber-600 mb-1">3°</p>
              <p className="text-sm font-semibold text-white truncate">
                {ranking[2].user_name.split(' ')[0]}
              </p>
              <p className="text-lg font-bold text-white font-mono mt-2">
                {formatTime(ranking[2].total_time)}
              </p>
            </div>
          </div>
        )}

        {/* Lista completa */}
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-white mb-4">Tabla de Posiciones</h2>
          
          {ranking.map((entry, index) => {
            const medal = getMedal(entry.rank)
            const MedalIcon = medal.icon

            return (
              <div
                key={`${entry.user_id}-${entry.completed_at}`}
                className={`p-4 rounded-xl border-2 transition-all ${
                  entry.rank <= 3
                    ? `${medal.bg} ${medal.color.replace('text-', 'border-')}`
                    : 'bg-slate-800/30 border-slate-700/50'
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Posición */}
                  <div className="flex items-center justify-center w-12 h-12 bg-slate-700/50 rounded-lg">
                    <MedalIcon className={medal.color} size={24} />
                  </div>

                  {/* Info del rider */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg font-bold text-white">
                        {entry.rank}°
                      </span>
                      <span className="font-semibold text-white">
                        {entry.user_name}
                      </span>
                      {entry.is_personal_best && (
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                          PB
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {formatDate(entry.completed_at)}
                      </span>
                    </div>
                  </div>

                  {/* Tiempo y velocidad */}
                  <div className="text-right">
                    <p className="text-xl font-bold text-white font-mono">
                      {formatTime(entry.total_time)}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Gauge size={10} />
                        {formatSpeed(entry.max_speed)}
                      </span>
                      <span className="flex items-center gap-1">
                        <TrendingUp size={10} />
                        {entry.overall_score} pts
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Cargar más */}
        {hasMore && (
          <button
            onClick={() => setPage(p => p + 1)}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition-colors"
          >
            Cargar Más
          </button>
        )}

        {/* Sin resultados */}
        {ranking.length === 0 && !loading && (
          <div className="text-center py-12">
            <Trophy className="mx-auto text-gray-500 mb-4" size={48} />
            <h3 className="text-xl font-bold text-white mb-2">Sin intentos aún</h3>
            <p className="text-gray-400 mb-6">Sé el primero en completar esta ruta</p>
            <button
              onClick={() => router.push(`/dashboard/routes/${routeId}`)}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-xl"
            >
              Ir a la Ruta
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
