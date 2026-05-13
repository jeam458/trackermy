'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { GPSTrackingService } from '@/services/GPSTrackingService'
import {
  haversineMeters,
  impliedSpeedMps,
  initialBearingDegrees,
  mergeSpeedReadingsMps,
  type MapPointLike,
} from '@/lib/gpsRecordingMath'
import {
  evaluateGpsRecordingSample,
  type GpsRecordingAcceptanceOptions,
} from '@/lib/gpsSampleAcceptance'
import {
  pathTotalMeters,
  pointAtArclength,
  type MapPathNode,
  cumulativeMeters,
  snapToPath,
} from '@/lib/pathMapMatch'
import { GpsKalman2DLive } from '@/lib/gpsKalmanLive'
import { DEFAULT_GPS_FILTER_CONFIG } from '@/core/domain/GPSTrack'
import {
  computeFinishApproachMs,
  type RouteAttemptGateTiming,
} from '@/lib/routeAttemptGateTiming'
import type { MapPoint, RecordingOptions, RecordingState, StopRecordingOptions, UseGPSRecorderReturn, RouteAttemptGatesConfig } from './types'
import { DEFAULT_OPTIONS } from './defaults'
import { calculateSpeed, mergeClosingFix } from './utils'
export { formatTime, formatDistance, formatSpeed } from './utils'
export type { MapPoint, RecordingOptions, RecordingState, StopRecordingOptions, UseGPSRecorderReturn, RouteAttemptGatesConfig } from './types'

/**
 * Hook para grabación de track GPS en tiempo real
 * Optimizado para downhill con filtrado de ruido
 */
export function useGPSRecorder(
  options: Partial<RecordingOptions> = {}
): UseGPSRecorderReturn {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [points, setPoints] = useState<MapPoint[]>([])
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [currentAccuracy, setCurrentAccuracy] = useState<number | null>(null)
  const [currentSpeed, setCurrentSpeed] = useState<number | null>(null)
  const [maxSessionSpeedMps, setMaxSessionSpeedMps] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [awaitingStartGate, setAwaitingStartGate] = useState(false)
  const [routeAttemptOffRoute, setRouteAttemptOffRoute] = useState(false)
  const [distanceMetersToStart, setDistanceMetersToStart] = useState<number | null>(null)
  const [distanceMetersToEnd, setDistanceMetersToEnd] = useState<number | null>(null)
  const [routeAttemptGateTiming, setRouteAttemptGateTiming] =
    useState<RouteAttemptGateTiming | null>(null)

  const watchIdRef = useRef<number | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const lastPointRef = useRef<MapPoint | null>(null)
  /** Última muestra GPS aceptada en crudo (cadena cinemática / aceptación) */
  const lastRawAcceptedRef = useRef<MapPoint | null>(null)
  const liveKalmanRef = useRef(
    new GpsKalman2DLive(
      DEFAULT_GPS_FILTER_CONFIG.kalmanQ,
      DEFAULT_GPS_FILTER_CONFIG.kalmanR
    )
  )
  /** Velocidad implícita (m/s) del último segmento aceptado; para aceptar por cambio de ritmo */
  const lastSegmentSpeedMpsRef = useRef<number | null>(null)
  /** Rumbo (°) del tramo que llega al último punto aceptado; para aceptar por curva */
  const lastSegmentBearingRef = useRef<number | null>(null)
  const pointsRef = useRef<MapPoint[]>([])
  const nativeGpsRef = useRef<GPSTrackingService | null>(null)
  const isRecordingRef = useRef(false)
  const isPausedRef = useRef(false)
  const stoppingRef = useRef(false)

  const mapMatchPathRef = useRef<MapPathNode[]>([])
  const mapMatchCumRef = useRef<number[]>([])
  /** Progreso monótono (m) en la polilínea de referencia */
  const arclengthAlongRefMRef = useRef(0)
  const pathSnapValidRef = useRef(false)
  const lastRealGpsAtMsRef = useRef<number>(0)
  const inGapFillingRef = useRef(false)
  const gapStartMsRef = useRef(0)
  const mapMatchTickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const routeGatesRef = useRef<RouteAttemptGatesConfig | null>(null)
  const awaitingStartGateRef = useRef(false)
  /** Reloj de pared al llamar `startRecording()` (intento con ruta). */
  const recordingArmedWallMsRef = useRef<number | null>(null)
  /**
   * Epoch ms del instante en que el cronómetro empezó (o se reanudó tras pausa).
   * `elapsed = floor((now - anchor) / 1000)` evita quedarse atrás cuando el OS congela `setInterval` con pantalla apagada o en segundo plano.
   */
  const elapsedAnchorEpochMsRef = useRef<number | null>(null)
  /** Último segundo mostrado (para pausa y sync). */
  const elapsedWallDisplayRef = useRef(0)
  const routeGateCumRef = useRef<number[]>([])
  const routeGatePathRef = useRef<MapPathNode[]>([])
  /** Distancia a la meta en el fix anterior (solo intento con ruta). */
  const prevDistanceToEndMRef = useRef<number | null>(null)
  /** Evita disparar dos veces el auto-stop al cruzar el radio de meta. */
  const finishAutoStopDoneRef = useRef(false)
  const stopRecordingRef = useRef<
    ((options?: StopRecordingOptions) => Promise<MapPoint[]>) | null
  >(null)

  useEffect(() => {
    routeGatesRef.current = opts.routeAttemptGates
    const g = opts.routeAttemptGates
    if (g && g.referencePath.length >= 2) {
      const norm: MapPathNode[] = g.referencePath.map((x) => ({
        latitude: x.latitude,
        longitude: x.longitude,
      }))
      routeGatePathRef.current = norm
      routeGateCumRef.current = cumulativeMeters(norm)
    } else {
      routeGatePathRef.current = []
      routeGateCumRef.current = []
    }
  }, [opts.routeAttemptGates])

  useEffect(() => {
    isRecordingRef.current = isRecording
  }, [isRecording])
  useEffect(() => {
    isPausedRef.current = isPaused
  }, [isPaused])
  useEffect(() => {
    pointsRef.current = points
  }, [points])

  useEffect(() => {
    const p = opts.mapMatchPath
    if (p && p.length >= 2) {
      const norm: MapPathNode[] = p.map((x) => ({
        latitude: x.latitude,
        longitude: x.longitude,
      }))
      mapMatchPathRef.current = norm
      mapMatchCumRef.current = cumulativeMeters(norm)
    } else {
      mapMatchPathRef.current = []
      mapMatchCumRef.current = []
    }
  }, [opts.mapMatchPath])

  const acceptanceOpts: GpsRecordingAcceptanceOptions = useMemo(
    () => ({
      minAccuracy: opts.minAccuracy,
      minDistance: opts.minDistance,
      maxSpeedMps: opts.maxSpeedMps,
      stallResampleAfterMs: opts.stallResampleAfterMs,
      speedChangeAcceptMps: opts.speedChangeAcceptMps,
      minBearingChangeForAcceptDeg: opts.minBearingChangeForAcceptDeg,
      motionEnvelopeEnabled: opts.motionEnvelopeEnabled,
      maxAccelMps2: opts.maxAccelMps2,
      motionEnvelopeGpsK: opts.motionEnvelopeGpsK,
      motionEnvelopeBaseM: opts.motionEnvelopeBaseM,
    }),
    [
      opts.minAccuracy,
      opts.minDistance,
      opts.maxSpeedMps,
      opts.stallResampleAfterMs,
      opts.speedChangeAcceptMps,
      opts.minBearingChangeForAcceptDeg,
      opts.motionEnvelopeEnabled,
      opts.maxAccelMps2,
      opts.motionEnvelopeGpsK,
      opts.motionEnvelopeBaseM,
    ]
  )

  const applyElapsedFromWallClock = useCallback(() => {
    if (isPausedRef.current) return
    const anchor = elapsedAnchorEpochMsRef.current
    if (anchor == null) return
    const next = Math.max(0, Math.floor((Date.now() - anchor) / 1000))
    elapsedWallDisplayRef.current = next
    setElapsedTime(next)
  }, [])

  const startElapseTimer = useCallback(() => {
    if (timerRef.current !== null) return
    applyElapsedFromWallClock()
    timerRef.current = setInterval(() => {
      applyElapsedFromWallClock()
    }, 1000)
  }, [applyElapsedFromWallClock])

  const fetchOneShotFix = useCallback((): Promise<MapPoint | null> => {
    if (nativeGpsRef.current) {
      return nativeGpsRef.current.getCurrentPosition().then((r) =>
        r
          ? {
              latitude: r.latitude,
              longitude: r.longitude,
              altitude: r.altitude ?? undefined,
              accuracy: r.accuracy ?? undefined,
              timestamp: r.timestamp,
            }
          : null
      )
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return Promise.resolve(null)
    }
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            altitude: pos.coords.altitude ?? undefined,
            accuracy: pos.coords.accuracy ?? undefined,
            timestamp: new Date(pos.timestamp),
          })
        },
        () => resolve(null),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
      )
    })
  }, [])

  const ingestPosition = useCallback(
    (
      latitude: number,
      longitude: number,
      altitude: number | null | undefined,
      accuracy: number | null | undefined,
      timestamp: Date,
      deviceSpeedMps: number | null | undefined = undefined
    ) => {
      if (!isRecordingRef.current || isPausedRef.current || stoppingRef.current) return

      const gates = routeGatesRef.current
      if (gates && awaitingStartGateRef.current) {
        const dS = haversineMeters(
          latitude,
          longitude,
          gates.startLat,
          gates.startLng
        )
        setDistanceMetersToStart(dS)
        setDistanceMetersToEnd(
          haversineMeters(latitude, longitude, gates.endLat, gates.endLng)
        )
        setCurrentAccuracy(accuracy ?? null)
        if (dS > gates.startEndRadiusM) {
          return
        }
        awaitingStartGateRef.current = false
        setAwaitingStartGate(false)
        const armed = recordingArmedWallMsRef.current
        if (armed != null) {
          const startOffsetWallMs = Date.now() - armed
          const startOffsetGpsMs = timestamp.getTime() - armed
          setRouteAttemptGateTiming({
            startOffsetWallMs,
            startOffsetGpsMs,
            finishApproachMs: null,
          })
        }
        const nowMs = Date.now()
        elapsedAnchorEpochMsRef.current = nowMs
        elapsedWallDisplayRef.current = 0
        setStartTime(new Date(nowMs))
        setElapsedTime(0)
        startElapseTimer()
      } else if (gates) {
        setDistanceMetersToEnd(
          haversineMeters(latitude, longitude, gates.endLat, gates.endLng)
        )
        setDistanceMetersToStart(
          haversineMeters(
            latitude,
            longitude,
            gates.startLat,
            gates.startLng
          )
        )
      }

      const point: MapPoint = {
        latitude,
        longitude,
        altitude: altitude ?? undefined,
        accuracy: accuracy ?? undefined,
        timestamp,
        ...(deviceSpeedMps != null &&
        Number.isFinite(deviceSpeedMps) &&
        deviceSpeedMps >= 0
          ? { speed: deviceSpeedMps }
          : {}),
      }

      setCurrentAccuracy(accuracy ?? null)

      const derivedMps =
        lastRawAcceptedRef.current && point.timestamp
          ? calculateSpeed(lastRawAcceptedRef.current, point)
          : null
      const displayMps = mergeSpeedReadingsMps(derivedMps, deviceSpeedMps ?? null)
      setCurrentSpeed(displayMps)
      if (displayMps != null) {
        setMaxSessionSpeedMps((prev) =>
          prev == null ? displayMps : Math.max(prev, displayMps)
        )
      }

      const { accept, reason, nextSegment } = evaluateGpsRecordingSample(
        lastRawAcceptedRef.current,
        point,
        {
          lastSegmentSpeedMps: lastSegmentSpeedMpsRef.current,
          lastSegmentBearingDeg: lastSegmentBearingRef.current,
        },
        acceptanceOpts
      )

      if (!accept) {
        console.log(`Punto rechazado: ${reason}`)
        return
      }

      if (
        lastRawAcceptedRef.current != null &&
        accuracy != null &&
        accuracy > opts.hardRejectAccuracyM
      ) {
        console.log(
          `Punto rechazado: precisión ${Math.round(accuracy)} m > ${opts.hardRejectAccuracyM} m con tramo previo`
        )
        return
      }

      const outPoint: MapPoint =
        opts.liveKalmanEnabled
          ? {
              ...point,
              ...liveKalmanRef.current.step(point.latitude, point.longitude),
            }
          : point

      lastRawAcceptedRef.current = { ...point }

      lastRealGpsAtMsRef.current = Date.now()
      inGapFillingRef.current = false

      const pathM = mapMatchPathRef.current
      const cumM = mapMatchCumRef.current
      if (pathM.length >= 2 && cumM.length === pathM.length) {
        const snap = snapToPath(point.latitude, point.longitude, pathM, cumM)
        if (snap && snap.distanceToPathM <= opts.mapMatchMaxSnapMeters) {
          pathSnapValidRef.current = true
          arclengthAlongRefMRef.current = Math.max(
            arclengthAlongRefMRef.current,
            snap.arclengthM
          )
        }
      }

      const gPath = routeGatePathRef.current
      const gCum = routeGateCumRef.current
      if (
        routeGatesRef.current &&
        gPath.length >= 2 &&
        gCum.length === gPath.length
      ) {
        const gSnap = snapToPath(point.latitude, point.longitude, gPath, gCum)
        if (
          gSnap &&
          gSnap.distanceToPathM > routeGatesRef.current.maxOffRouteM
        ) {
          setRouteAttemptOffRoute(true)
        }
      }

      lastSegmentSpeedMpsRef.current = nextSegment.lastSegmentSpeedMps
      lastSegmentBearingRef.current = nextSegment.lastSegmentBearingDeg

      setPoints((prev) => [...prev, outPoint])
      lastPointRef.current = outPoint

      const gActive = routeGatesRef.current
      if (!gActive) {
        prevDistanceToEndMRef.current = null
      } else if (
        !awaitingStartGateRef.current &&
        !finishAutoStopDoneRef.current &&
        !stoppingRef.current
      ) {
        const dEnd = haversineMeters(latitude, longitude, gActive.endLat, gActive.endLng)
        const prevD = prevDistanceToEndMRef.current
        prevDistanceToEndMRef.current = dEnd

        let pathProgress = 0
        const gP = routeGatePathRef.current
        const gCu = routeGateCumRef.current
        if (gP.length >= 2 && gCu.length === gP.length) {
          const sn = snapToPath(latitude, longitude, gP, gCu)
          if (sn) {
            const tot = pathTotalMeters(gCu)
            pathProgress = tot > 0 ? sn.arclengthM / tot : 0
          }
        }

        const enteredFinish =
          prevD != null &&
          prevD > gActive.startEndRadiusM &&
          dEnd <= gActive.startEndRadiusM
        if (enteredFinish && pathProgress >= 0.88) {
          finishAutoStopDoneRef.current = true
          queueMicrotask(() => {
            void stopRecordingRef.current?.()
          })
        }
      }
    },
    [
      calculateSpeed,
      acceptanceOpts,
      opts.mapMatchMaxSnapMeters,
      opts.hardRejectAccuracyM,
      opts.liveKalmanEnabled,
      startElapseTimer,
    ]
  )

  const addInferredPathPoint = useCallback(() => {
    if (!isRecordingRef.current || isPausedRef.current || stoppingRef.current) return
    if (awaitingStartGateRef.current) return
    const path = mapMatchPathRef.current
    const cum = mapMatchCumRef.current
    if (path.length < 2 || cum.length !== path.length) return
    if (!pathSnapValidRef.current) return
    const now = Date.now()
    if (now - lastRealGpsAtMsRef.current < opts.mapMatchGapTriggerMs) {
      inGapFillingRef.current = false
      return
    }
    if (inGapFillingRef.current) {
      if (now - gapStartMsRef.current > opts.mapMatchGapMaxDurationMs) return
    } else {
      inGapFillingRef.current = true
      gapStartMsRef.current = now
    }
    const totalM = pathTotalMeters(cum)
    if (arclengthAlongRefMRef.current >= totalM - 0.3) return
    const sm = lastSegmentSpeedMpsRef.current
    const sp =
      sm != null && sm > 0.4
        ? Math.min(
            opts.mapMatchInferredMaxSpeedMps,
            Math.max(opts.mapMatchInferredMinSpeedMps, sm)
          )
        : 4
    const newS = Math.min(totalM, arclengthAlongRefMRef.current + sp * 1.0)
    if (newS - arclengthAlongRefMRef.current < 0.15) return
    const pos = pointAtArclength(newS, path, cum)
    if (!pos) return
    arclengthAlongRefMRef.current = newS
    const last = lastPointRef.current
    const t = new Date()
    const p: MapPoint = {
      latitude: pos.latitude,
      longitude: pos.longitude,
      timestamp: t,
      accuracy: 45,
      inferredFromPath: true,
    }
    if (last) {
      const vSeg = impliedSpeedMps(last as MapPointLike, p as MapPointLike)
      if (vSeg != null) lastSegmentSpeedMpsRef.current = vSeg
      lastSegmentBearingRef.current = initialBearingDegrees(
        last.latitude,
        last.longitude,
        p.latitude,
        p.longitude
      )
    }
    setPoints((prev) => [...prev, p])
    lastPointRef.current = p
  }, [
    opts.mapMatchGapTriggerMs,
    opts.mapMatchGapMaxDurationMs,
    opts.mapMatchInferredMaxSpeedMps,
    opts.mapMatchInferredMinSpeedMps,
  ])

  useEffect(() => {
    if (!isRecording || isPaused || awaitingStartGate) {
      if (mapMatchTickRef.current) {
        clearInterval(mapMatchTickRef.current)
        mapMatchTickRef.current = null
      }
      return
    }
    if (mapMatchPathRef.current.length < 2) {
      if (mapMatchTickRef.current) {
        clearInterval(mapMatchTickRef.current)
        mapMatchTickRef.current = null
      }
      return
    }
    mapMatchTickRef.current = setInterval(() => {
      addInferredPathPoint()
    }, 1000)
    return () => {
      if (mapMatchTickRef.current) {
        clearInterval(mapMatchTickRef.current)
        mapMatchTickRef.current = null
      }
    }
  }, [isRecording, isPaused, awaitingStartGate, addInferredPathPoint])

  const handlePosition = useCallback(
    (position: GeolocationPosition) => {
      const s = position.coords.speed
      ingestPosition(
        position.coords.latitude,
        position.coords.longitude,
        position.coords.altitude ?? null,
        position.coords.accuracy ?? null,
        new Date(position.timestamp),
        s != null && !Number.isNaN(s) ? s : null
      )
    },
    [ingestPosition]
  )

  // Manejar error de GPS
  const handleError = useCallback((err: GeolocationPositionError) => {
    let errorMsg = 'Error de GPS'
    
    switch (err.code) {
      case err.PERMISSION_DENIED:
        errorMsg = 'Permiso de ubicación denegado'
        break
      case err.POSITION_UNAVAILABLE:
        errorMsg = 'Ubicación no disponible'
        break
      case err.TIMEOUT:
        errorMsg = 'Tiempo de espera agotado'
        break
    }

    setError(errorMsg)
    console.error('GPS Error:', errorMsg)
  }, [])

  const startRecording = useCallback(() => {
    if (!Capacitor.isNativePlatform() && !navigator.geolocation) {
      setError('Geolocalización no soportada por este dispositivo')
      return
    }

    setError(null)
    setIsRecording(true)
    setIsPaused(false)
    recordingArmedWallMsRef.current = Date.now()
    const gates = routeGatesRef.current
    if (gates) {
      awaitingStartGateRef.current = true
      setAwaitingStartGate(true)
      setRouteAttemptOffRoute(false)
      setDistanceMetersToStart(null)
      setDistanceMetersToEnd(null)
      setStartTime(null)
      elapsedAnchorEpochMsRef.current = null
      setRouteAttemptGateTiming(null)
    } else {
      const nowMs = Date.now()
      elapsedAnchorEpochMsRef.current = nowMs
      elapsedWallDisplayRef.current = 0
      setStartTime(new Date(nowMs))
      setRouteAttemptGateTiming(null)
    }
    setElapsedTime(0)
    setPoints([])
    pointsRef.current = []
    lastPointRef.current = null
    lastRawAcceptedRef.current = null
    liveKalmanRef.current.reset()
    lastSegmentSpeedMpsRef.current = null
    lastSegmentBearingRef.current = null
    arclengthAlongRefMRef.current = 0
    pathSnapValidRef.current = false
    lastRealGpsAtMsRef.current = Date.now()
    inGapFillingRef.current = false
    gapStartMsRef.current = 0
    stoppingRef.current = false
    setMaxSessionSpeedMps(null)
    prevDistanceToEndMRef.current = null
    finishAutoStopDoneRef.current = false

    if (Capacitor.isNativePlatform()) {
      if (!nativeGpsRef.current) nativeGpsRef.current = new GPSTrackingService()
      void (async () => {
        const ok = await nativeGpsRef.current!.startSession(
          (reading) => {
            ingestPosition(
              reading.latitude,
              reading.longitude,
              reading.altitude,
              reading.accuracy,
              reading.timestamp,
              reading.speed
            )
          },
          (msg) => setError(msg),
          true,
          1000,
          15000
        )
        if (!ok) {
          setIsRecording(false)
          setStartTime(null)
          setElapsedTime(0)
          setAwaitingStartGate(false)
          awaitingStartGateRef.current = false
          recordingArmedWallMsRef.current = null
          elapsedAnchorEpochMsRef.current = null
          return
        }
        if (!routeGatesRef.current) {
          startElapseTimer()
        }
      })()
    } else {
      watchIdRef.current = navigator.geolocation.watchPosition(
        handlePosition,
        handleError,
        {
          enableHighAccuracy: true,
          maximumAge: 1000,
          timeout: 10000,
        }
      )
      if (!gates) {
        startElapseTimer()
      }
    }
  }, [handlePosition, handleError, ingestPosition, startElapseTimer])

  const stopRecording = useCallback(
    (options?: StopRecordingOptions): Promise<MapPoint[]> => {
      const flushLastFix = options?.flushLastFix !== false
      const skipRouteAttemptValidation = options?.skipRouteAttemptValidation === true

      stoppingRef.current = true
      setIsPaused(false)

      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      nativeGpsRef.current?.stopSession()
      if (timerRef.current !== null) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      elapsedAnchorEpochMsRef.current = null

      const assertRouteAttemptStopValid = (pts: MapPoint[]) => {
        const g = routeGatesRef.current
        if (!g) return
        if (awaitingStartGateRef.current) {
          throw new Error(
            'No alcanzaste el punto de salida. Acércate a la partida (radio permitido) para que comience el cronómetro y el registro de puntos.'
          )
        }
        if (pts.length < 1) {
          throw new Error('No hay recorrido grabado.')
        }
        const last = pts[pts.length - 1]!
        const dEnd = haversineMeters(
          last.latitude,
          last.longitude,
          g.endLat,
          g.endLng
        )
        if (dEnd > g.startEndRadiusM) {
          throw new Error(
            `Debes detener en el punto de llegada (a menos de ${g.startEndRadiusM} m). Distancia a la meta: ${Math.round(
              dEnd
            )} m.`
          )
        }
      }

      if (!flushLastFix) {
        setIsRecording(false)
        stoppingRef.current = false
        if (skipRouteAttemptValidation) {
          setAwaitingStartGate(false)
          awaitingStartGateRef.current = false
        }
        const out = pointsRef.current
        if (!skipRouteAttemptValidation) {
          try {
            assertRouteAttemptStopValid(out)
            const g = routeGatesRef.current
            if (g) {
              const fa = computeFinishApproachMs(
                out,
                g.endLat,
                g.endLng,
                g.startEndRadiusM
              )
              setRouteAttemptGateTiming((prev) =>
                prev
                  ? { ...prev, finishApproachMs: fa }
                  : {
                      startOffsetWallMs: 0,
                      startOffsetGpsMs: 0,
                      finishApproachMs: fa,
                    }
              )
            }
          } catch (e) {
            setAwaitingStartGate(false)
            awaitingStartGateRef.current = false
            return Promise.reject(e)
          }
        }
        return Promise.resolve([...out])
      }

      return fetchOneShotFix().then((fix) => {
        const base = pointsRef.current
        const next = mergeClosingFix(base, fix)
        if (next.length > 0) {
          lastPointRef.current = next[next.length - 1]
        }
        setPoints(next)
        pointsRef.current = next
        setIsRecording(false)
        setIsPaused(false)
        stoppingRef.current = false
        setAwaitingStartGate(false)
        awaitingStartGateRef.current = false
        if (!skipRouteAttemptValidation) {
          try {
            assertRouteAttemptStopValid(next)
            const g = routeGatesRef.current
            if (g) {
              const fa = computeFinishApproachMs(
                next,
                g.endLat,
                g.endLng,
                g.startEndRadiusM
              )
              setRouteAttemptGateTiming((prev) =>
                prev
                  ? { ...prev, finishApproachMs: fa }
                  : {
                      startOffsetWallMs: 0,
                      startOffsetGpsMs: 0,
                      finishApproachMs: fa,
                    }
              )
            }
          } catch (e) {
            return Promise.reject(e)
          }
        }
        return next
      })
    },
    [fetchOneShotFix, mergeClosingFix]
  )

  useEffect(() => {
    stopRecordingRef.current = stopRecording
  }, [stopRecording])

  const pauseRecording = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    const anchor = elapsedAnchorEpochMsRef.current
    if (anchor != null) {
      const next = Math.max(0, Math.floor((Date.now() - anchor) / 1000))
      elapsedWallDisplayRef.current = next
      setElapsedTime(next)
      elapsedAnchorEpochMsRef.current = null
    }

    setIsPaused(true)

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    nativeGpsRef.current?.stopSession()
  }, [])

  const resumeRecording = useCallback(() => {
    setIsPaused(false)

    if (!awaitingStartGateRef.current) {
      const carry = elapsedWallDisplayRef.current
      elapsedAnchorEpochMsRef.current = Date.now() - carry * 1000
    } else {
      elapsedAnchorEpochMsRef.current = null
    }

    if (Capacitor.isNativePlatform()) {
      if (!nativeGpsRef.current) nativeGpsRef.current = new GPSTrackingService()
      void (async () => {
        const ok = await nativeGpsRef.current!.startSession(
          (reading) => {
            ingestPosition(
              reading.latitude,
              reading.longitude,
              reading.altitude,
              reading.accuracy,
              reading.timestamp,
              reading.speed
            )
          },
          (msg) => setError(msg),
          true,
          1000,
          15000
        )
        if (!ok) {
          setIsPaused(true)
          return
        }
        if (!awaitingStartGateRef.current) {
          startElapseTimer()
        }
      })()
    } else {
      watchIdRef.current = navigator.geolocation.watchPosition(
        handlePosition,
        handleError,
        {
          enableHighAccuracy: true,
          maximumAge: 1000,
          timeout: 10000,
        }
      )
      if (!awaitingStartGateRef.current) {
        startElapseTimer()
      }
    }
  }, [handlePosition, handleError, ingestPosition, startElapseTimer])

  // Limpiar grabación
  const clearRecording = useCallback(() => {
    setPoints([])
    pointsRef.current = []
    setElapsedTime(0)
    setStartTime(null)
    setAwaitingStartGate(false)
    awaitingStartGateRef.current = false
    setRouteAttemptOffRoute(false)
    setDistanceMetersToStart(null)
    setDistanceMetersToEnd(null)
    setRouteAttemptGateTiming(null)
    recordingArmedWallMsRef.current = null
    elapsedAnchorEpochMsRef.current = null
    elapsedWallDisplayRef.current = 0
    prevDistanceToEndMRef.current = null
    finishAutoStopDoneRef.current = false
    lastPointRef.current = null
    lastRawAcceptedRef.current = null
    liveKalmanRef.current.reset()
    lastSegmentSpeedMpsRef.current = null
    lastSegmentBearingRef.current = null
    arclengthAlongRefMRef.current = 0
    pathSnapValidRef.current = false
    lastRealGpsAtMsRef.current = 0
    inGapFillingRef.current = false
    gapStartMsRef.current = 0
    setMaxSessionSpeedMps(null)
  }, [])

  // Exportar puntos
  const exportPoints = useCallback(() => {
    return points
  }, [points])

  useEffect(() => {
    const syncOnForeground = () => {
      if (document.visibilityState !== 'visible') return
      if (!isRecordingRef.current || isPausedRef.current) return
      if (elapsedAnchorEpochMsRef.current == null) return
      applyElapsedFromWallClock()
      lastRealGpsAtMsRef.current = Date.now()
    }

    document.addEventListener('visibilitychange', syncOnForeground)
    let removeAppResume: (() => void) | undefined
    if (Capacitor.isNativePlatform()) {
      void App.addListener('resume', syncOnForeground).then((h) => {
        removeAppResume = () => {
          void h.remove()
        }
      })
    }

    return () => {
      document.removeEventListener('visibilitychange', syncOnForeground)
      removeAppResume?.()
    }
  }, [applyElapsedFromWallClock])

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
      nativeGpsRef.current?.stopSession()
      if (timerRef.current !== null) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  return {
    isRecording,
    isPaused,
    points,
    startTime,
    elapsedTime,
    currentAccuracy,
    currentSpeed,
    maxSessionSpeedMps,
    error,
    awaitingStartGate,
    routeAttemptOffRoute,
    distanceMetersToStart,
    distanceMetersToEnd,
    routeAttemptGateTiming,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearRecording,
    exportPoints,
  }
}


