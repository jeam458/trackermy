'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Play } from 'lucide-react'
import { DASHBOARD_BOTTOM_NAV_Z_INDEX } from '@/app/dashboard/components/DashboardBottomNav'

/**
 * CTA fijo «Iniciar recorrido» en portal a `document.body` (mismo nivel que el bottom nav),
 * para que el z-index sea efectivo y no quede tapado por `overflow` del layout del dashboard.
 */
export function RouteViewStartRideDock({ onStart }: { onStart: () => void }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed left-0 right-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] px-4 pb-1.5 pointer-events-none"
      style={{ zIndex: DASHBOARD_BOTTOM_NAV_Z_INDEX + 1 }}
    >
      <div className="pointer-events-auto max-w-7xl mx-auto w-full">
        <button
          type="button"
          onClick={onStart}
          className="flex w-full min-h-[3.35rem] items-center justify-center gap-3 rounded-2xl border border-teal-400/45 bg-teal-600 px-5 py-4 text-lg font-bold leading-snug text-white shadow-lg shadow-teal-950/40 transition-colors [text-shadow:0_1px_2px_rgba(0,0,0,0.25)] hover:bg-teal-500 active:bg-teal-700"
        >
          <Play size={24} />
          Iniciar recorrido
        </button>
      </div>
    </div>,
    document.body
  )
}
