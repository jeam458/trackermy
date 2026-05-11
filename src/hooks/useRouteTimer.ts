'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { RoutePerformanceService, GPSPoint, PerformanceMetrics } from '@/services/RoutePerformanceService'
import { indexedDBService } from '@/services/IndexedDBService'
import { syncManager } from '@/services/SyncManager'

export interface RouteTimerState {
  // Estado del timer
  isRunning: boolean
  isPaused: boolean
  isFinished: boolean
  
  // Tiempo
  startTime: Date | null
  elapsedTime: number // segundos
  pausedTime: number // segundos acumulado en pausas
  
  // Métricas en tiempo real
  currentSpeed: number // m/s
  maxSpeed: number // m/s
  avgSpeed: number // m/s
  distance: number // metros
  altitude: number | null
  
  // Puntos GPS
  gpsPoints: GPSPoint[]
  
  // Conexión
  isOnline: boolean
  
  // Errores
  error: string | null

  /** El intento ya está en IndexedDB (sin red al finalizar); no hace falta volver a insertar al pulsar Guardar. */
  offlineAttemptQueued: boolean
}

export interface RouteAttemptData {
  routeId: string
  userId: string
  performance: PerformanceMetrics
  gpsPoints: GPSPoint[]
  startedAt: Date
  finishedAt: Date
  isPublic: boolean
}

export function useRouteTimer(routeId: string, userId?: string) {
  const [state, setState] = useState<RouteTimerState>({
    isRunning: false,
    isPaused: false,
    isFinished: false,
    startTime: null,
    elapsedTime: 0,
    pausedTime: 0,
    currentSpeed: 0,
    maxSpeed: 0,
    avgSpeed: 0,
    distance: 0,
    altitude: null,
    gpsPoints: [],
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    error: null,
    offlineAttemptQueued: false,
  })

  const watchIdRef = useRef<number | null>(null)
  const startTimeRef = useRef<Date | null>(null)
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastPointRef = useRef<GPSPoint | null>(null)
  const performanceService = useRef(new RoutePerformanceService())

  // Calcular métricas en tiempo real
  const updateMetrics = useCallback(() => {
    if (state.gpsPoints.length < 2) return

    const points = state.gpsPoints
    let distance = 0
    const segSpeeds: number[] = []
    const R = 6371000
    for (let i = 1; i < points.length; i++) {
      const dLat = ((points[i].latitude - points[i - 1].latitude) * Math.PI) / 180
      const dLng = ((points[i].longitude - points[i - 1].longitude) * Math.PI) / 180
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((points[i - 1].latitude * Math.PI) / 180) *
          Math.cos((points[i].latitude * Math.PI) / 180) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      const m = R * c
      distance += m
      const dt =
        (points[i].timestamp.getTime() - points[i - 1].timestamp.getTime()) / 1000
      if (dt > 0) {
        segSpeeds.push(m / dt)
      }
    }

    const currentSpeed = points[points.length - 1].speed ?? 0
    const fromDevice = points.map((p) => p.speed).filter((s): s is number => s != null && s > 0)
    const maxFromSeg = segSpeeds.length > 0 ? Math.max(...segSpeeds) : 0
    const maxSpeed = fromDevice.length > 0 ? Math.max(maxFromSeg, ...fromDevice) : maxFromSeg
    const altitude = points[points.length - 1].altitude ?? null

    const elapsed = startTimeRef.current
      ? (Date.now() - startTimeRef.current.getTime()) / 1000
      : 0
    // Misma noción que al guardar: distancia / tiempo de sesión, no suma de lecturas
    const avgSpeed = elapsed > 0 ? distance / elapsed : 0

    setState(prev => ({
      ...prev,
      elapsedTime: elapsed,
      currentSpeed,
      maxSpeed,
      avgSpeed,
      distance,
      altitude,
    }))
  }, [state.gpsPoints])

  // Iniciar timer
  const startTimer = useCallback(() => {
    if (!navigator.geolocation) {
      setState(prev => ({
        ...prev,
        error: 'Geolocalización no disponible',
      }))
      return
    }

    startTimeRef.current = new Date()
    
    setState((prev) => ({
      ...prev,
      isRunning: true,
      isPaused: false,
      isFinished: false,
      startTime: new Date(),
      elapsedTime: 0,
      pausedTime: 0,
      gpsPoints: [],
      error: null,
      offlineAttemptQueued: false,
    }))

    // Iniciar GPS watch
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const point: GPSPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          altitude: position.coords.altitude,
          speed: position.coords.speed,
          timestamp: new Date(position.timestamp),
          accuracy: position.coords.accuracy,
        }

        setState(prev => ({
          ...prev,
          gpsPoints: [...prev.gpsPoints, point],
        }))

        lastPointRef.current = point
      },
      (error) => {
        console.error('Error GPS:', error)
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      }
    )

    // Iniciar timer de métricas
    timerIntervalRef.current = setInterval(() => {
      updateMetrics()
    }, 1000)
  }, [updateMetrics])

  // Pausar timer
  const pauseTimer = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }

    setState(prev => ({
      ...prev,
      isPaused: true,
    }))
  }, [])

  // Reanudar timer
  const resumeTimer = useCallback(() => {
    setState(prev => ({
      ...prev,
      isPaused: false,
    }))

    // Reiniciar GPS watch
    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const point: GPSPoint = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            altitude: position.coords.altitude,
            speed: position.coords.speed,
            timestamp: new Date(position.timestamp),
            accuracy: position.coords.accuracy,
          }

          setState(prev => ({
            ...prev,
            gpsPoints: [...prev.gpsPoints, point],
          }))
        },
        (error) => {
          console.error('Error GPS:', error)
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 10000,
        }
      )
    }
  }, [])

  // Finalizar timer y analizar
  const finishTimer = useCallback(async (): Promise<PerformanceMetrics | null> => {
    // Detener GPS
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }

    // Detener timer
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }

    if (state.gpsPoints.length < 2) {
      setState(prev => ({
        ...prev,
        error: 'Se requieren al menos 2 puntos GPS',
        isFinished: true,
        isRunning: false,
      }))
      return null
    }

    try {
      // Analizar rendimiento
      const performance = performanceService.current.analyzePerformance(state.gpsPoints)

      // Sin red: persistir intento + puntos GPS en IndexedDB; SyncManager lo sube al volver online
      const isOnline = navigator.onLine
      let offlineQueued = false
      if (!isOnline && userId && indexedDBService.isAvailable()) {
        const sessionId = `attempt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
        const first = state.gpsPoints[0]!
        const last = state.gpsPoints[state.gpsPoints.length - 1]!
        await indexedDBService.saveSession({
          id: sessionId,
          userId,
          name: `Intento ${new Date().toLocaleDateString()}`,
          description: null,
          difficulty: null,
          isPublic: true,
          startPoint: JSON.stringify({
            latitude: first.latitude,
            longitude: first.longitude,
          }),
          endPoint: JSON.stringify({
            latitude: last.latitude,
            longitude: last.longitude,
          }),
          status: 'completed',
          syncAttempts: 0,
          lastSyncAttempt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: JSON.stringify({
            type: 'route-attempt',
            routeId,
            performance,
          }),
        })
        await indexedDBService.savePointsBatch(
          state.gpsPoints.map((p, index) => ({
            sessionId,
            latitude: p.latitude,
            longitude: p.longitude,
            altitude: p.altitude ?? null,
            accuracy: p.accuracy ?? null,
            speed: p.speed ?? 0,
            heading: null,
            timestamp: p.timestamp.toISOString(),
            orderIndex: index,
            synced: false,
          }))
        )
        syncManager.init()
        offlineQueued = true
      }

      setState((prev) => ({
        ...prev,
        isFinished: true,
        isRunning: false,
        isPaused: false,
        offlineAttemptQueued: offlineQueued,
      }))

      return performance
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error analizando rendimiento'
      setState((prev) => ({
        ...prev,
        error: errorMessage,
        isFinished: true,
        isRunning: false,
        offlineAttemptQueued: false,
      }))
      return null
    }
  }, [state.gpsPoints, userId, routeId])

  // Cancelar timer
  const cancelTimer = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }

    startTimeRef.current = null
    lastPointRef.current = null

    setState({
      isRunning: false,
      isPaused: false,
      isFinished: false,
      startTime: null,
      elapsedTime: 0,
      pausedTime: 0,
      currentSpeed: 0,
      maxSpeed: 0,
      avgSpeed: 0,
      distance: 0,
      altitude: null,
      gpsPoints: [],
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      error: null,
      offlineAttemptQueued: false,
    })
  }, [])

  // Escuchar cambios de conexión
  useEffect(() => {
    const handleOnline = () => setState(prev => ({ ...prev, isOnline: true, error: null }))
    const handleOffline = () => setState(prev => ({ ...prev, isOnline: false }))

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
      }
    }
  }, [])

  return {
    state,
    actions: {
      startTimer,
      pauseTimer,
      resumeTimer,
      finishTimer,
      cancelTimer,
    },
  }
}
