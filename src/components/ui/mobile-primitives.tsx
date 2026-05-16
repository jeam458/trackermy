'use client'

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'
import { DASHBOARD_APP_TOP_BAR_SURFACE_CLASS } from '@/app/dashboard/components/DashboardAppTopBar'

export const mobileStyles = {
  screen: 'min-h-screen bg-gdh-page text-slate-100 pb-10',
  stickyHeader: cn('sticky top-0 z-50', DASHBOARD_APP_TOP_BAR_SURFACE_CLASS),
  container: 'max-w-lg mx-auto px-3',
  main: 'max-w-lg mx-auto p-4 space-y-5',
  segmentedBase:
    'rounded-lg px-3 py-1.5 text-sm font-semibold transition border',
  segmentedActive: 'bg-gdh-brand/22 text-gdh-brand-highlight border-gdh-brand/40',
  segmentedIdle: 'bg-slate-800/70 text-slate-300 border-white/10 hover:bg-slate-700/70',
  card: 'rounded-xl border border-white/10 bg-slate-700/55',
}

export function MobileScreen({ children }: { children: ReactNode }) {
  return <div className={mobileStyles.screen}>{children}</div>
}

export function MobileHeaderShell({ children }: { children: ReactNode }) {
  return (
    <header className={mobileStyles.stickyHeader}>
      <div
        className={cn(
          mobileStyles.container,
          'pb-2 pt-[max(0.75rem,calc(env(safe-area-inset-top)+0.25rem))]',
        )}
      >
        {children}
      </div>
    </header>
  )
}

export function MobileMain({ children }: { children: ReactNode }) {
  return <main className={mobileStyles.main}>{children}</main>
}

export function SegmentedButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${mobileStyles.segmentedBase} ${
        active ? mobileStyles.segmentedActive : mobileStyles.segmentedIdle
      }`}
    >
      {children}
    </button>
  )
}
