/**
 * Extrae inicio y fin de un intento desde `gps_points` (JSONB) para mostrar en ranking.
 */

export type GpsStartEndDisplay = {
  startLabel: string | null
  endLabel: string | null
  mapsStartUrl: string | null
  mapsEndUrl: string | null
}

export function gpsStartEndFromAttemptJson(gps: unknown): GpsStartEndDisplay {
  if (!Array.isArray(gps) || gps.length < 1) {
    return { startLabel: null, endLabel: null, mapsStartUrl: null, mapsEndUrl: null }
  }
  const first = gps[0] as Record<string, unknown> | undefined
  const last = gps[gps.length - 1] as Record<string, unknown> | undefined
  const lat1 = Number(first?.latitude)
  const lng1 = Number(first?.longitude)
  const lat2 = Number(last?.latitude)
  const lng2 = Number(last?.longitude)

  const fmt = (lat: number, lng: number) => `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  const maps = (lat: number, lng: number) =>
    `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`

  let startLabel: string | null = null
  let mapsStartUrl: string | null = null
  if (Number.isFinite(lat1) && Number.isFinite(lng1)) {
    startLabel = fmt(lat1, lng1)
    mapsStartUrl = maps(lat1, lng1)
  }

  let endLabel: string | null = null
  let mapsEndUrl: string | null = null
  if (Number.isFinite(lat2) && Number.isFinite(lng2)) {
    endLabel = fmt(lat2, lng2)
    mapsEndUrl = maps(lat2, lng2)
  }

  return { startLabel, endLabel, mapsStartUrl, mapsEndUrl }
}
