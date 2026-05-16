'use client'

import { useReducedMotion, motion } from 'framer-motion'
import { GDH_EASE_BEZIER } from '@/lib/design/motion'

/**
 * Halo ambiental bajo todo el dashboard: lento y no intrusivo; se apaga con prefers-reduced-motion.
 */
export function DashboardAmbientBackground() {
  const reduce = useReducedMotion()

  if (reduce) {
    return (
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          background:
            'radial-gradient(ellipse 72% 54% at 18% -8%, var(--gdh-ambient-brand), transparent 68%), radial-gradient(ellipse 60% 50% at 92% 12%, var(--gdh-trail-soft), transparent 65%)',
        }}
        aria-hidden
      />
    )
  }

  return (
    <div className="pointer-events-none absolute inset-0 opacity-[0.5]">
      <motion.div
        className="absolute -top-24 -left-24 h-72 w-72 rounded-full blur-3xl"
        style={{ background: 'var(--gdh-ambient-brand)' }}
        animate={{ x: [0, 22, -8, 0], y: [0, 16, -10, 0], scale: [1, 1.045, 0.982, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: GDH_EASE_BEZIER }}
      />
      <motion.div
        className="absolute right-[-6rem] top-[20%] h-72 w-72 rounded-full blur-3xl"
        style={{ background: 'var(--gdh-ambient-trail)' }}
        animate={{ x: [0, -22, 6, 0], y: [0, -12, 11, 0], scale: [1, 0.978, 1.036, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: GDH_EASE_BEZIER, delay: 0.35 }}
      />
    </div>
  )
}
