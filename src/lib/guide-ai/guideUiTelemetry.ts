'use client'

import type { GuideSessionReplaySignal } from '@/lib/guide-ai/types'

/** Evento global para que el host del guía (p. ej. `DashboardRiderCore`) correlacione replay sin depender del texto del botón. */
export const GUARDDH_GUIDE_REPLAY_EVENT = 'guarddh:guide-replay' as const

export type GuideReplayTelemetryDetail = {
  action: GuideSessionReplaySignal['action']
  elapsed_sec: number
  speed_kmh: number | null
  altitude_m: number | null
  /** Si el reproductor está en marcha en este instante (replay GPS o vídeo). */
  playing?: boolean
}

/** Tick de telemetría durante el play (velocidad/altura) para animar el pet sin esperar al LLM. */
export const GUARDDH_PET_REPLAY_TICK = 'guarddh:pet-replay-tick' as const

export type PetReplayTickDetail = {
  speed_kmh: number | null
  altitude_m: number | null
  elapsed_sec: number
  playing: boolean
  /** Desde `computeReplayVerticalContext` (ventana ~40 m sobre el track). */
  grade_pct_est?: number | null
  vertical_mode?: 'subida' | 'bajada' | 'plano' | 'desconocido' | null
  uphill_pedaling_likely?: boolean
}

export function publishPetReplayTick(detail: PetReplayTickDetail) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<PetReplayTickDetail>(GUARDDH_PET_REPLAY_TICK, {
      detail,
      bubbles: true,
    })
  )
}

export function publishReplayGuideSignal(detail: GuideReplayTelemetryDetail) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<GuideReplayTelemetryDetail>(GUARDDH_GUIDE_REPLAY_EVENT, {
      detail,
      bubbles: true,
    })
  )
}
