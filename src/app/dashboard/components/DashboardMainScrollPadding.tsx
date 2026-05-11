'use client'

import { usePathname } from 'next/navigation'

/**
 * En grabación el bottom nav no se renderiza; no reservar pb-24 para que el mapa y el CTA lleguen al borde inferior.
 */
export function DashboardMainScrollPadding({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || ''
  const hideBottomReserve = pathname.startsWith('/dashboard/routes/record')
  return (
    <div className={hideBottomReserve ? 'flex-1 overflow-x-hidden pb-0' : 'flex-1 overflow-x-hidden pb-24'}>
      {children}
    </div>
  )
}
