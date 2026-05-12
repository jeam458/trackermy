/**
 * Geometría simplificada del emblema guardDh (anillos ondulados + escudo + montaña + sol)
 * para el loader vectorial — sin imagen raster.
 */

/** Anillo cerrado con radio modulado por seno (lóbulos tipo líneas del logo). */
export function wavyRingClosedPath(
  radius: number,
  waveAmp: number,
  lobes: number,
  phaseRad: number,
  segments = 80,
): string {
  let d = ''
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2
    const rr = radius + waveAmp * Math.sin(lobes * t + phaseRad)
    const x = rr * Math.cos(t)
    const y = rr * Math.sin(t)
    d += (i === 0 ? 'M ' : ' L ') + `${x.toFixed(2)} ${y.toFixed(2)}`
  }
  d += ' Z'
  return d
}

/** Hexágono con vértice superior (similar al escudo del logo). */
export function pointyTopHexagonPoints(r: number): string {
  const pts: string[] = []
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 90)
    const x = r * Math.cos(a)
    const y = r * Math.sin(a)
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`)
  }
  return pts.join(' ')
}

/** Silueta de montaña (trazo único, estilo línea del logo). */
export const MOUNTAIN_STROKE_PATH =
  'M -13 9 L -7 -8 L -2 -3 L 3 -9 L 9 9'
