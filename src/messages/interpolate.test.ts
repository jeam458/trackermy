import { interpolate } from './interpolate'

describe('interpolate', () => {
  it('reemplaza placeholders', () => {
    expect(interpolate('Hola {nombre}', { nombre: 'Ana' })).toBe('Hola Ana')
  })

  it('deja marcador si falta variable', () => {
    expect(interpolate('A {x} B', {})).toBe('A {x} B')
  })

  it('acepta números', () => {
    expect(interpolate('#{n}', { n: 3 })).toBe('#3')
  })
})
