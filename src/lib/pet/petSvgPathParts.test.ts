import { classifyPetPathByBBox } from '@/lib/pet/petSvgPathParts'

function box(x: number, y: number, w: number, h: number): DOMRect {
  return { x, y, width: w, height: h, top: y, left: x, right: x + w, bottom: y + h } as DOMRect
}

describe('classifyPetPathByBBox', () => {
  it('área diminuta → null', () => {
    expect(classifyPetPathByBBox(box(100, 100, 1, 2))).toBeNull()
  })

  it('bbox tipo ojo izquierdo → eye-left (evita rama face-green: w,h ≤ 95)', () => {
    expect(classifyPetPathByBBox(box(355, 355, 90, 90))).toBe('eye-left')
  })

  it('bbox tipo ojo derecho → eye-right', () => {
    expect(classifyPetPathByBBox(box(605, 355, 90, 90))).toBe('eye-right')
  })
})
