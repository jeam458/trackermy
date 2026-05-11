import { maxPlausibleStepMeters, mergeSpeedReadingsMps } from './gpsRecordingMath'

describe('maxPlausibleStepMeters', () => {
  const base = {
    maxSpeedMps: 40,
    maxAccelMps2: 7,
    gpsMarginK: 2.2,
    gpsMarginBaseM: 4,
    accLastM: 5,
    accNextM: 5,
  }

  it('permite un paso acorde a ~100 km/h en 1 s con v previa alta (≈28 m/s)', () => {
    const dt = 1
    const dMax = maxPlausibleStepMeters({
      ...base,
      vLastMps: 28,
      dtSec: dt,
    })
    // ~28 m de arco + aceleración + margen
    expect(dMax).toBeGreaterThan(25)
    expect(30).toBeLessThanOrEqual(dMax)
  })

  it('rechaza implícitamente un salto enorme: 200 m en 1 s con vLast baja', () => {
    const dMax = maxPlausibleStepMeters({
      ...base,
      vLastMps: 2,
      dtSec: 1,
    })
    expect(200).toBeGreaterThan(dMax)
  })

  it('con vLast null es permisivo (sin tramo aún)', () => {
    const dMax = maxPlausibleStepMeters({
      ...base,
      vLastMps: null,
      dtSec: 1,
    })
    expect(dMax).toBeGreaterThan(40)
  })

  it('dt no positivo = sin tope (infinito)', () => {
    const dMax = maxPlausibleStepMeters({
      ...base,
      vLastMps: 0,
      dtSec: 0,
    })
    expect(dMax).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('mergeSpeedReadingsMps', () => {
  it('toma el máximo entre derivada y dispositivo (m/s)', () => {
    expect(mergeSpeedReadingsMps(8, 11)).toBe(11)
    expect(mergeSpeedReadingsMps(12, 5)).toBe(12)
  })
})
