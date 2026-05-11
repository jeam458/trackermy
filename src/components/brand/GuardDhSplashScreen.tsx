'use client'

import Image from 'next/image'
import { BRAND_MARK_IMAGE_SRC } from '@/components/ui/BrandLogoLoader'

/**
 * Pantalla de bienvenida marca guardDh (splash).
 * Asset oficial: `guarddh-logo.jpg` (emblema + wordmark).
 */
export function GuardDhSplashScreen({ tagline }: { tagline?: string }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#0c0f14] px-6 text-center">
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 50% 38%, rgba(45,212,191,0.12), transparent 55%), radial-gradient(ellipse 50% 40% at 50% 100%, rgba(124,58,237,0.14), transparent 50%)',
        }}
      />
      <div className="relative z-10 flex max-w-md flex-col items-center gap-6">
        <div className="relative w-[min(100%,18rem)] shrink-0 rounded-[1.75rem] border border-teal-400/30 bg-[#0c0f14] p-4 shadow-[0_0_48px_rgba(45,212,191,0.18),0_20px_50px_rgba(0,0,0,0.55)] ring-1 ring-white/10">
          <div className="relative aspect-[5/4] w-full overflow-hidden rounded-xl">
            <Image
              src={BRAND_MARK_IMAGE_SRC}
              alt="guardDh"
              fill
              className="object-contain p-1"
              priority
              sizes="(max-width: 480px) 280px, 320px"
            />
          </div>
        </div>
        {tagline ? (
          <p className="max-w-sm text-[11px] font-medium uppercase tracking-[0.22em] text-slate-400">{tagline}</p>
        ) : null}
      </div>
    </div>
  )
}
