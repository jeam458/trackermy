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
    const speeds = points.map(p => p.speed ?? 0).filter(s => s > 0)
    
    let distance = 0
    for (let i = 1; i < points.length; i++) {
      const R = 6371000
      const dLat = ((points[i].latitude - points[i-1].latitude) * Math.PI) / 180
      const dLng = ((points[i].longitude - points[i-1].longitude) * Math.PI) / 180
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos((points[i-1].latitude * Math.PI) / 180) *
        Math.cos((points[i].latitude * Math.PI) / 180) *
        Math.sin(dLng/2) * Math.sin(dLng/2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
      distance += R * c
    }

    const currentSpeed = points[points.length - 1].speed ?? 0
    const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : 0
    const avgSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0
    const altitude = points[points.length - 1].altitude ?? null

    const elapsed = startTimeRef.current
      ? (Date.now() - startTimeRef.current.getTime()) / 1000
      : 0

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
    
    setState(prev => ({
      ...prev,
      isRunning: true,
      isPaused: false,
      isFinished: false,
      startTime: new Date(),
      elapsedTime: 0,
      pausedTime: 0,
      gpsPoints: [],
      error: null,
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

      setState(prev => ({
        ...prev,
        isFinished: true,
        isRunning: false,
        isPaused: false,
      }))

      // Guardar en IndexedDB si está offline
      const isOnline = navigator.onLine
      if (!isOnline && userId) {
        await indexedDBService.saveSession({
          id: `attempt-${Date.now()}`,
          userId,
          name: `Intento ${new Date().toLocaleDateString()}`,
          description: null,
          difficulty: null,
          isPublic: true,
          startPoint: JSON.stringify({
            latitude: state.gpsPoints[0].latitude,
            longitude: state.gpsPoints[0].longitude,
          }),
          endPoint: JSON.stringify({
            latitude: state.gpsPoints[state.gpsPoints.length - 1].latitude,
            longitude: state.gpsPoints[state.gpsPoints.length - 1].longitude,
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
      }

      return performance
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error analizando rendimiento'
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isFinished: true,
        isRunning: false,
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
