import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Hook to determine pet visibility based on current context and user preferences
 */
export function usePetVisibility() {
  const pathname = usePathname()
  
  // Check if we're in a replay view
  const isReplayView = pathname.includes('/dashboard/routes/attempt-replay')
  
  // Check if sidebar is open (pet moves to sidebar when open)
  // We'll need to get this from context or state - for now we'll infer from pathname
  const isSidebarOpen = pathname.includes('/dashboard') && !pathname.includes('/login')
  
  // Check if we're recording or viewing route (bottom dock positions)
  const isRecordingOrViewing = 
    pathname.includes('/dashboard/routes/record') || 
    pathname.includes('/dashboard/routes/view')
  
  // Determine if pet should be visible based on context
  const shouldBeVisible = useMemo(() => {
    // Always hide during login
    if (pathname.includes('/login')) return false
    
    // Hide during replays to avoid distraction (especially video replays)
    if (isReplayView) return false
    
    // Show in most other contexts
    return true
  }, [pathname, isReplayView])
  
  // Determine optimal position based on context
  const position = useMemo(() => {
    if (isSidebarOpen) return 'sidebar'
    if (isRecordingOrViewing) return 'bottom-dock'
    return 'floating'
  }, [isSidebarOpen, isRecordingOrViewing])
  
  return {
    visible: shouldBeVisible,
    position,
    isReplayView,
    isRecordingOrViewing
  }
}