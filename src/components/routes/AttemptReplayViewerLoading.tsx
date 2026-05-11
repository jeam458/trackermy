'use client'

import { BrandSpinner } from '@/components/ui/BrandLogoLoader'

export function AttemptReplayViewerLoading() {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
      <BrandSpinner size={22} />
      Cargando replay…
    </div>
  )
}
