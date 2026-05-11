import { computeReplayVerticalContext } from '@/lib/replay/replayVerticalContext'
import type { ReplayGpsPoint } from '@/lib/attemptReplayGps'

describe('computeReplayVerticalContext', () => {
  it('subida con pendiente y velocidad moderada → subida + pedaleo probable', () => {
    const t0 = 1_700_000_000_000
    const STEP = 1000
    const pts: ReplayGpsPoint[] = []
    for (let i = 0; i < 25; i++) {
      const lat = -13.4 + i * 0.00008
      const lng = -72.01 + i * 0.00005
      pts.push({
        lat,
        lng,
        t: t0 + i * STEP,
        altitudeM: 3000 + i * 3,
        speedMps: 4.2,
      })
    }
    const tMs = pts[20]!.t
    const r = computeReplayVerticalContext(pts, tMs, t0)
    expect(r.vertical_mode).toBe('subida')
    expect(r.grade_pct_est).not.toBeNull()
    expect((r.grade_pct_est ?? 0) > 3).toBe(true)
    expect(r.uphill_pedaling_likely).toBe(true)
    expect(r.lookback_horizontal_m).not.toBeNull()
  })

  it('sin altitud en puntos → desconocido', () => {
    const t0 = 1_700_000_000_000
    const pts: ReplayGpsPoint[] = [
      { lat: -13.4, lng: -72.01, t: t0 },
      { lat: -13.41, lng: -72.02, t: t0 + 2000 },
    ]
    const r = computeReplayVerticalContext(pts, t0 + 2000, t0)
    expect(r.vertical_mode).toBe('desconocido')
    expect(r.grade_pct_est).toBeNull()
  })
})
