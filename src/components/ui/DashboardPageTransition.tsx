'use client'

import { usePathname } from 'next/navigation'
import { useReducedMotion, motion, AnimatePresence } from 'framer-motion'
import type { ReactNode } from 'react'

/**
 * Al cambiar de ruta bajo /dashboard, entrada suave del contenido (sin parpadeo en carga inicial).
 */
export function DashboardPageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const reduce = useReducedMotion()

  return (
    /**
     * `sync`: entrada y salida a la vez. `wait` obligaba a terminar el fade-out antes de montar
     * la nueva ruta (~240ms+ extra de sensación “pesada” en cada tab del nav).
     */
    <AnimatePresence mode="sync" initial={false}>
      <motion.div
        key={pathname}
        className="flex-1 min-h-0"
        /**
         * Evitamos transforms en el wrapper para que elementos `fixed`
         * dentro de páginas dashboard (headers/docks) queden anclados al viewport.
         */
        initial={{ opacity: reduce ? 0.98 : 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: reduce ? 0.98 : 0 }}
        transition={{ duration: reduce ? 0.12 : 0.16, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
