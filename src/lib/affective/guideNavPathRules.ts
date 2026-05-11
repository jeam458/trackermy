import { GUIDE_APP_TRIGGER_META } from '@/lib/affective/data/guideAppTriggerCatalog.meta'

export type GuideNavTriggerId = keyof typeof GUIDE_APP_TRIGGER_META

export type GuideNavPathRule = {
  readonly triggerId: GuideNavTriggerId
  readonly match: (normalizedPath: string) => boolean
}

export const GUIDE_NAV_PATH_RULES: readonly GuideNavPathRule[] = [
  { triggerId: 'nav.dashboard_home', match: (p) => p === '/dashboard' },
  { triggerId: 'nav.attempt_replay', match: (p) => p.includes('/routes/attempt-replay') },
  { triggerId: 'nav.attempt_stats', match: (p) => p.includes('/routes/attempt-stats') },
  { triggerId: 'nav.route_ranking', match: (p) => p.includes('/routes/route-ranking') },
  { triggerId: 'nav.route_record', match: (p) => p.includes('/routes/record') },
  { triggerId: 'nav.route_create_mobile', match: (p) => p.includes('/routes/create/mobile') },
  { triggerId: 'nav.route_create', match: (p) => p.includes('/routes/create') },
  { triggerId: 'nav.route_edit', match: (p) => p.includes('/routes/edit') },
  { triggerId: 'nav.route_detail', match: (p) => p.includes('/routes/view') },
  { triggerId: 'nav.routes_list', match: (p) => p === '/dashboard/routes' },
  { triggerId: 'nav.routes_list', match: (p) => p.startsWith('/dashboard/routes') },
  { triggerId: 'nav.activity', match: (p) => p.includes('/activity') },
  { triggerId: 'nav.profile', match: (p) => p.includes('/profile') },
  { triggerId: 'nav.notifications', match: (p) => p.includes('/notifications') },
  { triggerId: 'nav.pet_gallery', match: (p) => p.includes('/pet-gallery') },
  { triggerId: 'nav.ranking', match: (p) => p.includes('/ranking') },
  { triggerId: 'nav.record_legacy', match: (p) => p === '/dashboard/record' },
]

export function normalizeDashboardPathname(pathname: string): string {
  const raw = pathname.trim() || '/dashboard'
  return raw.toLowerCase().replace(/\/+$/, '') || '/dashboard'
}
