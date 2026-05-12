'use client'

import { BrandLogoLoader } from '@/components/ui/BrandLogoLoader'

type Props = {
  label?: string
}

/**
 * Vista de carga minimalista con spinner animado.
 */
export function PageLoadingShimmer({ label = 'Cargando…' }: Props) {
  return (
    <div className="min-h-screen bg-gdh-canvas-2 flex flex-col items-center justify-center px-6 pb-24">
      <BrandLogoLoader label={label} compact showRing />
    </div>
  )
}
