import type { GuideInteractionSessionHint, GuideUiEventType } from '@/lib/guide-ai/types'

/** Arma la pista de “memoria corta” que va en el JSON del prompt del guía. */
export function buildGuideInteractionSessionHint(input: {
  viewEnteredAtMs: number
  recentCoachTitlesLower: readonly string[]
  lastTriggerType: GuideUiEventType
}): GuideInteractionSessionHint {
  return {
    secondsOnScreen: Math.max(0, Math.floor((Date.now() - input.viewEnteredAtMs) / 1000)),
    recentCoachTitles: [...input.recentCoachTitlesLower].filter(Boolean).slice(-4),
    lastTriggerType: input.lastTriggerType,
  }
}
