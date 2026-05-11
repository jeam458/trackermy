'use client'

import Image from 'next/image'

/** Logo de marca completo (montaña + wordmark); no confundir con el rostro del pet para el atlas. */
export const BRAND_MARK_IMAGE_SRC = '/brand/guarddh-logo.jpg'

type BrandLogoLoaderProps = {
  label?: string
  compact?: boolean
  showRing?: boolean
}

type BrandSpinnerProps = {
  size?: number
  className?: string
}

/**
 * Loader de marca: asset oficial `guarddh-logo.jpg` y pulso suave vía CSS
 * (`globals.css` → `.gdh-brand-logo-loader__pulse`), sin anime en el cliente.
 */
export function BrandLogoLoader({
  label = 'Cargando…',
  compact = false,
  showRing = false,
}: BrandLogoLoaderProps) {
  const logoW = compact ? 200 : 240
  const logoH = compact ? 132 : 158
  const ringSize = Math.round(Math.max(logoW, logoH) * 1.12)
  const ringThickness = compact ? 4 : 5

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative flex items-center justify-center" style={{ width: ringSize, height: ringSize }}>
        {showRing ? (
          <div
            className="gdh-brand-logo-loader__ring absolute rounded-full border-solid border-teal-400/80 border-r-transparent"
            style={{
              width: ringSize,
              height: ringSize,
              borderWidth: ringThickness,
              boxShadow: '0 0 0 1px rgba(45,212,191,0.12), 0 0 20px rgba(45,212,191,0.18)',
            }}
          />
        ) : null}
        <div
          className="gdh-brand-logo-loader__pulse relative overflow-hidden rounded-2xl border border-white/12 bg-[#0c0f14] shadow-[0_12px_36px_rgba(0,0,0,0.5)]"
          style={{ width: logoW, height: logoH }}
        >
          <Image
            src={BRAND_MARK_IMAGE_SRC}
            alt="guardDh"
            fill
            sizes="(max-width: 480px) 200px, 240px"
            className="object-contain p-3"
            priority
          />
        </div>
      </div>
      <div className="min-h-[1.25rem]">
        <p className="text-sm text-slate-400 tracking-wide">{label}</p>
      </div>
    </div>
  )
}

/**
 * Spinner compacto reutilizable para estados de carga inline.
 */
export function BrandSpinner({ size = 22, className = '' }: BrandSpinnerProps) {
  const inner = Math.max(10, Math.round(size * 0.62))

  return (
    <span
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <span
        className="gdh-brand-spinner__ring absolute inset-0 rounded-full border-2 border-teal-400/85 border-r-transparent"
        style={{ boxShadow: '0 0 10px rgba(45,212,191,0.22)' }}
      />
      <span
        className="relative z-[1] block overflow-hidden rounded-full bg-[#0c0f14] ring-1 ring-white/10"
        style={{ width: inner, height: inner }}
      >
        <Image
          src={BRAND_MARK_IMAGE_SRC}
          alt=""
          width={inner}
          height={inner}
          className="object-contain p-[2px]"
          sizes={`${inner}px`}
        />
      </span>
    </span>
  )
}
