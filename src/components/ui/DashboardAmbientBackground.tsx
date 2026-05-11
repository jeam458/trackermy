'use client'

import { motion } from 'framer-motion'

export function DashboardAmbientBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 opacity-[0.55]">
      <motion.div
        className="absolute -top-24 -left-24 h-72 w-72 rounded-full blur-3xl"
        style={{ background: 'var(--gdh-ambient-brand)' }}
        animate={{ x: [0, 24, -10, 0], y: [0, 18, -12, 0], scale: [1, 1.06, 0.96, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute right-[-6rem] top-[20%] h-72 w-72 rounded-full blur-3xl"
        style={{ background: 'var(--gdh-ambient-trail)' }}
        animate={{ x: [0, -26, 8, 0], y: [0, -14, 12, 0], scale: [1, 0.95, 1.05, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  )
}
