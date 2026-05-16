'use client'

import Link from 'next/link'
import { routeViewUrl } from '@/lib/routeViewNavigation'
import { useEffect, useRef } from 'react'
import { ChevronRight } from 'lucide-react'
import { animate, stagger } from 'animejs'
import type { Target } from 'animejs'
import type { RouteTrackPoint } from '@/core/domain/Route'
import { RouteCardSilhouette } from '@/components/routes/RouteCardSilhouette'

const DIFFICULTY_BAR_PCTS: Record<'Expert' | 'Intermediate' | 'Beginner', readonly [number, number, number]> = {
  Expert: [38, 62, 88],
  Intermediate: [28, 48, 72],
  Beginner: [22, 38, 55],
}

interface WeeklyRecordProps {
  routeId?: string
  routeName: string
  difficulty: 'Expert' | 'Intermediate' | 'Beginner'
  distance: string
  topTime: string
  topRiderName: string
  topRiderAvatar: string
  trackPoints?: RouteTrackPoint[]
  popularityLine?: string | null
  avgSpeedLine?: string | null
}

export default function WeeklyRecord({
  routeId,
  routeName,
  difficulty,
  distance,
  topTime,
  topRiderName,
  topRiderAvatar,
  trackPoints = [],
  popularityLine = null,
  avgSpeedLine = null,
}: WeeklyRecordProps) {
  const barsRef = useRef<HTMLDivElement>(null)
  const avatarRef = useRef<HTMLImageElement>(null)

  const barHeights = DIFFICULTY_BAR_PCTS[difficulty] ?? DIFFICULTY_BAR_PCTS.Intermediate

  useEffect(() => {
    const wrap = barsRef.current
    if (!wrap) return
    const bars = wrap.querySelectorAll<HTMLElement>('.route-card-signal')
    if (!bars.length) return
    animate(bars, {
      height: (el: Target) => {
        const n = el instanceof HTMLElement ? el.dataset.pct : undefined
        const h = n ?? '50'
        return ['0%', `${h}%`]
      },
      duration: 480,
      delay: stagger(70),
      ease: 'outCubic',
    })
  }, [routeId, routeName, difficulty])

  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case 'Expert':
        return 'text-rose-300'
      case 'Intermediate':
        return 'text-slate-300'
      case 'Beginner':
        return 'text-gdh-sun/95'
      default:
        return 'text-slate-400'
    }
  }

  const accentColorByDifficulty = (diff: string) => {
    switch (diff) {
      case 'Expert':
        return 'from-rose-700 via-rose-500 to-rose-400'
      case 'Intermediate':
        return 'from-gdh-brand-muted via-gdh-brand to-gdh-brand-highlight'
      case 'Beginner':
        return 'from-gdh-brand-muted/90 via-gdh-sun to-gdh-brand-highlight/90'
      default:
        return 'from-slate-600 to-slate-400'
    }
  }

  const inner = (
    <div
      data-anime-stagger
      className="relative overflow-hidden bg-gdh-card/95 backdrop-blur-md border border-white/10 p-3.5 rounded-2xl flex gap-3 shadow-lg transition-transform active:scale-[0.99] group min-h-[5.5rem]"
    >
      <div
        className={`absolute left-0 top-0 h-full w-[5px] bg-gradient-to-b ${accentColorByDifficulty(difficulty)} rounded-l-2xl`}
      />
      <div className="flex-1 space-y-2 min-w-0 pl-1.5">
        <div>
          <h3 className="text-[1.05rem] font-bold text-slate-50 truncate group-hover:text-gdh-brand-highlight transition-colors tracking-tight">
            {routeName}
          </h3>
          <p className="text-[11px] text-slate-400 font-medium tracking-wide">
            <span className={getDifficultyColor(difficulty)}>{difficulty}</span>
            <span className="mx-1.5 text-slate-500">·</span>
            {distance}
          </p>
          {(popularityLine || avgSpeedLine) && (
            <p className="text-[10px] text-slate-500 mt-1 leading-snug">
              {popularityLine}
              {popularityLine && avgSpeedLine ? <span className="text-slate-600"> · </span> : null}
              {avgSpeedLine ? <span className="text-slate-400">{avgSpeedLine}</span> : null}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 pt-0.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={avatarRef}
            src={topRiderAvatar}
            alt=""
            onLoad={() => {
              const a = avatarRef.current
              if (a) void animate(a, { scale: [0.75, 1], opacity: [0, 1], duration: 320, ease: 'outCubic' })
            }}
            onError={(e) => {
              e.currentTarget.style.opacity = '1'
            }}
            className="w-7 h-7 rounded-full border-2 border-gdh-canvas-2 bg-slate-700 shrink-0 opacity-0 [transform-origin:center]"
          />
          <p className="text-[11px] font-medium truncate leading-tight">
            {topTime ? (
              <>
                <span className="text-white">{topRiderName}</span>
                <span className="text-slate-400"> - {topTime}</span>
              </>
            ) : (
              <span className="text-slate-500">{topRiderName}</span>
            )}
          </p>
        </div>
      </div>

      <div className="flex w-[7.25rem] shrink-0 flex-col items-stretch gap-1.5 border-l border-white/10 pl-3">
        <div className="flex justify-end">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-gdh-brand-highlight"
            aria-hidden
          >
            <ChevronRight size={18} strokeWidth={2.5} className="translate-x-px" />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-end py-0.5">
          <RouteCardSilhouette trackPoints={trackPoints} />
        </div>
        <div ref={barsRef} className="flex h-6 items-end justify-end gap-1">
          {barHeights.map((h, i) => (
            <div
              key={i}
              data-pct={h}
              className="route-card-signal w-[5px] max-h-full rounded-t-sm bg-gradient-to-t from-gdh-brand-muted via-gdh-brand to-gdh-brand-highlight opacity-90"
              style={{ height: '0%' }}
            />
          ))}
        </div>
      </div>
    </div>
  )

  if (routeId) {
    return (
      <Link href={routeViewUrl(routeId, 'discover')} className="block">
        {inner}
      </Link>
    )
  }

  return inner
}
