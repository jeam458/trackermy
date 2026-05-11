import {
  cumulativeMeters,
  pointAtArclength,
  snapToPath,
} from './pathMapMatch'

const line: { latitude: number; longitude: number }[] = [
  { latitude: -12, longitude: -77.0 },
  { latitude: -12.001, longitude: -77.0 },
]

describe('pathMapMatch', () => {
  it('cumulativeMeters y pointAtArclength son consistentes', () => {
    const cum = cumulativeMeters(line)
    expect(cum.length).toBe(2)
    const p = pointAtArclength(cum[1]! * 0.5, line, cum)
    expect(p).not.toBeNull()
    expect(p!.latitude).toBeGreaterThan(-12.001)
    expect(p!.latitude).toBeLessThan(-12)
  })

  it('snapToPath proyecta un punto a la polilínea', () => {
    const cum = cumulativeMeters(line)
    const snap = snapToPath(-12.0005, -77.0, line, cum)
    expect(snap).not.toBeNull()
    expect(snap!.distanceToPathM).toBeLessThan(5)
  })
})
