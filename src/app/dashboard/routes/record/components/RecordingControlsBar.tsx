'use client'

import { motion } from 'framer-motion'
import { Circle, Pause, Play, Square } from 'lucide-react'
import { BrandSpinner } from '@/components/ui/BrandLogoLoader'
import { DASHBOARD_BOTTOM_NAV_Z_INDEX } from '@/app/dashboard/components/DashboardBottomNav'

type Props = {
  hidden: boolean
  isRecording: boolean
  isPaused: boolean
  armCountdown: number | null
  startingArm: boolean
  selectedRouteId: string | null
  checkingPosition: boolean
  distanceToStartM: number | null
  proximityStartM: number
  onStart: () => void
  onPauseResume: () => void
  onStop: () => void
}

export function RecordingControlsBar({
  hidden,
  isRecording,
  isPaused,
  armCountdown,
  startingArm,
  selectedRouteId,
  checkingPosition,
  distanceToStartM,
  proximityStartM,
  onStart,
  onPauseResume,
  onStop,
}: Props) {
  if (hidden) return null

  return (
    <motion.div
      className="fixed bottom-0 left-0 right-0 border-t border-white/10 bg-gdh-card/98 px-3 pt-2 pb-[max(0.35rem,env(safe-area-inset-bottom))] backdrop-blur-md"
      style={{ isolation: 'isolate', zIndex: DASHBOARD_BOTTOM_NAV_Z_INDEX + 2 }}
      initial={{ y: 18, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="mx-auto flex max-w-md items-center justify-center gap-3">
        {!isRecording ? (
          <motion.button
            onClick={onStart}
            disabled={armCountdown !== null || startingArm}
            aria-busy={checkingPosition}
            className="flex min-h-[3.25rem] flex-1 items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-gdh-brand to-gdh-brand-muted px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-[0_8px_24px_rgba(197,90,47,0.35)] [text-shadow:0_1px_2px_rgba(0,0,0,0.35)] transition-colors hover:from-gdh-brand-highlight hover:to-gdh-brand disabled:opacity-50"
            whileTap={{ scale: 0.985 }}
            whileHover={{ y: -1 }}
          >
            {startingArm ? (
              <BrandSpinner size={24} />
            ) : (
              <Circle size={24} className="fill-current" />
            )}
            {startingArm ? 'Comprobando GPS…' : 'Iniciar ruta'}
          </motion.button>
        ) : (
          <>
            <motion.button
              onClick={onPauseResume}
              className="p-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors"
              whileTap={{ scale: 0.93 }}
            >
              {isPaused ? <Play size={24} /> : <Pause size={24} />}
            </motion.button>

            <motion.button
              onClick={onStop}
              className="flex-1 py-3 bg-red-500 hover:bg-red-400 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
              whileTap={{ scale: 0.985 }}
              whileHover={{ y: -1 }}
            >
              <Square size={24} className="fill-current" />
              Detener
            </motion.button>
          </>
        )}
      </div>
    </motion.div>
  )
}
