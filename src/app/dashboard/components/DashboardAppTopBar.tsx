'use client'

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/** Shell sticky compartido entre pantallas del dashboard con cabecera propia (Descubrir, Mis rutas, etc.). */
export const DASHBOARD_APP_TOP_BAR_SHELL_CLASS =
  'sticky top-0 z-40 border-b border-white/10 bg-[#121821]/95 backdrop-blur-md'

const maxWidthClass = {
  lg: 'max-w-lg',
  '7xl': 'max-w-7xl',
} as const

export type DashboardAppTopBarMaxWidth = keyof typeof maxWidthClass

export type DashboardAppTopBarInnerProps = {
  leading?: ReactNode
  center: ReactNode
  trailing?: ReactNode
  children?: ReactNode
  contentMaxWidth?: DashboardAppTopBarMaxWidth
  innerClassName?: string
}

/**
 * Solo la zona interna (grid + hijos). Úsala dentro de `motion.header` si necesitás animación de entrada.
 */
export function DashboardAppTopBarInner({
  leading = null,
  center,
  trailing = null,
  children,
  contentMaxWidth = 'lg',
  innerClassName,
}: DashboardAppTopBarInnerProps) {
  const mw = maxWidthClass[contentMaxWidth]

  return (
    <div className={cn('mx-auto px-3 pb-2 pt-3', mw, innerClassName)}>
      <div className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)_minmax(0,auto)] items-center gap-2">
        <div className="flex min-h-[2.75rem] min-w-0 items-center justify-self-start">{leading}</div>
        <div className="min-w-0 justify-self-center px-1 text-center">{center}</div>
        <div className="flex min-h-[2.75rem] min-w-0 items-center justify-self-end">{trailing}</div>
      </div>
      {children ? <div className="mt-2">{children}</div> : null}
    </div>
  )
}

export type DashboardAppTopBarProps = DashboardAppTopBarInnerProps & {
  className?: string
}

/**
 * Cabecera completa (`<header>`). Cada pantalla inyecta slots; el shell visual es único.
 */
export function DashboardAppTopBar({ className, ...inner }: DashboardAppTopBarProps) {
  return (
    <header className={cn(DASHBOARD_APP_TOP_BAR_SHELL_CLASS, className)}>
      <DashboardAppTopBarInner {...inner} />
    </header>
  )
}
