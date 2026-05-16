'use client'

import { GuardDhMarkLoaderSvg, GuardDhMarkSpinnerMini } from '@/components/ui/GuardDhMarkLoaderSvg'

/** Logo de marca (splash, etc.); el loader de pantalla usa SVG vectorial. */
export const BRAND_MARK_IMAGE_SRC = '/brand/patt-logo.png'

type BrandLogoLoaderProps = {
  label?: string
  compact?: boolean
  /** @deprecated ignorado; el marcador siempre es vectorial. */
  showRing?: boolean
}

type BrandSpinnerProps = {
  size?: number
  className?: string
}

/**
 * Loader de pantalla: marca PATT como SVG (anillos + hex + montaña + sol)
 * animado con animejs; tipografía alineada a la app (`--font-inter`).
 */
export function BrandLogoLoader({
  label = 'Cargando…',
  compact = false,
}: BrandLogoLoaderProps) {
  return (
    <div className="flex flex-col items-center gap-5">
      <GuardDhMarkLoaderSvg compact={compact} />
      <p
        className="max-w-xs text-center text-sm leading-snug text-slate-400 antialiased"
        style={{ fontFamily: 'var(--font-inter), ui-sans-serif, system-ui, sans-serif' }}
      >
        {label}
      </p>
    </div>
  )
}

/** Spinner compacto: anillo ondulado teal con animejs. */
export function BrandSpinner({ size = 22, className = '' }: BrandSpinnerProps) {
  return <GuardDhMarkSpinnerMini size={size} className={className} />
}
