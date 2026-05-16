'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Share2, Trophy } from 'lucide-react'
import { RouteFlowStickyHeader } from '@/components/routes/RouteFlowStickyHeader'
import { BrandLogoLoader } from '@/components/ui/BrandLogoLoader'
import { createClient } from '@/core/infrastructure/supabase/client'
import { mapPointsFromAttemptGpsJson } from '@/lib/routeAttemptInsert'
import { buildRecordedTrackRows } from '@/lib/recordedTrackOverviewRows'
import { buildDetailedRideSegments } from '@/lib/recordedTrackSegments'
import { buildRideMentorReport } from '@/lib/rideMentorAnalysis'
import { normalizeRouteViewFrom, routeViewUrl } from '@/lib/routeViewNavigation'
import { generateLocalCoachAdvice, getLocalCoachRuntimeInfo } from '@/lib/localAiCoach'

type AttemptStatsRow = {
  id: string
  route_id: string
  user_id: string
  total_time: number
  avg_speed: number | null
  max_speed: number | null
  distance: number
  gps_points: unknown
}

function formatTimeShort(totalSec: number) {
  const mins = Math.floor(totalSec / 60)
  const secs = Math.floor(totalSec % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function speedKmhFromMps(speedMps: number | null | undefined) {
  if (speedMps == null || !Number.isFinite(speedMps)) return '—'
  return `${Math.round(speedMps * 3.6)} km/h`
}

function fmtSigned(v: number, suffix = '') {
  const abs = Math.abs(v).toFixed(1)
  const sign = v > 0 ? '+' : v < 0 ? '-' : ''
  return `${sign}${abs}${suffix}`
}

function SegmentMiniMap({
  points,
}: {
  points: Array<{ latitude: number; longitude: number }>
}) {
  if (points.length < 2) {
    return <div className="h-20 rounded-md border border-white/10 bg-[#0f1520]" />
  }
  let minLat = Infinity
  let maxLat = -Infinity
  let minLng = Infinity
  let maxLng = -Infinity
  for (const p of points) {
    minLat = Math.min(minLat, p.latitude)
    maxLat = Math.max(maxLat, p.latitude)
    minLng = Math.min(minLng, p.longitude)
    maxLng = Math.max(maxLng, p.longitude)
  }
  const w = Math.max(1e-6, maxLng - minLng)
  const h = Math.max(1e-6, maxLat - minLat)
  const path = points
    .map((p, i) => {
      const x = ((p.longitude - minLng) / w) * 100
      const y = 100 - ((p.latitude - minLat) / h) * 100
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
  return (
    <svg viewBox="0 0 100 100" className="h-20 w-full rounded-md border border-white/10 bg-[#0f1520]">
      <path d={path} fill="none" stroke="#e37845" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="4" cy="96" r="0" fill="transparent" />
    </svg>
  )
}

function SegmentPerformanceChart({
  segments,
  selectedIndex,
  onSelect,
}: {
  segments: Array<{
    index: number
    avgSpeedKmh: number
    maxSpeedKmh: number
    targetMinKmh: number
    targetMaxKmh: number
    safeMaxKmh: number
  }>
  selectedIndex: number | null
  onSelect: (idx: number) => void
}) {
  if (segments.length === 0) {
    return <div className="h-44 rounded-xl border border-white/10 bg-[#0f1520]" />
  }

  const maxY = Math.max(
    30,
    ...segments.flatMap((s) => [s.avgSpeedKmh, s.targetMaxKmh, s.safeMaxKmh])
  )
  const chartW = 100
  const chartH = 100
  const step = chartW / segments.length
  const barW = step * 0.52
  const toY = (v: number) => chartH - (Math.max(0, v) / maxY) * chartH

  return (
    <div className="rounded-xl border border-white/10 bg-[#0f1520] p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
        <span className="rounded-full border border-gdh-brand/40 bg-gdh-brand/12 px-2 py-0.5 text-gdh-brand-highlight">Velocidad media real</span>
        <span className="rounded-full border border-gdh-sun/40 bg-gdh-sun/12 px-2 py-0.5 text-gdh-sun">Velocidad máxima real</span>
        <span className="rounded-full border border-gdh-trail/40 bg-gdh-trail/12 px-2 py-0.5 text-slate-200">Rango objetivo</span>
        <span className="rounded-full border border-amber-400/50 bg-amber-400/10 px-2 py-0.5 text-amber-200">Velocidad segura</span>
      </div>
      <svg viewBox="0 0 100 120" className="w-full h-52">
        {[0.25, 0.5, 0.75, 1].map((f, i) => (
          <g key={`g-${i}`}>
            <line x1={0} y1={chartH * (1 - f)} x2={100} y2={chartH * (1 - f)} stroke="rgba(148,163,184,0.22)" strokeWidth={0.35} />
            <text x={0.3} y={chartH * (1 - f) - 0.8} fontSize="3.2" fill="rgba(148,163,184,0.85)">
              {Math.round(maxY * f)}
            </text>
          </g>
        ))}

        {segments.map((seg, i) => {
          const xCenter = i * step + step / 2
          const x = xCenter - barW / 2
          const yAvg = toY(seg.avgSpeedKmh)
          const yMax = toY(seg.maxSpeedKmh)
          const yTMax = toY(seg.targetMaxKmh)
          const yTMin = toY(seg.targetMinKmh)
          const ySafe = toY(seg.safeMaxKmh)
          const selected = selectedIndex === seg.index
          return (
            <g key={`seg-${seg.index}`} onClick={() => onSelect(seg.index)} style={{ cursor: 'pointer' }}>
              <rect
                x={xCenter - step * 0.38}
                y={0}
                width={step * 0.76}
                height={chartH}
                fill={selected ? 'rgba(56,189,248,0.10)' : 'transparent'}
                rx={1.4}
              />
              <rect x={x} y={yTMax} width={barW} height={Math.max(1.2, yTMin - yTMax)} rx={1.4} fill="rgba(168,85,247,0.45)" />
              <rect x={x} y={yAvg} width={barW} height={Math.max(1.2, chartH - yAvg)} rx={1.4} fill="rgba(34,211,238,0.85)" />
              <line x1={xCenter} y1={yAvg} x2={xCenter} y2={yMax} stroke="rgba(56,189,248,0.95)" strokeWidth={1.1} />
              <circle cx={xCenter} cy={yMax} r={1.1} fill="rgba(56,189,248,1)" />
              <line x1={xCenter - barW / 2} y1={ySafe} x2={xCenter + barW / 2} y2={ySafe} stroke="rgba(251,191,36,0.95)" strokeWidth={1} />
              <text x={xCenter - 3.4} y={Math.max(5, yAvg - 1.2)} fontSize="3.1" fill="rgba(207,250,254,0.95)">
                {Math.round(seg.avgSpeedKmh)}
              </text>
              <text x={xCenter - 3.4} y={Math.max(4, yMax - 2.1)} fontSize="2.9" fill="rgba(186,230,253,0.95)">
                {Math.round(seg.maxSpeedKmh)}
              </text>
              <text x={xCenter - 2.1} y={112} fontSize="3.6" fill={selected ? 'rgba(255,255,255,0.95)' : 'rgba(148,163,184,0.9)'}>
                T{seg.index + 1}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function parseAiSegmentRecommendations(raw: string): Record<number, string> {
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as {
        recomendaciones_tramo?: Array<{ tramo?: number; recomendacion?: string }>
      }
      const outFromJson: Record<number, string> = {}
      for (const item of parsed.recomendaciones_tramo ?? []) {
        const idx = Number(item?.tramo)
        const msg = String(item?.recomendacion || '').trim()
        if (!Number.isFinite(idx) || idx < 1 || !msg) continue
        outFromJson[idx - 1] = msg
      }
      if (Object.keys(outFromJson).length > 0) return outFromJson
    } catch {
      // fallback a parser por líneas
    }
  }

  const out: Record<number, string> = {}
  const lines = raw
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)
  for (const line of lines) {
    const m = line.match(/tramo\s*(\d+)\s*[:\-]\s*(.+)$/i)
    if (!m) continue
    const idx = Number(m[1])
    if (!Number.isFinite(idx) || idx < 1) continue
    out[idx - 1] = m[2]!.trim()
  }
  return out
}

function normalizeCoachText(raw: string): string {
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return raw
  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      diagnostico?: string
      prioridades?: string[]
      plan_siguiente_sesion?: string[]
      recomendaciones_tramo?: Array<{ tramo?: number; recomendacion?: string }>
    }
    const lines: string[] = []
    if (parsed.diagnostico) lines.push(`Diagnóstico: ${parsed.diagnostico}`)
    if (Array.isArray(parsed.prioridades) && parsed.prioridades.length) {
      lines.push('Prioridades:')
      parsed.prioridades.slice(0, 3).forEach((x, i) => lines.push(`${i + 1}. ${x}`))
    }
    if (Array.isArray(parsed.plan_siguiente_sesion) && parsed.plan_siguiente_sesion.length) {
      lines.push('Próxima sesión:')
      parsed.plan_siguiente_sesion.slice(0, 3).forEach((x, i) => lines.push(`${i + 1}. ${x}`))
    }
    if (Array.isArray(parsed.recomendaciones_tramo) && parsed.recomendaciones_tramo.length) {
      lines.push('Recomendaciones por tramo:')
      parsed.recomendaciones_tramo.slice(0, 6).forEach((row) => {
        const t = Number(row.tramo)
        const r = String(row.recomendacion || '').trim()
        if (Number.isFinite(t) && t > 0 && r) lines.push(`- Tramo ${t}: ${r}`)
      })
    }
    return lines.join('\n').trim() || raw
  } catch {
    return raw
  }
}

function buildFallbackSegmentRecommendations(
  insights: Array<{ segment: number; message: string }>
): Record<number, string> {
  const out: Record<number, string> = {}
  for (const ins of insights) {
    if (ins.segment > 0) out[ins.segment - 1] = ins.message
  }
  return out
}

function AttemptStatsInner() {
  const searchParams = useSearchParams()
  const attemptId = searchParams.get('attemptId')
  const routeIdParam = searchParams.get('routeId')
  const from = searchParams.get('from')
  const parentFrom = normalizeRouteViewFrom(searchParams.get('parentFrom'))

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState<AttemptStatsRow | null>(null)
  const [routeName, setRouteName] = useState<string>('Ruta')
  const [riderName, setRiderName] = useState<string>('Rider')
  const [riderAvatar, setRiderAvatar] = useState<string | null>(null)
  const [isPersonalRecord, setIsPersonalRecord] = useState(false)
  const [coachLoading, setCoachLoading] = useState(false)
  const [aiSegmentRecommendations, setAiSegmentRecommendations] = useState<Record<number, string>>({})
  const [coachAdviceText, setCoachAdviceText] = useState<string>('')
  const [coachRuntimeModel, setCoachRuntimeModel] = useState<string | null>(null)
  const [percentile, setPercentile] = useState<number | null>(null)
  const [bestTimeDiffSec, setBestTimeDiffSec] = useState<number | null>(null)
  const [showDetailedSegments, setShowDetailedSegments] = useState(false)
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!attemptId) {
        setError('Falta attemptId en la URL.')
        setLoading(false)
        return
      }

      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) throw new Error('Inicia sesión para ver estadísticas.')

        const { data: row, error: e1 } = await supabase
          .from('route_attempts')
          .select('id, route_id, user_id, total_time, avg_speed, max_speed, distance, gps_points')
          .eq('id', attemptId)
          .maybeSingle()
        if (e1 || !row) throw new Error(e1?.message || 'No se encontró el intento.')
        if (cancelled) return

        const ar = row as AttemptStatsRow
        setAttempt(ar)

        const routeId = routeIdParam || ar.route_id
        const [{ data: routeData }, { data: profileData }] = await Promise.all([
          supabase.from('routes').select('name').eq('id', routeId).maybeSingle(),
          supabase.from('profiles').select('full_name, avatar_url, map_avatar_url').eq('id', ar.user_id).maybeSingle(),
        ])
        if (!cancelled) {
          setRouteName((routeData?.name as string) || 'Ruta')
          const pn = (profileData?.full_name as string | null)?.trim()
          setRiderName(pn || 'Rider')
          setRiderAvatar(
            ((profileData?.map_avatar_url as string | null) || (profileData?.avatar_url as string | null)) ?? null
          )
        }

        const { data: myBest } = await supabase
          .from('route_attempts')
          .select('total_time')
          .eq('route_id', ar.route_id)
          .eq('user_id', ar.user_id)
          .eq('is_public', true)
          .order('total_time', { ascending: true })
          .limit(1)
          .maybeSingle()

        if (!cancelled) {
          const bestTime = Number((myBest as { total_time?: number } | null)?.total_time)
          const currentTime = Number(ar.total_time)
          setIsPersonalRecord(Number.isFinite(bestTime) && Math.abs(bestTime - currentTime) < 0.001)
          if (Number.isFinite(bestTime) && Number.isFinite(currentTime)) {
            setBestTimeDiffSec(currentTime - bestTime)
          } else {
            setBestTimeDiffSec(null)
          }
        }

        const { data: routeTimes } = await supabase
          .from('route_attempts')
          .select('total_time')
          .eq('route_id', ar.route_id)
          .eq('is_public', true)
          .not('total_time', 'is', null)
          .order('total_time', { ascending: true })
          .limit(500)
        if (!cancelled) {
          const times = (routeTimes ?? [])
            .map((x) => Number((x as { total_time?: number }).total_time))
            .filter((x) => Number.isFinite(x) && x > 0)
          if (times.length > 4) {
            const betterOrEqual = times.filter((x) => x <= Number(ar.total_time)).length
            setPercentile(Math.max(1, Math.min(99, ((times.length - betterOrEqual + 1) / times.length) * 100)))
          } else {
            setPercentile(null)
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error cargando estadísticas.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [attemptId, routeIdParam])

  const points = useMemo(
    () => (attempt ? mapPointsFromAttemptGpsJson(attempt.gps_points) : []),
    [attempt]
  )
  const rows = useMemo(() => buildRecordedTrackRows(points), [points])
  const detailedSegments = useMemo(() => buildDetailedRideSegments(rows, 6), [rows])
  const mentor = useMemo(() => buildRideMentorReport(rows, 6), [rows])

  const onRunLocalCoach = async () => {
    if (!attempt || coachLoading) return
    setCoachLoading(true)
    setAiSegmentRecommendations({})
    setCoachAdviceText('')
    try {
      const txt = await generateLocalCoachAdvice({
        routeName,
        riderName,
        totalTimeSec: attempt.total_time,
        avgSpeedMps: attempt.avg_speed,
        maxSpeedMps: attempt.max_speed,
        distanceM: attempt.distance,
        mentor,
        percentile,
        bestTimeDiffSec,
      })
      setCoachAdviceText(normalizeCoachText(txt || ''))
      setCoachRuntimeModel(getLocalCoachRuntimeInfo().modelId)
      const parsed = parseAiSegmentRecommendations(txt || '')
      if (Object.keys(parsed).length > 0) {
        setAiSegmentRecommendations(parsed)
      } else {
        setAiSegmentRecommendations(buildFallbackSegmentRecommendations(mentor.insights))
      }
    } catch (e) {
      setAiSegmentRecommendations(buildFallbackSegmentRecommendations(mentor.insights))
      setCoachRuntimeModel(getLocalCoachRuntimeInfo().modelId)
    } finally {
      setCoachLoading(false)
      setShowDetailedSegments(true)
    }
  }

  const routeIdForViewBack = routeIdParam || attempt?.route_id || ''
  const backHref = useMemo(() => {
    if (!routeIdForViewBack || !attemptId) return '/dashboard/routes'
    if (from === 'ranking') {
      return `/dashboard/routes/attempt-replay?attemptId=${encodeURIComponent(attemptId)}&routeId=${encodeURIComponent(routeIdForViewBack)}&from=ranking`
    }
    if (from === 'route-view') {
      return `/dashboard/routes/attempt-replay?attemptId=${encodeURIComponent(attemptId)}&routeId=${encodeURIComponent(routeIdForViewBack)}&from=route-view${parentFrom ? `&parentFrom=${encodeURIComponent(parentFrom)}` : ''}`
    }
    if (from === 'activity') {
      return `/dashboard/routes/attempt-replay?attemptId=${encodeURIComponent(attemptId)}&routeId=${encodeURIComponent(routeIdForViewBack)}&from=activity`
    }
    return routeViewUrl(routeIdForViewBack, 'attempt-stats', { attemptId })
  }, [attemptId, from, parentFrom, routeIdForViewBack])
  const rankingHref = attempt
    ? `/dashboard/routes/route-ranking?id=${encodeURIComponent(attempt.route_id)}`
    : '/dashboard/ranking'

  const onShare = async () => {
    const shareUrl = typeof window !== 'undefined' ? window.location.href : ''
    const text = `Mi bajada en ${routeName} (${attempt ? formatTimeShort(attempt.total_time) : ''})`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Estadísticas de Bajada', text, url: shareUrl })
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${text}\n${shareUrl}`)
      }
    } catch {
      // noop
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gdh-page flex items-center justify-center">
        <BrandLogoLoader label="Cargando estadísticas..." compact showRing />
      </div>
    )
  }

  if (error || !attempt) {
    return (
      <div className="min-h-screen bg-gdh-page text-slate-100">
        <div className="max-w-lg mx-auto px-4 pb-10">
          <RouteFlowStickyHeader backHref={backHref} backLabel="Volver" />
          <p className="rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-200">{error || 'No se pudo cargar.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gdh-page text-slate-100 pb-10">
      <RouteFlowStickyHeader
        backHref={backHref}
        backLabel="Volver"
        title="Estadísticas de Bajada"
        subtitle={
          <>
            <p className="text-sm text-slate-400">Resumen de tu bajada</p>
            <p className="text-3xl font-extrabold leading-tight text-white">{routeName}</p>
          </>
        }
        trailing={
          <>
            <button
              type="button"
              onClick={() => void onShare()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10"
            >
              <Share2 size={14} aria-hidden />
              Compartir
            </button>
            <Link
              href={rankingHref}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gdh-brand/40 bg-gdh-brand/12 px-2.5 py-1.5 text-xs font-semibold text-gdh-brand-highlight hover:bg-gdh-brand/18"
            >
              <Trophy size={14} aria-hidden />
              Ranking
            </Link>
          </>
        }
      />
      <div className="max-w-lg mx-auto space-y-4 px-4">
        <section className="rounded-2xl border border-white/10 bg-gdh-card p-4">
          <div className="mt-0">
            <SegmentPerformanceChart
              segments={detailedSegments.map((s) => ({
                index: s.index,
                avgSpeedKmh: s.avgSpeedKmh,
                maxSpeedKmh: s.maxSpeedKmh,
                targetMinKmh: s.targetMinKmh,
                targetMaxKmh: s.targetMaxKmh,
                safeMaxKmh: s.safeMaxKmh,
              }))}
              selectedIndex={selectedSegmentIndex}
              onSelect={(idx) => setSelectedSegmentIndex(idx)}
            />
          </div>

          <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-xl border border-white/10 bg-white/5">
            <MetricCell label="Velocidad máxima" value={speedKmhFromMps(attempt.max_speed)} />
            <MetricCell label="Velocidad media" value={speedKmhFromMps(attempt.avg_speed)} withBorder />
            <MetricCell label="Tiempo total" value={formatTimeShort(attempt.total_time)} withBorder />
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-slate-700/45 p-3 flex items-center gap-3">
            <div className="h-12 w-12 rounded-full overflow-hidden border border-white/15 bg-slate-700 shrink-0">
              {riderAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={riderAvatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-sm font-bold text-white">
                  {riderName.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-gdh-brand-highlight font-semibold uppercase text-sm">
                {isPersonalRecord ? 'Nuevo récord personal!' : 'Tu mejor bajada'}
              </p>
              <p className="text-2xl font-bold text-white truncate">{riderName}</p>
            </div>
          </div>

        </section>

        <section className="rounded-2xl border border-white/10 bg-gdh-card p-4">
          <h2 className="text-xl font-bold text-white">Análisis del rider</h2>
          <p className="text-sm text-slate-400 mt-1">{mentor.summary}</p>

          <div className="mt-3 grid grid-cols-3 overflow-hidden rounded-xl border border-white/10 bg-white/5">
            <MetricCell
              label="Consistencia"
              value={`${mentor.consistencyScore}`}
            />
            <MetricCell
              label="Paradas"
              value={`${mentor.stopEvents}`}
              withBorder
            />
            <MetricCell
              label="Vel. media en bajada"
              value={`${Math.round(mentor.avgDownhillSpeedKmh)} km/h`}
              withBorder
            />
          </div>

          <div className="mt-3 space-y-2">
            {mentor.insights.length > 0 ? (
              mentor.insights.map((ins, idx) => (
                <div
                  // eslint-disable-next-line react/no-array-index-key
                  key={`ins-${idx}`}
                  className={`rounded-xl border p-3 ${
                    ins.priority === 'high'
                      ? 'border-amber-500/35 bg-amber-500/10'
                      : ins.priority === 'medium'
                        ? 'border-gdh-brand/30 bg-gdh-brand/10'
                        : 'border-white/10 bg-slate-700/35'
                  }`}
                >
                  <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Observación general</p>
                  <p className="text-sm text-slate-100 leading-relaxed mt-1">{ins.message}</p>
                  <div className="mt-2 rounded-md border border-white/10 bg-black/20 p-2">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Detalle técnico</p>
                    {ins.segment > 0 ? (
                      <p className="text-[12px] text-slate-300 mt-1">
                        Tramo {ins.segment} · Pendiente: {ins.slopePct.toFixed(1)}% · Velocidad actual: {ins.avgSpeedKmh.toFixed(1)} km/h ·
                        objetivo: {ins.recommendedMinKmh}-{ins.recommendedMaxKmh} km/h
                      </p>
                    ) : (
                      <p className="text-[12px] text-slate-300 mt-1">
                        Paradas detectadas: {mentor.stopEvents} · Consistencia: {mentor.consistencyScore}/100 ·
                        vel. media en bajada: {mentor.avgDownhillSpeedKmh.toFixed(1)} km/h
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400 rounded-xl border border-white/10 bg-slate-700/30 p-3">
                Sin alertas críticas. Mantén la línea y busca mejorar fluidez entre tramos para bajar segundos.
              </p>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-gdh-brand/25 bg-gdh-brand/10 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gdh-brand-highlight">Coach IA local (WebLLM / respaldo)</p>
                <p className="text-xs text-slate-300">
                  Genera recomendaciones y las coloca automáticamente en cada tramo detallado.
                </p>
                <p className="text-[11px] text-slate-300/90 mt-1">
                  Motor activo: {coachRuntimeModel || (getLocalCoachRuntimeInfo().webgpu ? 'inicializando modelo…' : 'WebGPU no disponible')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void onRunLocalCoach()}
                disabled={coachLoading}
                className="rounded-lg border border-gdh-brand/40 bg-gdh-brand/20 px-3 py-2 text-sm font-semibold text-white hover:bg-gdh-brand-highlight/25 disabled:opacity-60"
              >
                {coachLoading ? 'Analizando…' : 'Analizar con IA'}
              </button>
            </div>
            <div className="mt-2 text-xs text-slate-300">
              Percentil aproximado en ruta: {percentile != null ? `${Math.round(percentile)}%` : 'N/D'} ·
              brecha vs PB: {bestTimeDiffSec != null ? `${bestTimeDiffSec.toFixed(1)} s` : 'N/D'}
            </div>
            {coachAdviceText ? (
              <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-gdh-brand/25 bg-black/20 p-2 text-[12px] leading-relaxed text-slate-200">
                {coachAdviceText}
              </pre>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-gdh-card p-4">
          <h2 className="text-xl font-bold text-white">Tramos detallados</h2>
          <p className="text-sm text-slate-400 mt-1">
            Desglose técnico por tramo: pendiente, velocidades actual/objetivo y velocidad segura estimada.
          </p>

          {!showDetailedSegments ? (
            <p className="mt-3 text-sm text-slate-300 rounded-xl border border-white/10 bg-slate-700/30 p-3">
              Pulsa <span className="font-semibold text-gdh-brand-highlight">Analizar con IA</span> para generar los tramos detallados con mapa.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {detailedSegments.map((seg) => {
                const below = seg.avgSpeedKmh < seg.targetMinKmh
                const aboveSafe = seg.maxSpeedKmh > seg.safeMaxKmh
                const selected = selectedSegmentIndex === seg.index
                return (
                  <article
                    key={`dseg-${seg.index}`}
                    className={`rounded-xl border p-3 ${
                      selected
                        ? 'border-gdh-sun/45 bg-gdh-sun/8'
                        : 'border-white/10 bg-[#0f1520]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-white">
                        Tramo {seg.index + 1} · {(seg.startDistanceM / 1000).toFixed(2)}-{(seg.endDistanceM / 1000).toFixed(2)} km
                      </p>
                      <span
                        className={`text-[11px] px-2 py-1 rounded-full border ${
                          aboveSafe
                            ? 'border-red-500/40 text-red-300 bg-red-500/10'
                            : below
                              ? 'border-amber-500/40 text-amber-300 bg-amber-500/10'
                              : 'border-gdh-brand/40 text-gdh-brand-highlight bg-gdh-brand/10'
                        }`}
                      >
                        {aboveSafe ? 'Riesgo alto' : below ? 'Mejorable' : 'En rango'}
                      </span>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-md border border-white/10 bg-white/5 p-2">
                        <p className="text-slate-400">Pendiente</p>
                        <p className="text-white font-semibold">{fmtSigned(seg.slopePct, '%')}</p>
                      </div>
                      <div className="rounded-md border border-white/10 bg-white/5 p-2">
                        <p className="text-slate-400">Desnivel</p>
                        <p className="text-white font-semibold">{fmtSigned(seg.elevationDeltaM, ' m')}</p>
                      </div>
                      <div className="rounded-md border border-white/10 bg-white/5 p-2">
                        <p className="text-slate-400">Vel. media / máx</p>
                        <p className="text-white font-semibold">
                          {seg.avgSpeedKmh.toFixed(1)} / {seg.maxSpeedKmh.toFixed(1)} km/h
                        </p>
                      </div>
                      <div className="rounded-md border border-white/10 bg-white/5 p-2">
                        <p className="text-slate-400">Objetivo / segura</p>
                        <p className="text-white font-semibold">
                          {seg.targetMinKmh}-{seg.targetMaxKmh} / {seg.safeMaxKmh} km/h
                        </p>
                      </div>
                    </div>

                    <div className="mt-2">
                      <SegmentMiniMap points={seg.points} />
                    </div>

                    {aiSegmentRecommendations[seg.index] && (
                      <div className="mt-2 rounded-md border border-gdh-brand/30 bg-gdh-brand/10 p-2">
                        <p className="text-[11px] uppercase tracking-wide text-gdh-brand-highlight font-semibold">
                          Recomendación IA del tramo
                        </p>
                        <p className="text-[12px] text-slate-100 mt-1 leading-relaxed">
                          {aiSegmentRecommendations[seg.index]}
                        </p>
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function MetricCell({
  label,
  value,
  withBorder = false,
}: {
  label: string
  value: string
  withBorder?: boolean
}) {
  return (
    <div className={`p-3 text-center ${withBorder ? 'border-l border-white/10' : ''}`}>
      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">{label}</p>
      <p className="text-4xl font-black text-white leading-tight">{value}</p>
    </div>
  )
}

export default function AttemptStatsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gdh-page flex items-center justify-center">
          <BrandLogoLoader label="Cargando estadísticas..." compact showRing />
        </div>
      }
    >
      <AttemptStatsInner />
    </Suspense>
  )
}
