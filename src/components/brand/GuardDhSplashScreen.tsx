'use client'

import Image from 'next/image'
import { BRAND_MARK_IMAGE_SRC } from '@/components/ui/BrandLogoLoader'

/**
 * Pantalla de bienvenida marca PATT (splash).
 * Asset oficial: `patt-logo.png`.
 */
export function GuardDhSplashScreen({ tagline }: { tagline?: string }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gdh-canvas px-6 text-center">
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 50% 38%, color-mix(in srgb, var(--gdh-brand-highlight) 18%, transparent), transparent 55%), radial-gradient(ellipse 50% 40% at 50% 100%, color-mix(in srgb, var(--gdh-trail) 22%, transparent), transparent 50%)',
        }}
      />
      <div className="relative z-10 flex max-w-md flex-col items-center gap-6">
        <div className="relative w-[min(100%,18rem)] shrink-0 rounded-[1.75rem] border border-white/12 bg-gdh-canvas p-4 shadow-[0_0_48px_rgba(227,120,69,0.22),0_20px_50px_rgba(0,0,0,0.55)] ring-1 ring-white/10">
          <div className="relative aspect-[5/4] w-full overflow-hidden rounded-xl">
            <Image
              src={BRAND_MARK_IMAGE_SRC}
              alt="PATT"
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
