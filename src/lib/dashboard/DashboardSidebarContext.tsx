'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type DashboardSidebarContextValue = {
  open: boolean
  setOpen: (v: boolean) => void
  openSidebar: () => void
  closeSidebar: () => void
}

const DashboardSidebarContext = createContext<DashboardSidebarContextValue | null>(null)

export function DashboardSidebarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const openSidebar = useCallback(() => setOpen(true), [])
  const closeSidebar = useCallback(() => setOpen(false), [])
  const value = useMemo(
    () => ({ open, setOpen, openSidebar, closeSidebar }),
    [open, openSidebar, closeSidebar]
  )
  return <DashboardSidebarContext.Provider value={value}>{children}</DashboardSidebarContext.Provider>
}

export function useDashboardSidebar() {
  const ctx = useContext(DashboardSidebarContext)
  if (!ctx) {
    throw new Error('useDashboardSidebar must be used within DashboardSidebarProvider')
  }
  return ctx
}
