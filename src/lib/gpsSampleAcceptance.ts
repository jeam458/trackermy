import {
  adaptiveMinDistanceMeters,
  haversineMeters,
  impliedSpeedMps,
  initialBearingDegrees,
  isLikelyGpsSpike,
  maxPlausibleStepMeters,
  smallestBearingDiffDegrees,
  type MapPointLike,
} from '@/lib/gpsRecordingMath'

/** Misma política de filtrado que al grabar en /routes/record (cinemática, rumbo, etc.) */
export type GpsRecordingAcceptanceOptions = {
  minAccuracy: number
  minDistance: number
  maxSpeedMps: number
  stallResampleAfterMs: number
  speedChangeAcceptMps: number
  minBearingChangeForAcceptDeg: number
  motionEnvelopeEnabled: boolean
  maxAccelMps2: number
  motionEnvelopeGpsK: number
  motionEnvelopeBaseM: number
}

export const DEFAULT_GPS_RECORDING_ACCEPTANCE_OPTIONS: GpsRecordingAcceptanceOptions = {
  minAccuracy: 22,
  minDistance: 2,
  maxSpeedMps: 40,
  stallResampleAfterMs: 5000,
  speedChangeAcceptMps: 0.85,
  minBearingChangeForAcceptDeg: 9,
  motionEnvelopeEnabled: true,
  maxAccelMps2: 7,
  motionEnvelopeGpsK: 2.2,
  motionEnvelopeBaseM: 4,
}

export type GpsPointInput = {
  latitude: number
  longitude: number
  altitude?: number
  accuracy?: number
  timestamp?: Date
}

export type GpsSegmentState = {
  lastSegmentSpeedMps: number | null
  lastSegmentBearingDeg: number | null
}

const EMPTY_SEGMENT: GpsSegmentState = {
  lastSegmentSpeedMps: null,
  lastSegmentBearingDeg: null,
}

/**
 * Evalúa si una lectura GPS debe sumarse al track, con la misma lógica en toda la app
 * (record, mobile tracker, etc.), excepto rutas dibujadas a mano en el mapa.
 */
export function evaluateGpsRecordingSample(
  last: GpsPointInput | null,
  candidate: GpsPointInput,
  segment: GpsSegmentState,
  opts: GpsRecordingAcceptanceOptions
): { accept: boolean; reason?: string; nextSegment: GpsSegmentState } {
  if (!last) {
    if (candidate.accuracy !== undefined && candidate.accuracy > 80) {
      return { accept: false, reason: 'Baja precisión GPS', nextSegment: EMPTY_SEGMENT }
    }
    return { accept: true, nextSegment: EMPTY_SEGMENT }
  }

  if (isLikelyGpsSpike(last as MapPointLike, candidate as MapPointLike, 10000)) {
    return { accept: false, reason: 'Salto inverosímil (outlier)', nextSegment: segment }
  }

  const d = haversineMeters(
    last.latitude,
    last.longitude,
    candidate.latitude,
    candidate.longitude
  )
  const accLastM = last.accuracy ?? 12
  const accNextM = candidate.accuracy ?? 12

  if (opts.motionEnvelopeEnabled && last.timestamp && candidate.timestamp) {
    const dtSec = (candidate.timestamp.getTime() - last.timestamp.getTime()) / 1000
    if (dtSec > 0) {
      const dMax = maxPlausibleStepMeters({
        vLastMps: segment.lastSegmentSpeedMps,
        dtSec,
        maxSpeedMps: opts.maxSpeedMps,
        maxAccelMps2: opts.maxAccelMps2,
        accLastM,
        accNextM,
        gpsMarginK: opts.motionEnvelopeGpsK,
        gpsMarginBaseM: opts.motionEnvelopeBaseM,
      })
      if (d > dMax) {
        return { accept: false, reason: 'Fuera de envolvente de movimiento', nextSegment: segment }
      }
    }
  }

  if (candidate.accuracy !== undefined) {
    if (candidate.accuracy > 50) {
      return { accept: false, reason: 'Señal GPS muy pobre', nextSegment: segment }
    }
    const stallTime =
      last.timestamp && candidate.timestamp
        ? candidate.timestamp.getTime() - last.timestamp.getTime() >= opts.stallResampleAfterMs
        : false
    if (candidate.accuracy > opts.minAccuracy && !stallTime) {
      return { accept: false, reason: 'Baja precisión GPS', nextSegment: segment }
    }
  }

  const v = impliedSpeedMps(last as MapPointLike, candidate as MapPointLike)
  if (v != null && v > opts.maxSpeedMps) {
    return { accept: false, reason: 'Velocidad imposible entre muestras', nextSegment: segment }
  }

  const minD = adaptiveMinDistanceMeters(v, opts.minDistance)
  if (d < minD) {
    const longGap =
      last.timestamp && candidate.timestamp
        ? candidate.timestamp.getTime() - last.timestamp.getTime() >= opts.stallResampleAfterMs
        : false
    if (longGap && d > 0.15) {
      return { accept: true, nextSegment: nextSegmentFromAccepted(last, candidate) }
    }
    if (
      segment.lastSegmentSpeedMps != null &&
      v != null &&
      d > 0.2 &&
      Math.abs(v - segment.lastSegmentSpeedMps) >= opts.speedChangeAcceptMps
    ) {
      return { accept: true, nextSegment: nextSegmentFromAccepted(last, candidate) }
    }
    const bOut = initialBearingDegrees(
      last.latitude,
      last.longitude,
      candidate.latitude,
      candidate.longitude
    )
    if (
      segment.lastSegmentBearingDeg != null &&
      d > 0.35 &&
      smallestBearingDiffDegrees(segment.lastSegmentBearingDeg, bOut) >=
        opts.minBearingChangeForAcceptDeg
    ) {
      return { accept: true, nextSegment: nextSegmentFromAccepted(last, candidate) }
    }
    return { accept: false, reason: 'Muy cerca del punto anterior', nextSegment: segment }
  }

  return { accept: true, nextSegment: nextSegmentFromAccepted(last, candidate) }
}

function nextSegmentFromAccepted(
  last: GpsPointInput,
  accepted: GpsPointInput
): GpsSegmentState {
  const v = impliedSpeedMps(last as MapPointLike, accepted as MapPointLike)
  return {
    lastSegmentSpeedMps: v != null ? v : null,
    lastSegmentBearingDeg: initialBearingDegrees(
      last.latitude,
      last.longitude,
      accepted.latitude,
      accepted.longitude
    ),
  }
}
