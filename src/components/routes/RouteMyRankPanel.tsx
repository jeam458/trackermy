'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/core/infrastructure/supabase/client'
import { Trophy, Box } from 'lucide-react'
import { BrandSpinner } from '@/components/ui/BrandLogoLoader'
import { getReplay3dPipelineStatus, replay3dStatusLabel, type Replay3dPipelineStatus } from '@/lib/replay3d/replay3dMeta'
import type { RouteViewFrom } from '@/lib/routeViewNavigation'

function formatTime(seconds: number): string {
  const s = Number(seconds)
  const mins = Math.floor(s / 60)
  const secs = Math.floor(s % 60)
  const ms = Math.floor((s % 1) * 100)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
}

function attemptReplayHref(attemptId: string, routeId: string, returnFrom: RouteViewFrom | null | undefined): string {
  const q = new URLSearchParams()
  q.set('attemptId', attemptId)
  q.set('routeId', routeId)
  q.set('from', 'route-view')
  if (returnFrom) q.set('parentFrom', returnFrom)
  return `/dashboard/routes/attempt-replay?${q.toString()}`
}

type Props = {
  routeId: string
  replayReturnFrom?: RouteViewFrom | null
}

/**
 * Puesto del usuario entre riders (mejor tiempo público por persona) + replay del mejor intento.
 */
export function RouteMyRankPanel({ routeId, replayReturnFrom = null }: Props) {
  const [loading, setLoading] = useState(true)
  const [rank, setRank] = useState<number | null>(null)
  const [totalRiders, setTotalRiders] = useState<number | null>(null)
  const [myBestTime, setMyBestTime] = useState<number | null>(null)
  const [bestAttemptId, setBestAttemptId] = useState<string | null>(null)
  const [pipeline, setPipeline] = useState<Replay3dPipelineStatus>('none')
  const [userName, setUserName] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setRank(null)
      setTotalRiders(null)
      setMyBestTime(null)
      setBestAttemptId(null)
      setPipeline('none')
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user || cancelled) {
          setLoading(false)
          return
        }
        setUserName(
          (user.user_metadata as { fullName?: string } | undefined)?.fullName || user.email?.split('@')[0] || 'Tú'
        )

        const { data: rows, error } = await supabase
          .from('route_attempts')
          .select('id, user_id, total_time, replay_3d_meta')
          .eq('route_id', routeId)
          .eq('is_public', true)

        if (cancelled) return
        if (error || !rows?.length) {
          setLoading(false)
          return
        }

        const uidStr = String(user.id)
        const mine = rows.filter((r) => String(r.user_id) === uidStr)
        if (!mine.length) {
          setLoading(false)
          return
        }

        const bestRow = mine.reduce((a, b) =>
          Number(a.total_time) <= Number(b.total_time) ? a : b
        )
        setMyBestTime(Number(bestRow.total_time))
        setBestAttemptId(String(bestRow.id))
        setPipeline(getReplay3dPipelineStatus(bestRow.replay_3d_meta))

        const bestByUser = new Map<string, number>()
        for (const r of rows) {
          const uid = String(r.user_id)
          const t = Number(r.total_time)
          const prev = bestByUser.get(uid)
          if (prev == null || t < prev) bestByUser.set(uid, t)
        }

        const ordered = [...bestByUser.entries()].sort((a, b) =>
          a[1] !== b[1] ? a[1] - b[1] : a[0].localeCompare(b[0])
        )
        const pos = ordered.findIndex(([uid]) => uid === uidStr)
        if (pos < 0) {
          setLoading(false)
          return
        }

        if (!cancelled) {
          setRank(pos + 1)
          setTotalRiders(bestByUser.size)
        }
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
      <div className="flex min-h-[88px] items-center justify-center rounded-2xl border border-white/10 bg-slate-800/40 p-4">
        <BrandSpinner size={24} />
      </div>
    )
  }

  if (rank == null || totalRiders == null || myBestTime == null || !bestAttemptId) {
    return (
      <div className="rounded-2xl border border-dashed border-amber-500/20 bg-amber-500/5 p-4 text-sm text-slate-300">
        <div className="flex items-start gap-2">
          <Trophy className="size-5 shrink-0 text-amber-500/80" />
          <div>
            <p className="font-medium text-white">Aún no estás en el ranking público</p>
            <p className="text-xs text-slate-500 mt-1">
              Completa un recorrido con el cronómetro y márcalo como público para aparecer y ver tu puesto entre otros
              riders.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <section className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/10 to-slate-900/60 p-4 space-y-3">
      <div className="flex items-center gap-2 text-white">
        <Trophy className="size-5 text-amber-400" />
        <h2 className="text-lg font-bold">Tu puesto en el ranking</h2>
      </div>
      <p className="text-xs text-slate-500">
        Tu <strong className="text-slate-400">mejor bajada</strong> pública comparada con la mejor bajada de cada otro
        rider en esta pista (no cuenta cada intento por separado). La vista 3D / LingBot es de{' '}
        <strong className="text-slate-400">tus recorridos</strong>, no del trazado publicado de la ruta.
      </p>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <p className="text-[10px] uppercase text-slate-500">Posición</p>
          <p className="text-3xl font-bold text-amber-400 tabular-nums">
            {rank} <span className="text-lg text-slate-500">/ {totalRiders}</span>
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">riders con tiempo público</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-slate-500">Tu mejor tiempo</p>
          <p className="text-xl font-mono font-semibold text-white">{formatTime(myBestTime)}</p>
        </div>
        {userName && <p className="text-sm text-slate-500 self-end hidden sm:block">{userName}</p>}
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        <Link
          href={attemptReplayHref(bestAttemptId, routeId, replayReturnFrom)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-slate-800/80 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
        >
          Replay de bajada (mapa)
        </Link>
        {pipeline !== 'none' && (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-gdh-brand/30 bg-gdh-brand/10 px-3 py-2 text-xs text-gdh-brand-highlight/90">
            <Box size={14} className="shrink-0" />
            {replay3dStatusLabel(pipeline)}
          </span>
        )}
      </div>
    </section>
  )
}
