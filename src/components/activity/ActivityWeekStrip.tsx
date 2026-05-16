'use client'

import { useMemo } from 'react'
import { mondayStartLocal } from '@/lib/activity/activityWeekDerived'

function sameMonday(a: Date, b: Date) {
  return mondayStartLocal(a).getTime() === mondayStartLocal(b).getTime()
}

type Props = {
  selectedWeekStart: Date
  onSelectWeek: (monday: Date) => void
  thisWeekLabel: string
  weekLabel: (d: Date) => string
}

/** Pills de semanas recientes (lunes como inicio); filtra métricas de actividad. */
export function ActivityWeekStrip({ selectedWeekStart, onSelectWeek, thisWeekLabel, weekLabel }: Props) {
  const options = useMemo(() => {
    const anchor = mondayStartLocal(new Date())
    return Array.from({ length: 8 }, (_, i) => {
      const d = new Date(anchor)
      d.setDate(d.getDate() - i * 7)
      return mondayStartLocal(d)
    })
  }, [])

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0f1520]/90 p-3 gdh-immersive-panel">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Semana</p>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {options.map((mon) => {
          const sel = sameMonday(mon, selectedWeekStart)
          const isThis = sameMonday(mon, new Date())
          return (
            <button
              key={mon.getTime()}
              type="button"
              onClick={() => onSelectWeek(mon)}
              className={[
                'shrink-0 rounded-xl border px-3 py-2 text-left min-w-[7.5rem] transition-colors',
                sel
                  ? 'border-gdh-brand/50 bg-gdh-brand/15 text-white shadow-[0_0_16px_rgba(227,120,69,0.12)]'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10',
              ].join(' ')}
            >
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {isThis ? thisWeekLabel : ' '}
              </span>
              <span className="block text-sm font-bold text-white leading-tight">{weekLabel(mon)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
