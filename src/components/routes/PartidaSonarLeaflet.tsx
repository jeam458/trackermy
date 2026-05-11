'use client'

import { useEffect } from 'react'
import type { JSAnimation } from 'animejs'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { animate } from 'animejs'

const SONAR_WRAP_PX = 112
const SONAR_HALF = SONAR_WRAP_PX / 2

export type PartidaSonarLeafletProps = {
  position: [number, number]
  ringColor: string
  /** Clave estable para reiniciar el efecto al cambiar ruta/coords */
  signature: string
  /** Por debajo del pin «A» en RouteMapEditor; más alto en vista previa sola */
  zIndexOffset?: number
  /** Si false, solo anillos (cuando encima hay otro marcador, p. ej. letra A) */
  showCoreDot?: boolean
}

/**
 * Ondas tipo sonar en la partida (animejs), capa Leaflet imperativa para no depender del orden SVG de react-leaflet.
 */
export function PartidaSonarLeaflet({
  position,
  ringColor,
  signature,
  zIndexOffset = 500,
  showCoreDot = true,
}: PartidaSonarLeafletProps) {
  const map = useMap()

  useEffect(() => {
    const wrap = document.createElement('div')
    wrap.style.cssText = `position:relative;width:${SONAR_WRAP_PX}px;height:${SONAR_WRAP_PX}px;pointer-events:none;overflow:visible`

    const rings: HTMLDivElement[] = []
    for (let i = 0; i < 3; i++) {
      const ring = document.createElement('div')
      ring.style.cssText = [
        'position:absolute',
        'left:50%',
        'top:50%',
        'width:40px',
        'height:40px',
        'margin-left:-20px',
        'margin-top:-20px',
        `border:2px solid ${ringColor}`,
        'border-radius:50%',
        'opacity:0.48',
        'box-sizing:border-box',
        'will-change:transform,opacity',
        'transform-origin:center center',
      ].join(';')
      rings.push(ring)
      wrap.appendChild(ring)
    }

    if (showCoreDot) {
      const core = document.createElement('div')
      core.style.cssText = [
        'position:absolute',
        'left:50%',
        'top:50%',
        'width:12px',
        'height:12px',
        'margin-left:-6px',
        'margin-top:-6px',
        'background:#22c55e',
        'border:2px solid #ecfdf5',
        'border-radius:50%',
        'box-shadow:0 0 12px rgba(34,197,94,0.55)',
        'z-index:2',
      ].join(';')
      wrap.appendChild(core)
    }

    const icon = L.divIcon({
      className: 'leaflet-sonar-partida',
      html: wrap,
      iconSize: [SONAR_WRAP_PX, SONAR_WRAP_PX],
      iconAnchor: [SONAR_HALF, SONAR_HALF],
    })

    const marker = L.marker(L.latLng(position[0], position[1]), {
      icon,
      interactive: false,
      zIndexOffset,
    }).addTo(map)

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

    const animations: JSAnimation[] = []
    if (reduced) {
      rings.forEach((ring, i) => {
        ring.style.opacity = '0.22'
        ring.style.transform = `scale(${1 + i * 0.35})`
      })
    } else {
      rings.forEach((ring, i) => {
        animations.push(
          animate(ring, {
            scale: [0.32, 2.1],
            opacity: [0.52, 0],
            duration: 2400,
            ease: 'outQuad',
            loop: true,
            delay: i * 760,
          })
        )
      })
    }

    return () => {
      animations.forEach((a) => {
        if (typeof (a as { revert?: () => void }).revert === 'function') {
          ;(a as { revert: () => void }).revert()
        }
      })
      map.removeLayer(marker)
    }
  }, [map, position[0], position[1], ringColor, signature, zIndexOffset, showCoreDot])

  return null
}
