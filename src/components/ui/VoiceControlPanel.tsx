'use client'

import { Volume2, BookmarkPlus } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Subconjunto del retorno de `useDashboardVoiceCoach` usado en UI. */
export type VoiceCoachUi = {
  hidden: boolean
  supported: boolean
  listening: boolean
  toggleListen: () => void
  learnMode: boolean
  setLearnMode: (v: boolean) => void
  coachVoiceRead: boolean
  setCoachVoiceRead: (v: boolean) => void
  pendingLearn: { transcript: string; path: string } | null
  savePendingShortcut: () => void | Promise<void>
  voice: {
    listen: string
    stop: string
    learnMode: string
    saveShortcut: string
    coachVoiceReadHint: string
  }
}

type VoiceControlPanelProps = {
  voiceCoach: VoiceCoachUi
  /** Cabecera: botón TTS algo más pequeño (misma fila que el dock). */
  density?: 'default' | 'header'
}

/** Contenedor compartido pet + voz (alineación vertical y “una sola pieza”). */
export const COACH_DOCK_CLUSTER_CLASS =
  'flex items-center gap-2 rounded-[1.35rem] border border-white/[0.09] bg-[#0a0f16]/90 px-2 py-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.38)] backdrop-blur-md ring-1 ring-inset ring-white/[0.04]'

/** Variante compacta para slot en cabecera (una sola fila). */
export const COACH_HEADER_CLUSTER_CLASS =
  'flex items-center gap-0.5 rounded-xl border border-white/[0.08] bg-[#0a0f16]/92 px-0.5 py-0 shadow-md backdrop-blur-md ring-1 ring-inset ring-white/[0.03]'

const iconBtnDefault =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#121821]/90 text-slate-200 shadow-sm transition-colors hover:border-white/18 hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40'

const iconBtnHeader =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[#121821]/90 text-slate-200 shadow-sm transition-colors hover:border-white/18 hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40'

/**
 * Solo lectura TTS del coach (y guardar atajo si el flujo dejó algo pendiente).
 * Sin micrófono ni toggle de aprendizaje en UI: aprendizaje queda activo por defecto en el hook.
 */
export function VoiceControlPanel({ voiceCoach, density = 'default' }: VoiceControlPanelProps) {
  if (voiceCoach.hidden) return null

  const iconBtn = density === 'header' ? iconBtnHeader : iconBtnDefault
  const iconClass = density === 'header' ? 'h-3.5 w-3.5' : 'h-4 w-4'

  return (
    <div
      className="flex flex-row items-center justify-center gap-1"
      role="toolbar"
      aria-label="Lectura en voz del coach"
    >
      <button
        type="button"
        onClick={() => voiceCoach.setCoachVoiceRead(!voiceCoach.coachVoiceRead)}
        className={cn(
          iconBtn,
          voiceCoach.coachVoiceRead
            ? 'border-sky-400/45 bg-sky-500/15 text-sky-100'
            : 'text-slate-400',
        )}
        aria-pressed={voiceCoach.coachVoiceRead}
        aria-label={voiceCoach.voice.coachVoiceReadHint}
        title={voiceCoach.voice.coachVoiceReadHint}
      >
        <Volume2 className={iconClass} aria-hidden />
      </button>

      {voiceCoach.pendingLearn ? (
        <button
          type="button"
          onClick={() => void voiceCoach.savePendingShortcut()}
          className={cn(iconBtn, 'border-amber-500/40 bg-amber-500/10 text-amber-100')}
          title={voiceCoach.voice.saveShortcut}
          aria-label={voiceCoach.voice.saveShortcut}
        >
          <BookmarkPlus className={iconClass} aria-hidden />
        </button>
      ) : null}
    </div>
  )
}
