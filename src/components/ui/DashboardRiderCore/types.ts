import type { RiderGuideMood } from '@/lib/riderGuide'

export const SIDEBAR_PET_SLOT_ID = 'gdh-sidebar-pet-slot'

/** Visible feedback: sin WebGPU la función LLM termina casi al instante; damos tiempo mínimo al foco "pensando". */
export const MIN_GUIDE_THINKING_MS = 420

export type RiderMood = RiderGuideMood

export type RiderSignal = {
  recentTriumph: boolean
  fatigue: boolean
  topRouteName?: string | null
  topRouteKm?: number | null
  weeklyKm?: number | null
  approxLat?: number | null
  approxLng?: number | null
}

export type RiderVisualTokens = {
  glow: string
  ring: string
  text: string
  bubbleClass: string
  caretClass: string
  subtitleClass: string
}
