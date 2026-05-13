'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Trophy, Menu } from 'lucide-react'
import { BrandSpinner } from '@/components/ui/BrandLogoLoader'
import { AnimeIconButton } from '@/components/ui/AnimeIconButton'
import {
  DashboardAppTopBar,
  DashboardAppTopBarHeading,
  DASHBOARD_APP_TOP_BAR_ICON_BUTTON_CLASS,
  DashboardCoachHeaderSlot,
} from '@/app/dashboard/components/DashboardAppTopBar'
import { useDashboardSidebar } from '@/lib/dashboard/DashboardSidebarContext'
import { cn } from '@/lib/utils'
import { createClient } from '@/core/infrastructure/supabase/client'

type RankingRoute = {
  id: string
  name: string
  distanceKm: number
  difficulty: 'Beginner' | 'Intermediate' | 'Expert'
}

export default function RankingPage() {
  const { openSidebar } = useDashboardSidebar()
  const [routes, setRoutes] = useState<RankingRoute[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('routes')
          .select('id, name, distance_km, difficulty')
          .eq('is_public', true)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(40)
        if (error) throw error
        if (!cancelled) {
          setRoutes(
            (data || []).map((r) => ({
              id: String(r.id),
              name: String(r.name),
              distanceKm: Number(r.distance_km) || 0,
              difficulty: (r.difficulty as RankingRoute['difficulty']) || 'Beginner',
            }))
          )
        }
      } catch (e) {
        console.error(e)
        if (!cancelled) setRoutes([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="gdh-immersive-page min-h-screen pb-28 text-slate-100">
      <DashboardAppTopBar
        leading={
          <AnimeIconButton
            label="Menú"
            onClick={() => openSidebar()}
            className={cn(DASHBOARD_APP_TOP_BAR_ICON_BUTTON_CLASS)}
          >
            <Menu size={22} aria-hidden />
          </AnimeIconButton>
        }
        center={
          <DashboardAppTopBarHeading
            title="Rankings"
            subtitle="Elegí una ruta pública para ver posiciones y tiempos."
          />
        }
        trailing={<DashboardCoachHeaderSlot />}
      />

      <div className="mx-auto max-w-lg space-y-6 px-4 pt-4">
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
          <BrandSpinner className="shrink-0" size={22} />
          Cargando rutas…
        </div>
      ) : routes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/40 px-5 py-10 text-center gdh-immersive-panel">
          <Trophy className="mx-auto text-slate-600 mb-3" size={40} />
          <p className="text-slate-300 font-medium">No hay rutas públicas aún</p>
          <p className="text-sm text-slate-500 mt-2">Cuando haya rutas publicadas, podrás abrir su ranking aquí.</p>
          <Link
            href="/dashboard/routes"
            className="inline-block mt-5 text-sm font-semibold text-teal-400 hover:text-teal-300"
          >
            Ir a mis rutas
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {routes.map((r) => (
            <li key={r.id}>
              <Link
                href={`/dashboard/routes/route-ranking?id=${encodeURIComponent(r.id)}`}
                className="gdh-immersive-card flex items-center gap-3 p-4 rounded-2xl transition-colors group"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 text-teal-400">
                  <Trophy size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white truncate group-hover:text-teal-300 transition-colors">{r.name}</p>
                  <p className="text-xs text-slate-500">{r.distanceKm.toFixed(2)} km · {r.difficulty}</p>
                </div>
                <ChevronRight size={20} className="text-slate-600 group-hover:text-teal-400/80 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      </div>
    </div>
  )
}
