'use client'

import { useRef, type ReactNode, type ButtonHTMLAttributes } from 'react'
import { pressPop } from '@/lib/animeUi'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  label: string
}

/**
 * Botón con feedback de escala vía anime.js (sustituye active:scale de Tailwind en controles clave).
 */
export function AnimeIconButton({ children, label, onPointerDown, className, ...rest }: Props) {
  const ref = useRef<HTMLButtonElement>(null)

  return (
    <button
      type="button"
      ref={ref}
      aria-label={label}
      className={className}
      onPointerDown={(e) => {
        pressPop(ref.current)
        onPointerDown?.(e)
      }}
      {...rest}
    >
      {children}
    </button>
  )
}
