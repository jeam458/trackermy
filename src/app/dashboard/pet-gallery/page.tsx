'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { GuardDhPet } from '@/components/pet/GuardDhPet'
import { ALL_PET_EMOTIONS, PET_EMOTION_LABELS, type PetEmotion } from '@/components/pet/guardDhPetTypes'
import {
  DashboardAppTopBar,
  DashboardAppTopBarHeading,
  DASHBOARD_APP_TOP_BAR_ICON_BUTTON_CLASS,
  DashboardCoachHeaderSlot,
} from '@/app/dashboard/components/DashboardAppTopBar'
import { cn } from '@/lib/utils'

export default function PetGalleryPage() {
  return (
    <div className="min-h-screen bg-gdh-canvas-2 text-slate-100 pb-28">
      <DashboardAppTopBar
        leading={
          <Link
            href="/dashboard"
            className={cn(DASHBOARD_APP_TOP_BAR_ICON_BUTTON_CLASS)}
            aria-label="Volver"
          >
            <ArrowLeft size={22} aria-hidden />
          </Link>
        }
        center={
          <DashboardAppTopBarHeading
            title="Pet GuardDH — galería"
            subtitle={
              <span className="text-center text-[10px] leading-snug sm:text-xs">
                Mismo rostro (atlas) · crossfade <code className="text-slate-400">animejs</code> en{' '}
                <code className="text-slate-400">guardDhPetAnime.ts</code> · celdas en{' '}
                <code className="text-slate-400">guardDhPetRostroFrames.ts</code>
              </span>
            }
          />
        }
        trailing={<DashboardCoachHeaderSlot />}
      />

      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-3xl mx-auto">
        {ALL_PET_EMOTIONS.map((e: PetEmotion) => (
          <div
            key={e}
            className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 flex flex-col items-center gap-2 text-center"
          >
            <GuardDhPet emotion={e} size={96} showcase />
            <p className="text-xs font-semibold text-teal-200/90">{PET_EMOTION_LABELS[e]}</p>
            <p className="text-[10px] text-slate-500 font-mono break-all">{e}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
