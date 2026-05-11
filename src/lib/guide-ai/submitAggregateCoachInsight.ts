import type { GuideScreenKind } from '@/lib/guide-ai/types'

/**
 * Envía un snippet anónimo del turno del coach para refuerzo agregado (otros usuarios leen hints por screen_kind).
 * Fire-and-forget; fallas silenciosas.
 */
export function submitAggregateCoachInsight(opts: {
  screenKind: GuideScreenKind
  title: string
  subtitle?: string | null
}): void {
  const insight_es = `${opts.title.trim()}. ${(opts.subtitle || '').trim()}`.trim().slice(0, 380)
  if (insight_es.length < 16) return
  void fetch('/api/dashboard/guide-insight', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      screen_kind: opts.screenKind,
      insight_es,
    }),
  }).catch(() => {
    /* noop */
  })
}
