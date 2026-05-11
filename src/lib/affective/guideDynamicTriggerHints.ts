import { GUIDE_DYNAMIC_TRIGGER_HINTS_ES } from '@/lib/affective/data/guideDynamicTriggerHints.es'

export function getDynamicTriggerHintEs(domain: string, action: string): string | undefined {
  return GUIDE_DYNAMIC_TRIGGER_HINTS_ES[`${domain}.${action}`]
}
