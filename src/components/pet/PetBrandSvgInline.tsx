'use client'

import { useEffect, useRef, useState } from 'react'
import { classifyPetPathByBBox } from '@/lib/pet/petSvgPathParts'
import { PET_BRAND_SVG_URL } from '@/lib/pet/petRuntimeConfig'

type Props = {
  className?: string
  /** Llamado cuando el SVG está montado y los paths llevan data-gdh-part (si aplicó). */
  onSvgReady?: (svg: SVGSVGElement | null) => void
}

/**
 * Inserta `public/brand/pet.svg` como SVG vivo en el DOM y etiqueta paths por región (`data-gdh-part`)
 * usando getBBox(); habilita selectores para animejs.
 */
export function PetBrandSvgInline({ className = '', onSvgReady }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const onReadyRef = useRef(onSvgReady)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    onReadyRef.current = onSvgReady
  }, [onSvgReady])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    let cancelled = false
    setError(null)

    fetch(PET_BRAND_SVG_URL, { cache: 'force-cache' })
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`)
        return r.text()
      })
      .then((text) => {
        if (cancelled || !mountRef.current) return

        mount.innerHTML = ''
        const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
        const errEl = doc.querySelector('parsererror')
        if (errEl) {
          setError('SVG parse')
          onReadyRef.current?.(null)
          return
        }

        const root = doc.documentElement
        const imported = document.importNode(root, true)
        if (!(imported instanceof SVGSVGElement)) {
          setError('SVG parse')
          onReadyRef.current?.(null)
          return
        }
        imported.removeAttribute('width')
        imported.removeAttribute('height')
        imported.setAttribute('width', '100%')
        imported.setAttribute('height', '100%')
        imported.setAttribute('preserveAspectRatio', 'xMidYMid slice')
        imported.id = 'gdh-brand-pet-svg'
        imported.style.display = 'block'

        mount.appendChild(imported)

        requestAnimationFrame(() => {
          if (cancelled) return
          const paths = imported.querySelectorAll('path')
          paths.forEach((path) => {
            let box: DOMRect
            try {
              box = path.getBBox()
            } catch {
              return
            }
            const part = classifyPetPathByBBox(box)
            if (part) path.setAttribute('data-gdh-part', part)
          })
          onReadyRef.current?.(imported)
        })
      })
      .catch(() => {
        if (!cancelled) {
          setError('fetch')
          onReadyRef.current?.(null)
        }
      })

    return () => {
      cancelled = true
      mount.innerHTML = ''
      onReadyRef.current?.(null)
    }
  }, [])

  return (
    <div
      ref={mountRef}
      className={`absolute inset-0 overflow-hidden pointer-events-none select-none ${className}`}
      aria-hidden
      data-pet-brand-svg-host={error ? 'error' : 'ok'}
    />
  )
}
