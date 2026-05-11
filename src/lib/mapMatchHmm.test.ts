import { matchGpsTraceToSegmentsHmm, filterSegmentsNearTrack, type HmmSegment } from '@/lib/mapMatchHmm'

describe('mapMatchHmm', () => {
  const seg: HmmSegment[] = [
    {
      a: { latitude: -13.5, longitude: -71.9 },
      b: { latitude: -13.502, longitude: -71.9 },
    },
  ]

  it('snappea puntos ruidosos cerca de un segmento', () => {
    const pts = [
      { latitude: -13.5005, longitude: -71.9004 },
      { latitude: -13.5012, longitude: -71.8997 },
      { latitude: -13.5018, longitude: -71.9001 },
    ]
    const { snapped, offRouteFlags } = matchGpsTraceToSegmentsHmm(pts, seg, {
      maxSnapMeters: 120,
      sigmaEmissionM: 20,
      sigmaTransitionM: 40,
    })
    expect(snapped).toHaveLength(3)
    expect(offRouteFlags.every((o) => o === false)).toBe(true)
    expect(Math.abs(snapped[0]!.latitude - (-13.5005))).toBeLessThan(0.002)
  })

  it('filterSegmentsNearTrack reduce el conjunto', () => {
    const many: HmmSegment[] = [
      ...seg,
      {
        a: { latitude: 10, longitude: 10 },
        b: { latitude: 10.001, longitude: 10 },
      },
    ]
    const pts = [{ latitude: -13.501, longitude: -71.9 }]
    const f = filterSegmentsNearTrack(many, pts, 0.05)
    expect(f.length).toBe(1)
  })
})
