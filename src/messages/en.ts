import type { AppMessages } from './types'
import { profileMessagesEn } from './profileMessages.en'
import { voiceMessagesEn } from './voiceMessages.en'

/** English UI copy — same shape as `es` (type-checked). */
export const en: AppMessages = {
  common: {
    routeFallback: 'Route',
    defaultRiderName: 'Rider',
    speedUnit: 'km/h',
    distanceUnitKm: 'km',
    kmSuffix: ' km',
  },

  activityCalendar: {
    sectionEyebrow: 'Log',
    ariaPrevMonth: 'Previous month',
    ariaNextMonth: 'Next month',
    weekdayInitials: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const,
    emptyDay: 'No runs logged that day.',
    hint: 'Tap a day with a dot for time and replay link. No dot means no runs that day.',
  },

  activity: {
    loadingLabel: 'Loading activity…',
    pageTitle: 'Activity',
    pageSubtitle: 'Progress, calendar and personal bests in one place.',
    calendarHeroEyebrow: 'Calendar',
    weekStripThisWeek: 'This week',
    weekKmSummary: '{km} km in the selected week',
    gallerySectionTitle: 'Gallery & community',
    autoAnalysisTitle: 'Automatic analysis',
    autoAnalysisEmpty: 'Not enough history for automatic analysis yet.',
    trendSectionTitle: 'Recent trend',
    trendChartEmpty: 'Not enough data for the chart.',
    chartLegendDistance: 'Distance (km)',
    chartLegendAvgSpeed: 'Average speed (km/h)',
    chartSessionPrefix: 'S',
    statMaxSpeedLabel: 'Max speed',
    statAvgSpeedLabel: 'Average speed',
    statPerformanceLabel: 'Performance score',
    linkRoutesTitle: 'Routes',
    linkRoutesSubtitle: 'View your routes and details',
    linkRankingTitle: 'Ranking',
    linkRankingSubtitle: 'Compare with other riders',
    highlightsSectionTitle: 'Best times',
    personalRecordTitle: 'New personal record',
    personalRecordRouteLine: 'on {routeName}!',
    personalRecordTimeLine: '{routeName} · {time}',
    highlightsEmpty: 'When you log runs you will see your best time per route (personal records) here.',
    rankingsSectionTitle: 'Your rankings by route',
    rankingsLoading: 'Updating rankings…',
    bestTimeLabel: 'Best time: {time}',
    rankingsEmpty: 'When you have attempts on public routes your positions will appear here.',
    communitySectionTitle: 'Community feed',
    communityLoading: 'Loading community activity…',
    communityCommentMeta: 'Commented on your run on {routeName} · {time}',
    communityViewReplay: 'View replay',
    communityEmpty: 'No community comments on your public runs yet.',
    weeklyRankingCta: 'View weekly ranking',

    insights: {
      recentKmMore:
        'You rode {km} km more on your latest run than the previous one (distance per session).',
      recentKmLess: 'You rode {km} km less on your latest run than the previous one.',
      recentSpeedUp: 'Your average speed on the latest run went up {delta} km/h vs the previous one.',
      recentSpeedDown: 'Your average speed on the latest run went down {delta} km/h vs the previous one.',
      weeklyVolumeLow: 'Low weekly volume: try adding 2–3 more runs for consistency.',
      weeklyVolumeMid: 'Moderate weekly volume: keep frequency and work key sections.',
      weeklyVolumeHigh: 'High weekly volume: prioritize technique and risk control.',
      bestRankLine: 'Your current best position is #{rank} on {routeName} ({time}).',
      globalPaceLine: 'Overall: {avg} km/h average, peak {max} km/h, performance {perf}/10.',
    },
  },

  nav: {
    discover: 'Discover',
    activity: 'Activity',
    routes: 'Routes',
    ranking: 'Ranking',
    profile: 'Profile',
    recordFab: 'Ride',
    recordFabAria:
      'Ride: on a route detail starts recording that route; elsewhere choose a free ride, new route, or an existing route',
  },

  voice: voiceMessagesEn,

  profile: profileMessagesEn,
}
