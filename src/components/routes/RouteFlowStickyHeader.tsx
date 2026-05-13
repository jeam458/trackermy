'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Cabecera sticky compartida en flujos de ruta / intento (misma línea visual que `routes/view`).
 */
export function RouteFlowStickyHeader({
  backHref,
  backLabel,
  trailing,
  title,
  subtitle,
  meta,
  /** Dentro de `MobileMain` con padding: compensa el `p-4` para que la barra llegue al borde de la tarjeta. */
  bleedInline = false,
}: {
  backHref: string
  backLabel: string
  /** Botones o enlaces a la derecha (p. ej. estadísticas, compartir). */
  trailing?: ReactNode
  title?: ReactNode
  subtitle?: ReactNode
  meta?: ReactNode
  bleedInline?: boolean
}) {
  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full border-b border-white/10 bg-[#121821]/95 backdrop-blur-md',
        bleedInline && '-mx-4',
      )}
    >
      <div className="mx-auto max-w-lg px-4 pb-3 pt-[max(0.75rem,calc(env(safe-area-inset-top)+0.25rem))]">
        <div className="flex w-full flex-nowrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <Link
              href={backHref}
              className="inline-flex min-w-0 max-w-full items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white"
            >
              <ArrowLeft size={18} className="shrink-0" aria-hidden />
              <span className="truncate">{backLabel}</span>
            </Link>
          </div>
          {trailing ? (
            <div className="flex shrink-0 flex-nowrap items-center justify-end gap-2">{trailing}</div>
          ) : null}
        </div>
        {title != null && title !== '' ? (
          <div className="mt-3 border-t border-white/5 pt-3">
            <h1 className="text-2xl font-bold text-white">{title}</h1>
            {subtitle ? <div className="mt-1 space-y-1 text-slate-300">{subtitle}</div> : null}
            {meta ? <div className="mt-1 text-[11px] text-slate-500 font-mono">{meta}</div> : null}
          </div>
        ) : null}
      </div>
    </header>
  )
}
