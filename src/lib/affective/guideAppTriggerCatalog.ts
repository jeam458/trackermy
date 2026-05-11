/**
 * ## Catálogo único de disparadores de guía / pet
 *
 * Los **datos** viven en `data/guideAppTriggerCatalog.meta.ts`.
 * Las **reglas de navegación** por pathname en `guideNavPathRules.ts`.
 * Esquemas Zod: `schema/guideAffectiveSchemas.ts`.
 */
export type { GuideAppTriggerGroup, GuideAppTriggerOrigin, GuideAppTriggerMetaEntry } from '@/lib/affective/guideAppTriggerCatalog.types'
import type { GuideAppTriggerMetaEntry } from '@/lib/affective/guideAppTriggerCatalog.types'

import { GUIDE_APP_TRIGGER_META } from '@/lib/affective/data/guideAppTriggerCatalog.meta'
import {
  GUIDE_NAV_PATH_RULES,
  normalizeDashboardPathname,
  type GuideNavTriggerId,
} from '@/lib/affective/guideNavPathRules'

export { GUIDE_APP_TRIGGER_META } from '@/lib/affective/data/guideAppTriggerCatalog.meta'

export type GuideAppTriggerId = GuideNavTriggerId

const TRIGGER_ID_SET = new Set<string>(Object.keys(GUIDE_APP_TRIGGER_META))

export function isGuideAppTriggerId(x: string): x is GuideAppTriggerId {
  return TRIGGER_ID_SET.has(x)
}

export function getGuideAppTriggerMeta(id: GuideAppTriggerId): GuideAppTriggerMetaEntry {
  return GUIDE_APP_TRIGGER_META[id]
}

export function inferNavTriggerFromPathname(pathname: string): GuideAppTriggerId {
  const p = normalizeDashboardPathname(pathname)
  for (const rule of GUIDE_NAV_PATH_RULES) {
    if (rule.match(p)) return rule.triggerId
  }
  return 'nav.dashboard_other'
}
