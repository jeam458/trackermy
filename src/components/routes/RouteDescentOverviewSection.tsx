'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { createClient } from '@/core/infrastructure/supabase/client'
import { MapPinned, User } from 'lucide-react'
import { mapPointsFromAttemptGpsJson, hasGpsTraceForOverview } from '@/lib/routeAttemptInsert'
import { BrandSpinner } from '@/components/ui/BrandLogoLoader'

const RecordedTrackOverview = dynamic(
  () =>
    import('@/components/routes/RecordedTrackOverview').then((m) => ({
      default: m.RecordedTrackOverview,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[120px] items-center justify-center rounded-2xl border border-white/10 bg-[#121826] text-slate-500">
        <BrandSpinner size={24} />
      </div>
    ),
  }
)

type AttemptRow = {
  id: string
  total_time: number
  distance: number
  gps_points: unknown
  completed_at: string
}

interface RouteDescentOverviewSectionProps {
  routeId: string
}

/**
 * Mapa, perfil y tabla de **tu** bajada con GPS en esta pista (no el trazado de la ruta publicada).
 */
export function RouteDescentOverviewSection({ routeId }: RouteDescentOverviewSectionProps) {
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState<AttemptRow | null>(null)
  const [noUser, setNoUser] = useState(false)
  const [noGps, setNoGps] = useState(false)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setAttempt(null)
      setNoUser(false)
      setNoGps(false)
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          if (!cancelled) {
            setNoUser(true)
            setLoading(false)
          }
          return
        }

        const { data, error } = await supabase
          .from('route_attempts')
          .select('id, total_time, distance, gps_points, completed_at')
          .eq('route_id', routeId)
          .eq('user_id', user.id)
          .order('completed_at', { ascending: false })

        if (error) throw error
        if (cancelled) return

        const list = data ?? []
        const withGps = list.find((a) => hasGpsTraceForOverview(a.gps_points))
        if (!withGps) {
          setNoGps(true)
          setLoading(false)
          return
        }
        setAttempt(withGps as AttemptRow)
      } catch {
        if (!cancelled) setNoGps(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [routeId])

  if (loading) {
    return (
      <div className="flex min-h-[100px] items-center justify-center rounded-2xl border border-white/10 bg-slate-800/40 p-6">
        <BrandSpinner size={28} />
      </div>
    )
  }

  if (noUser) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-800/40 p-5 text-sm text-slate-400">
        <p className="text-white font-medium">Recorrido GPS del rider</p>
        <p className="mt-1">Inicia sesión para ver el análisis de tus bajadas con muestreo GPS en esta pista.</p>
      </div>
    )
  }

  if (noGps || !attempt) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 bg-[#121826] p-5 text-slate-300">
        <div className="flex items-start gap-3">
          <User className="size-6 shrink-0 text-teal-500/80" />
          <div className="space-y-1">
            <h3 className="font-semibold text-white">Aún no hay traza tuya con GPS en esta pista</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              El mapa y el perfil de velocidad de esta sección corresponden a <strong>tu</strong> recorrido medido, no a la
              línea de la ruta del mapa. Cuando hagas un descenso con el cronómetro y GPS, aparecerá aquí tu bajada más
              reciente con datos válidos.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const mapPoints = mapPointsFromAttemptGpsJson(attempt.gps_points)
  if (mapPoints.length < 2) {
    return null
  }

  const elapsedSec = Math.max(0, Math.round(Number(attempt.total_time)))
  const distM = Math.max(0, Number(attempt.distance))

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 text-slate-300">
        <MapPinned className="size-5 text-teal-400" />
        <h2 className="text-lg font-bold text-white">Tu recorrido medido (GPS)</h2>
      </div>
      <p className="text-xs text-slate-500">
        Mapa, perfil y tabla = tu traza de rider en esta pista. El trazado publicado de la ruta (plantilla) está arriba, en
        la vista previa animada.
      </p>
      <RecordedTrackOverview
        points={mapPoints}
        totalElapsedSec={elapsedSec}
        totalDistanceM={distM}
        title="Resumen de tu bajada (datos reales)"
      />
    </section>
  )
}
