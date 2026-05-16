import type { GuideUiEvent } from '@/lib/guide-ai/types'

const MAX_TURNS = 6

export type GuideCoachTurnMemoryEntry = {
  trigger: GuideUiEvent['type']
  label?: string
  userMessage?: string
  coachTitle: string
  coachSubtitleSnippet: string
  atMs: number
}

export type GuideCoachTurnMemoryPromptRow = {
  seconds_ago: number
  trigger: string
  label: string | null
  user_message: string | null
  coach_title: string
  coach_subtitle_snippet: string
}

/** Añade un turno completado (después de respuesta del coach). */
export function appendGuideCoachTurnMemory(
  ref: { current: GuideCoachTurnMemoryEntry[] },
  entry: Omit<GuideCoachTurnMemoryEntry, 'atMs'> & { atMs?: number }
): void {
  const atMs = entry.atMs ?? Date.now()
  const coachTitle = entry.coachTitle.replace(/\s+/g, ' ').trim().slice(0, 120)
  const coachSubtitleSnippet = entry.coachSubtitleSnippet.replace(/\s+/g, ' ').trim().slice(0, 200)
  const userMessage = entry.userMessage?.replace(/\s+/g, ' ').trim().slice(0, 320)
  const label = entry.label?.replace(/\s+/g, ' ').trim().slice(0, 160)
  if (!coachTitle && !userMessage) return
  ref.current = [
    ...ref.current.slice(-(MAX_TURNS - 1)),
    {
      trigger: entry.trigger,
      label: label || undefined,
      userMessage: userMessage || undefined,
      coachTitle: coachTitle || '…',
      coachSubtitleSnippet: coachSubtitleSnippet || '…',
      atMs,
    },
  ]
}

export function coachTurnMemoryForPrompt(ref: {
  current: GuideCoachTurnMemoryEntry[]
}): GuideCoachTurnMemoryPromptRow[] {
  const now = Date.now()
  return ref.current.map((e) => ({
    seconds_ago: Math.max(0, Math.floor((now - e.atMs) / 1000)),
    trigger: e.trigger,
    label: e.label ?? null,
    user_message: e.userMessage ?? null,
    coach_title: e.coachTitle,
    coach_subtitle_snippet: e.coachSubtitleSnippet,
  }))
}
