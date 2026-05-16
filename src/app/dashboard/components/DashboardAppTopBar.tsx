'use client'

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'
import { DASHBOARD_COACH_HEADER_SLOT_ID } from '@/components/ui/DashboardRiderCore/types'

/** Slot donde `DashboardRiderCore` renderiza el coach compacto (misma id en toda la app). */
export function DashboardCoachHeaderSlot() {
  return (
    <div
      id={DASHBOARD_COACH_HEADER_SLOT_ID}
      className="flex min-w-0 shrink-0 items-center justify-end self-center"
      aria-live="polite"
    />
  )
}

/**
 * Bloque derecho estándar (Descubrir y resto del dashboard): coach pet + voz + acciones propias de la página.
 * Mantiene la misma alineación y `gap` en todas las pantallas.
 */
export const DASHBOARD_APP_TOP_BAR_TRAILING_CLUSTER_CLASS =
  'flex min-w-0 shrink-0 items-center justify-end gap-1'

export function DashboardAppTopBarTrailingCluster({
  children,
  className,
}: {
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn(DASHBOARD_APP_TOP_BAR_TRAILING_CLUSTER_CLASS, className)}>
      <DashboardCoachHeaderSlot />
      {children}
    </div>
  )
}

/** Superficie top bar / nav inferior: tokens PATT (ver globals.css `.gdh-app-chrome-*`) */
export const DASHBOARD_APP_TOP_BAR_SURFACE_CLASS =
  'gdh-app-chrome-surface gdh-app-chrome-edge-top'

/** Barra inferior fija — mismo tratamiento visual que cabeceras */
export const DASHBOARD_BOTTOM_NAV_SURFACE_CLASS =
  'gdh-app-chrome-surface gdh-app-chrome-edge-bottom'

/** Shell sticky compartido entre pantallas del dashboard con cabecera propia (Descubrir, Mis rutas, etc.). */
export const DASHBOARD_APP_TOP_BAR_SHELL_CLASS = cn(
  'sticky top-0 z-40',
  DASHBOARD_APP_TOP_BAR_SURFACE_CLASS,
)

/** Misma tipografía de título que Descubrir (cabecera centrada). */
export const DASHBOARD_APP_TOP_BAR_TITLE_CLASS =
  'text-[1.7rem] font-extrabold leading-none tracking-tight text-white'

/** Título más pequeño cuando el centro comparte fila con coach / acciones (p. ej. ficha de ruta). */
export const DASHBOARD_APP_TOP_BAR_TITLE_COMPACT_CLASS =
  'line-clamp-2 text-[1.05rem] font-bold leading-snug tracking-tight text-white sm:text-[1.2rem]'

/**
 * Botón icono en cabecera (menú, buscar, cerrar, volver): padding y hover alineados con Descubrir.
 */
export const DASHBOARD_APP_TOP_BAR_ICON_BUTTON_CLASS =
  'inline-flex items-center justify-center rounded-xl p-2.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-white'

export function DashboardAppTopBarHeading({
  title,
  subtitle,
  titleVariant = 'default',
}: {
  title: ReactNode
  subtitle?: ReactNode
  /** `compact`: nombres largos en cabeceras con trailing ocupado (coach, iconos). */
  titleVariant?: 'default' | 'compact'
}) {
  const titleClass =
    titleVariant === 'compact'
      ? DASHBOARD_APP_TOP_BAR_TITLE_COMPACT_CLASS
      : DASHBOARD_APP_TOP_BAR_TITLE_CLASS

  return (
    <div className="min-w-0 px-1 text-center">
      <h1 className={titleClass}>{title}</h1>
      {subtitle != null && subtitle !== false ? (
        <div className="mt-1 space-y-0.5 text-xs leading-snug text-slate-400 sm:text-sm">{subtitle}</div>
      ) : null}
    </div>
  )
}

const maxWidthClass = {
  lg: 'max-w-lg',
  '4xl': 'max-w-4xl',
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
    <div
      className={cn(
        'mx-auto px-3 pb-2 pt-[max(0.75rem,calc(env(safe-area-inset-top)+0.25rem))]',
        mw,
        innerClassName,
      )}
    >
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
