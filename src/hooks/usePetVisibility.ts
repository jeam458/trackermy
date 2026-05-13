import { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { useDashboardSidebar } from '@/lib/dashboard/DashboardSidebarContext'
import { isDashboardCoachHeaderSlotRoute } from '@/lib/dashboard/discoverCoachPaths'

/**
 * Visibilidad y “modo” del pet coach según ruta y estado real del sidebar.
 */
export function usePetVisibility() {
  const pathname = usePathname()
  const { open: sidebarOpen } = useDashboardSidebar()

  const isReplayView = pathname.includes('/dashboard/routes/attempt-replay')

  const isRecordingRoute = pathname.includes('/dashboard/routes/record')
  /** Incluye ficha de ruta (vista detalle) para consumidores que no distinguen grabación vs. detalle. */
  const isRecordingOrViewing =
    isRecordingRoute || pathname.includes('/dashboard/routes/view')

  const shouldBeVisible = useMemo(() => {
    if (pathname.includes('/login')) return false
    return true
  }, [pathname])

  const coachUsesHeaderSlot = isDashboardCoachHeaderSlotRoute(pathname)

  const position = useMemo(() => {
    if (sidebarOpen) return 'sidebar'
    if (isRecordingRoute) return 'bottom-dock'
    if (coachUsesHeaderSlot) return 'header'
    return 'floating'
  }, [sidebarOpen, isRecordingRoute, coachUsesHeaderSlot])

  return {
    visible: shouldBeVisible,
    position,
    isReplayView,
    isRecordingOrViewing,
  }
}
