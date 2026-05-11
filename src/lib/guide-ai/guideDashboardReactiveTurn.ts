/**
 * Turnos del guía en dashboard donde el **mismo** pipeline WebLLM decide
 * mensaje + `pet_mood` (vía `finalizeGuideReaction` en `lightweightGuideLlm`).
 * Evita duplicar armado de `GuideUiEvent` y mapeo a toast en cada `useEffect`.
 */
import { generateGuideReactionWithLightLlm } from '@/lib/guide-ai/lightweightGuideLlm'
import type { GuideContext, GuideReaction, GuideSessionReplaySignal, GuideUiEvent } from '@/lib/guide-ai/types'
import type { RiderGuideMood, RiderGuideToastType } from '@/lib/riderGuide'

export type DashboardReactiveLabel =
  | 'system:gps_denied'
  | 'system:gps_unavailable'
  | 'system:network_offline'
  | 'system:network_online'
  | (string & {})

export function buildDashboardReactiveEvent(pathname: string, label: DashboardReactiveLabel): GuideUiEvent {
  return {
    type: 'data-refresh',
    pathname,
    label,
    timestamp: Date.now(),
  }
}

export function mapReactionMoodToToastType(mood: RiderGuideMood): RiderGuideToastType {
  switch (mood) {
    case 'error':
      return 'error'
    case 'warning':
      return 'warning'
    case 'triumph':
      return 'success'
    default:
      return 'info'
  }
}

export async function executeDashboardReactiveGuideTurn(input: {
  context: GuideContext
  pathname: string
  label: DashboardReactiveLabel
  executeMcpTools?: boolean
  sessionReplaySignals?: GuideSessionReplaySignal[] | null
  affectiveAugment?: Record<string, unknown> | null
}): Promise<GuideReaction> {
  const event = buildDashboardReactiveEvent(input.pathname, input.label)
  return generateGuideReactionWithLightLlm({
    context: input.context,
    event,
    executeMcpTools: input.executeMcpTools ?? false,
    sessionReplaySignals: input.sessionReplaySignals ?? undefined,
    affectiveAugment: input.affectiveAugment ?? undefined,
  })
}
