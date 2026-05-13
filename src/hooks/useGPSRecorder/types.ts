import type { RouteAttemptGateTiming } from '@/lib/routeAttemptGateTiming'
import type { MapPathNode } from '@/lib/pathMapMatch'

export interface MapPoint {
  latitude: number
  longitude: number
  altitude?: number
  accuracy?: number
  timestamp?: Date
  speed?: number
  inferredFromPath?: boolean
}

export type RouteAttemptGatesConfig = {
  startLat: number
  startLng: number
  endLat: number
  endLng: number
  startEndRadiusM: number
  maxOffRouteM: number
  referencePath: MapPathNode[]
}

export interface RecordingOptions {
  recordingInterval: number
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
  mapMatchPath?: MapPathNode[] | null
  mapMatchGapTriggerMs: number
  mapMatchGapMaxDurationMs: number
  mapMatchInferredMinSpeedMps: number
  mapMatchInferredMaxSpeedMps: number
  mapMatchMaxSnapMeters: number
  enabled: boolean
  routeAttemptGates: RouteAttemptGatesConfig | null
  liveKalmanEnabled: boolean
  hardRejectAccuracyM: number
}

export interface RecordingState {
  isRecording: boolean
  isPaused: boolean
  points: MapPoint[]
  startTime: Date | null
  elapsedTime: number
  currentAccuracy: number | null
  currentSpeed: number | null
  maxSessionSpeedMps: number | null
  error: string | null
  awaitingStartGate: boolean
  routeAttemptOffRoute: boolean
  distanceMetersToStart: number | null
  distanceMetersToEnd: number | null
  routeAttemptGateTiming: RouteAttemptGateTiming | null
}

export interface StopRecordingOptions {
  flushLastFix?: boolean
  skipRouteAttemptValidation?: boolean
}

export interface UseGPSRecorderReturn extends RecordingState {
  startRecording: () => void
  stopRecording: (options?: StopRecordingOptions) => Promise<MapPoint[]>
  pauseRecording: () => void
  resumeRecording: () => void
  clearRecording: () => void
  exportPoints: () => MapPoint[]
}
