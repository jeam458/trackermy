/**
 * Heurística por bounding box (viewBox mascota ~1061×992 en `public/brand/pet.svg`).
 * Sin grupos en el export: etiquetamos `<path>` en runtime para animejs.
 *
 * Afiná rectángulos si el trazo futuro cambia de escala o composición.
 */

export type PetSvgPathPart =
  | 'eye-left'
  | 'eye-right'
  | 'mouth'
  | 'visor'
  | 'brow'
  | 'cheek'
  | 'face-green'

export const PET_SVG_VIEWBOX = { w: 1061, h: 992 } as const

export function classifyPetPathByBBox(box: DOMRect | SVGRect): PetSvgPathPart | null {
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const w = box.width
  const h = box.height
  const area = w * h

  if (!Number.isFinite(area) || area < 5) return null

  /** Piel / mejillas verdes (paths medianos en la “máscara” central) */
  if (cy >= 395 && cy <= 620 && cx >= 340 && cx <= 720 && area >= 400 && area <= 45000 && w < 340 && h < 260) {
    if ((cx < 455 || cx > 605) && cy >= 480 && cy <= 595 && h < 70 && w < 140) return 'cheek'
    /**
     * Anchos grandes y medios centrados pero no óvalos típicos de ojo (~100–180px):
     */
    if (area >= 2800 && w > 95 && h > 95 && cy >= 395 && cy <= 520 && cx >= 380 && cx <= 680)
      return 'face-green'

    if (
      cx >= 300 &&
      cx <= 755 &&
      cy >= 320 &&
      cy <= 510 &&
      (w > 115 || h > 115) &&
      !(
        cx >= 360 &&
        cx <= 545 &&
        w < 215 &&
        h < 215 &&
        cy <= 465
      ) &&
      !(cx >= 515 && cx <= 730 && w < 215 && h < 215 && cy <= 465)
    ) {
      if (w > 160 && h < 145 && cy >= 360 && cy <= 510) return 'visor'
    }
  }

  if (cy >= 315 && cy <= 498) {
    if (cx >= 265 && cx <= 535 && w < 235 && h < 235 && area < 52000) return 'eye-left'
    if (cx >= 528 && cx <= 785 && w < 235 && h < 235 && area < 52000) return 'eye-right'
  }

  if (cy >= 285 && cy <= 415 && cx >= 310 && cx <= 755 && w > h * 1.85 && h < 62 && area < 8500 && w > 40)
    return 'brow'

  if (cy >= 465 && cy <= 585 && cx >= 365 && cx <= 715) {
    if (h <= 52 && w >= 14 && area < 12000) return 'mouth'
    if (w > h * 1.15 && h < 38 && w < 320) return 'mouth'
  }

  return null
}

/** querySelector helper */
export function queryPart(svg: SVGSVGElement, part: PetSvgPathPart): SVGPathElement[] {
  return Array.from(svg.querySelectorAll(`path[data-gdh-part="${part}"]`)) as SVGPathElement[]
}
