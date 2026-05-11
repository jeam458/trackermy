import { buildReelPlanFromAttempt } from '@/lib/reel/buildReelPlanFromAttempt'
import { isReelPlanV1 } from '@/lib/reel/reelPlanTypes'

describe('buildReelPlanFromAttempt', () => {
  it('genera plan v1 con GPS y picos de velocidad', () => {
    const t0 = Date.parse('2024-01-01T12:00:00.000Z')
    const gps_points = [
      { latitude: -12, longitude: -75, speed: 2, timestamp: new Date(t0).toISOString() },
      { latitude: -12.0001, longitude: -75.0001, speed: 5, timestamp: new Date(t0 + 2000).toISOString() },
      { latitude: -12.0002, longitude: -75.0002, speed: 18, timestamp: new Date(t0 + 4000).toISOString() },
      { latitude: -12.0003, longitude: -75.0003, speed: 6, timestamp: new Date(t0 + 6000).toISOString() },
      { latitude: -12.0004, longitude: -75.0004, speed: 3, timestamp: new Date(t0 + 8000).toISOString() },
    ]
    const plan = buildReelPlanFromAttempt({
      videoSourceUrl: 'https://example.com/v.mp4',
      videoGpsOffsetMs: 0,
      gpsPointsRaw: gps_points,
      jumpsCount: 1,
      totalTimeSec: 12,
      videoDurationSec: 30,
    })
    expect(isReelPlanV1(plan)).toBe(true)
    expect(plan.version).toBe(1)
    expect(plan.segments.length).toBeGreaterThanOrEqual(2)
    expect(plan.segments[0]!.type).toBe('clip')
    expect(plan.totalPlaybackEstimateSec).toBeGreaterThan(0)
  })

  it('sin GPS usa plan por duración', () => {
    const plan = buildReelPlanFromAttempt({
      videoSourceUrl: 'https://example.com/v.mp4',
      videoGpsOffsetMs: 0,
      gpsPointsRaw: [],
      jumpsCount: 0,
      totalTimeSec: 20,
      videoDurationSec: 25,
    })
    expect(plan.segments.length).toBeGreaterThanOrEqual(1)
    expect(plan.notes?.some((n) => n.includes('GPS insuficiente'))).toBe(true)
  })
})
