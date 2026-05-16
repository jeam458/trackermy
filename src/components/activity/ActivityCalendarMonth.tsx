'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react'
import { useLocale } from '@/lib/i18n/LocaleProvider'

export type ActivityCalendarEntry = {
  id: string
  route_id: string
  route_name: string
  completed_at: string
  total_time: number
  distance_m: number
}

/** Lunes = 0 … domingo = 6 */
function weekdayMonFirst(d: Date): number {
  const wd = d.getDay()
  return wd === 0 ? 6 : wd - 1
}

function localYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseIsoToLocalYmd(iso: string): string {
  return localYmd(new Date(iso))
}

function fmtClock(totalSec: number) {
  const m = Math.floor(totalSec / 60)
  const s = Math.floor(totalSec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function fmtDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('es-PE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type Props = {
  entries: ActivityCalendarEntry[]
  /** Resalta los días que caen en esta semana (lunes 00:00 a domingo). */
  emphasizeWeekStart?: Date | null
}

/**
 * Calendario mensual tipo “registro de actividad”: densidad por día + detalle al elegir fecha.
 * Alineado a patrones tipo Strava (grid, día actual, chips) pero con tokens `gdh-*` de marca.
 */
function inEmphasizedWeek(ymd: string, weekStart: Date | null | undefined): boolean {
  if (!weekStart) return false
  const start = new Date(weekStart)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  const t = new Date(ymd + 'T12:00:00').getTime()
  return t >= start.getTime() && t < end.getTime()
}

export function ActivityCalendarMonth({ entries, emphasizeWeekStart = null }: Props) {
  const { messages } = useLocale()
  const c = messages.activityCalendar
  const [cursor, setCursor] = useState(() => {
    const n = new Date()
    return new Date(n.getFullYear(), n.getMonth(), 1)
  })
  const [selectedYmd, setSelectedYmd] = useState<string | null>(null)

  const byDay = useMemo(() => {
    const m = new Map<string, ActivityCalendarEntry[]>()
    for (const e of entries) {
      const k = parseIsoToLocalYmd(e.completed_at)
      const arr = m.get(k) ?? []
      arr.push(e)
      m.set(k, arr)
    }
    for (const [, arr] of m) {
      arr.sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
    }
    return m
  }, [entries])

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const monthLabel = cursor.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' })
  const first = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0).getDate()
  const pad = weekdayMonFirst(first)
  const today = new Date()
  const todayYmd = localYmd(today)

  const cells: (number | null)[] = [...Array(pad).fill(null)]
  for (let d = 1; d <= lastDay; d++) cells.push(d)

  const onPrev = () => setCursor(new Date(year, month - 1, 1))
  const onNext = () => setCursor(new Date(year, month + 1, 1))

  const selectedList =
    selectedYmd && byDay.has(selectedYmd) ? byDay.get(selectedYmd)! : []

  return (
    <section className="rounded-2xl border border-white/10 bg-gdh-card/90 p-4 shadow-xl gdh-immersive-panel">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-gdh-muted font-semibold">{c.sectionEyebrow}</p>
          <h2 className="text-lg font-semibold text-white capitalize">{monthLabel}</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onPrev}
            className="p-2 rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
            aria-label={c.ariaPrevMonth}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={onNext}
            className="p-2 rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
            aria-label={c.ariaNextMonth}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-gdh-muted mb-2">
        {c.weekdayInitials.map((d, idx) => (
          <span key={idx} className="font-semibold">
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {cells.map((day, i) => {
          if (day == null) {
            return <div key={`empty-${i}`} className="aspect-square" />
          }
          const ymd = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const list = byDay.get(ymd) ?? []
          const n = list.length
          const isToday = ymd === todayYmd
          const isSelected = selectedYmd === ymd
          const inWeek = inEmphasizedWeek(ymd, emphasizeWeekStart)

          return (
            <button
              key={ymd}
              type="button"
              onClick={() => setSelectedYmd((s) => (s === ymd ? null : ymd))}
              className={[
                'aspect-square rounded-full flex flex-col items-center justify-center text-sm font-medium transition-colors min-h-[2.5rem]',
                isToday ? 'ring-2 ring-white/80 ring-offset-2 ring-offset-[#151c25]' : '',
                inWeek && !isSelected ? 'ring-1 ring-gdh-brand/45 ring-offset-1 ring-offset-gdh-canvas-2' : '',
                isSelected ? 'bg-gdh-brand/25 text-gdh-brand-highlight' : 'bg-white/5 text-slate-200 hover:bg-white/10',
                n === 0 ? 'opacity-70' : '',
              ].join(' ')}
            >
              <span>{day}</span>
              {n > 0 ? (
                <span className="h-1.5 w-1.5 rounded-full bg-gdh-brand shadow-[0_0_6px_rgba(20,184,166,0.7)]" aria-hidden />
              ) : (
                <span className="h-1.5 w-1.5" aria-hidden />
              )}
            </button>
          )
        })}
      </div>

      {selectedYmd != null && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-[11px] uppercase tracking-wider text-gdh-muted font-semibold mb-2">
            {new Date(selectedYmd + 'T12:00:00').toLocaleDateString('es-PE', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
          {selectedList.length === 0 ? (
            <p className="text-sm text-slate-500">{c.emptyDay}</p>
          ) : (
            <ul className="space-y-2">
              {selectedList.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/dashboard/routes/attempt-replay?attemptId=${encodeURIComponent(e.id)}&routeId=${encodeURIComponent(e.route_id)}&from=activity`}
                    className="flex items-start gap-3 rounded-xl border border-white/10 bg-slate-800/50 p-3 hover:bg-slate-800/80 transition-colors"
                  >
                    <div className="mt-0.5 rounded-lg bg-gdh-brand/15 p-2 text-gdh-brand-highlight">
                      <MapPin size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-white truncate">{e.route_name}</p>
                      <p className="text-xs text-gdh-muted">
                        {fmtDateTime(e.completed_at)} · {fmtClock(e.total_time)} ·{' '}
                        {(e.distance_m / 1000).toFixed(2)} {messages.common.distanceUnitKm}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="mt-3 text-[11px] text-slate-500 leading-relaxed">{c.hint}</p>
    </section>
  )
}
