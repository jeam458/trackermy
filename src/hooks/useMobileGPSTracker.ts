'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { MapPoint } from '@/components/routes/RouteMapEditor'
import { indexedDBService } from '@/services/IndexedDBService'
import { syncManager } from '@/services/SyncManager'
import { GPSTrackingService, GPSReading } from '@/services/GPSTrackingService'

export interface GPSTrackPoint extends MapPoint {
  timestamp: Date
  speed: number // m/s
  heading: number | null // degrees
}

export interface TrackingState {
  // Estados del flujo
  step: 'set-start' | 'set-end' | 'tracking' | 'paused' | 'completed'
  
  // Puntos GPS
  startPoint: GPSTrackPoint | null
  endPoint: GPSTrackPoint | null
  trackPoints: GPSTrackPoint[]
  
  // Estado de tracking
  isTracking: boolean
  isPaused: boolean
  accuracy: number | null
  currentSpeed: number // m/s
  averageSpeed: number // m/s
  maxSpeed: number // m/s
  
  // Métricas en tiempo real
  distanceTraveled: number // metros
  elapsedTime: number // segundos
  pointsCount: number
  
  // Control de velocidad para pausas automáticas
  isStopped: boolean // detectado por velocidad baja
  stopDuration: number // segundos detenido
  
  // Estado de conexión y sincronización
  isOnline: boolean
  isOfflineMode: boolean
  syncStatus: 'idle' | 'syncing' | 'success' | 'error' | 'waiting'
  pendingSync: boolean
  
  // Errores
  error: string | null
  gpsSignalLost: boolean
}

export interface TrackingConfig {
  // Velocidad mínima para considerar movimiento (m/s)
  minMovementSpeed?: number // default: 0.5 m/s (~1.8 km/h)
  
  // Tiempo mínimo de pausa para detener tracking (ms)
  minStopDuration?: number // default: 5000ms (5 segundos)
  
  // Intervalo de muestreo GPS (ms)
  samplingInterval?: number // default: 2000ms (2 segundos)
  
  // Precisión máxima aceptable (metros)
  maxAccuracyThreshold?: number // default: 30 metros
  
  // Distancia mínima entre puntos (metros) - para evitar duplicados
  minDistanceBetweenPoints?: number // default: 5 metros
  
  // Ventana de tiempo para promediar velocidad (ms)
  speedAveragingWindow?: number // default: 10000ms (10 segundos)
}

const DEFAULT_CONFIG: Required<TrackingConfig> = {
  minMovementSpeed: 0.5, // ~1.8 km/h (caminando lento)
  minStopDuration: 5000, // 5 segundos
  samplingInterval: 2000, // 2 segundos
  maxAccuracyThreshold: 30, // 30 metros
  minDistanceBetweenPoints: 5, // 5 metros
  speedAveragingWindow: 10000, // 10 segundos
}

// Calcular distancia Haversine entre dos puntos (en metros)
function calculateDistance(point1: MapPoint, point2: MapPoint): number {
  const R = 6371000 // Radio de la Tierra en metros
  const dLat = ((point2.latitude - point1.latitude) * Math.PI) / 180
  const dLng = ((point2.longitude - point1.longitude) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((point1.latitude * Math.PI) / 180) *
      Math.cos((point2.latitude * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function useMobileGPSTracker(config?: TrackingConfig) {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  
  const [state, setState] = useState<TrackingState>({
    step: 'set-start',
    startPoint: null,
    endPoint: null,
    trackPoints: [],
    isTracking: false,
    isPaused: false,
    accuracy: null,
    currentSpeed: 0,
    averageSpeed: 0,
    maxSpeed: 0,
    distanceTraveled: 0,
    elapsedTime: 0,
    pointsCount: 0,
    isStopped: false,
    stopDuration: 0,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isOfflineMode: false,
    syncStatus: 'idle',
    pendingSync: false,
    error: null,
    gpsSignalLost: false,
  })

  // Refs para tracking
  const watchIdRef = useRef<number | null>(null)
  const startTimeRef = useRef<Date | null>(null)
  const lastPointRef = useRef<GPSTrackPoint | null>(null)
  const lastValidPointRef = useRef<GPSTrackPoint | null>(null)
  const speedHistoryRef = useRef<number[]>([])
  const stopStartTimeRef = useRef<Date | null>(null)
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isTrackingRef = useRef(false)
  const gpsServiceRef = useRef<GPSTrackingService>(new GPSTrackingService())

  // Calcular velocidad entre dos puntos
  const calculateSpeed = useCallback((point1: GPSTrackPoint, point2: GPSTrackPoint): number => {
    const distance = calculateDistance(point1, point2)
    const timeDiff = (point2.timestamp.getTime() - point1.timestamp.getTime()) / 1000 // segundos
    if (timeDiff === 0) return 0
    return distance / timeDiff // m/s
  }, [])

  // Verificar si el punto tiene precisión aceptable
  const isAccurateEnough = useCallback((accuracy: number | undefined): boolean => {
    return accuracy !== undefined && accuracy <= cfg.maxAccuracyThreshold
  }, [cfg.maxAccuracyThreshold])

  // Verificar si hay suficiente distancia entre puntos
  const isFarEnough = useCallback((point1: MapPoint, point2: MapPoint): boolean => {
    const distance = calculateDistance(point1, point2)
    return distance >= cfg.minDistanceBetweenPoints
  }, [cfg.minDistanceBetweenPoints])

  // Actualizar métricas en tiempo real
  const updateMetrics = useCallback(() => {
    if (!startTimeRef.current) return

    const elapsed = (Date.now() - startTimeRef.current.getTime()) / 1000
    const distance = state.distanceTraveled
    
    // Calcular velocidad promedio
    const avgSpeed = elapsed > 0 ? distance / elapsed : 0
    
    setState(prev => ({
      ...prev,
      elapsedTime: elapsed,
      averageSpeed: avgSpeed,
    }))
  }, [state.distanceTraveled])

  // Iniciar timer de métricas
  const startMetricsTimer = useCallback(() => {
    if (timerIntervalRef.current) return
    
    timerIntervalRef.current = setInterval(() => {
      updateMetrics()
    }, 1000)
  }, [updateMetrics])

  // Detener timer de métricas
  const stopMetricsTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
  }, [])

  // Procesar nueva ubicación GPS
  const processLocationUpdate = useCallback((reading: GPSReading) => {
    const { latitude, longitude, altitude, accuracy, speed, heading, timestamp } = reading

    // Verificar precisión
    if (!isAccurateEnough(accuracy !== null ? accuracy : undefined)) {
      console.log(`Precisión insuficiente: ${accuracy}m > ${cfg.maxAccuracyThreshold}m`)
      return
    }

    const newPoint: GPSTrackPoint = {
      latitude,
      longitude,
      altitude: altitude ?? undefined,
      accuracy: accuracy ?? undefined,
      timestamp,
      speed: speed ?? 0,
      heading,
    }

    setState(prev => {
      // Si estamos en modo tracking
      if (prev.step === 'tracking' || prev.step === 'paused') {
        const lastPoint = lastValidPointRef.current
        
        // Si hay un punto anterior, calcular distancia y velocidad
        if (lastPoint) {
          const distance = calculateDistance(lastPoint, newPoint)
          const calculatedSpeed = calculateSpeed(lastPoint, newPoint)
          
          // Verificar si estamos detenidos (velocidad muy baja)
          if (calculatedSpeed < cfg.minMovementSpeed) {
            // Iniciar o actualizar timer de parada
            if (!prev.isStopped) {
              stopStartTimeRef.current = new Date()
              return {
                ...prev,
                isStopped: true,
                stopDuration: 0,
                currentSpeed: calculatedSpeed,
              }
            } else {
              // Ya estamos detenidos, actualizar duración
              const stopDuration = stopStartTimeRef.current
                ? (new Date().getTime() - stopStartTimeRef.current.getTime())
                : 0
              
              // Si la parada supera el mínimo, pausar tracking
              if (stopDuration >= cfg.minStopDuration && !prev.isPaused) {
                return {
                  ...prev,
                  isPaused: true,
                  step: 'paused' as const,
                  stopDuration,
                  currentSpeed: calculatedSpeed,
                }
              }
              
              return {
                ...prev,
                stopDuration,
                currentSpeed: calculatedSpeed,
              }
            }
          } else {
            // Estamos en movimiento
            let newState = {
              ...prev,
              isStopped: false,
              stopDuration: 0,
              currentSpeed: calculatedSpeed,
            }
            
            // Si estábamos pausados, reanudar
            if (prev.isPaused) {
              stopStartTimeRef.current = null
              newState = {
                ...newState,
                isPaused: false,
                step: 'tracking' as const,
              }
            }
            
            // Verificar si hay suficiente distancia para agregar punto
            if (isFarEnough(lastPoint, newPoint)) {
              // Actualizar historial de velocidad
              speedHistoryRef.current.push(calculatedSpeed)
              
              // Mantener solo últimas lecturas dentro de la ventana
              const windowStart = Date.now() - cfg.speedAveragingWindow
              speedHistoryRef.current = speedHistoryRef.current.filter((_, idx) => {
                // Simplificación: mantener últimas 10 lecturas
                return idx > speedHistoryRef.current.length - 10
              })
              
              // Calcular velocidad máxima
              const maxSpeed = Math.max(prev.maxSpeed, calculatedSpeed)
              
              // Agregar punto al track
              lastValidPointRef.current = newPoint
              
              return {
                ...newState,
                trackPoints: [...prev.trackPoints, newPoint],
                distanceTraveled: prev.distanceTraveled + distance,
                pointsCount: prev.pointsCount + 1,
                maxSpeed,
                accuracy: newPoint.accuracy ?? null,
              }
            }
            
            return {
              ...newState,
              accuracy: newPoint.accuracy ?? null,
            }
          }
        } else {
          // Primer punto del tracking
          lastValidPointRef.current = newPoint
          return {
            ...prev,
            trackPoints: [newPoint],
            pointsCount: 1,
            accuracy: newPoint.accuracy ?? null,
            currentSpeed: newPoint.speed ?? 0,
          }
        }
      }

      return prev
    })
  }, [isAccurateEnough, calculateSpeed, isFarEnough, cfg])

  // Iniciar watch de posición GPS
  const startGPSWatch = useCallback(() => {
    gpsServiceRef.current.startSession(
      processLocationUpdate,
      (errorMsg) => {
        console.error('Error de GPSTrackingService:', errorMsg)
        setState(prev => ({
          ...prev,
          error: errorMsg,
          gpsSignalLost: true,
        }))
      },
      true, // enableHighAccuracy
      0, // maximumAge
      15000 // timeout
    )
    isTrackingRef.current = true
  }, [processLocationUpdate])

  // Detener watch de posición GPS
  const stopGPSWatch = useCallback(() => {
    gpsServiceRef.current.stopSession()
    isTrackingRef.current = false
  }, [])

  // Establecer punto de partida
  const setStartPoint = useCallback(() => {
    if (!navigator.geolocation) {
      setState(prev => ({
        ...prev,
        error: 'Geolocalización no soportada',
      }))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, altitude, accuracy, speed, heading } = position.coords
        const point: GPSTrackPoint = {
          latitude,
          longitude,
          altitude: altitude ?? undefined,
          accuracy: accuracy ?? undefined,
          timestamp: new Date(position.timestamp),
          speed: speed ?? 0,
          heading,
        }

        setState(prev => ({
          ...prev,
          startPoint: point,
          step: 'set-end',
          error: null,
        }))
      },
      (error) => {
        let errorMsg = 'No se pudo obtener la ubicación: '
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMsg += 'Permite el acceso a ubicación'
            break
          case error.POSITION_UNAVAILABLE:
            errorMsg += 'Ubicación no disponible'
            break
          case error.TIMEOUT:
            errorMsg += 'Timeout. Intenta de nuevo'
            break
          default:
            errorMsg += 'Error desconocido'
        }
        setState(prev => ({
          ...prev,
          error: errorMsg,
        }))
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    )
  }, [])

  // Establecer punto de llegada
  const setEndPoint = useCallback(() => {
    if (!navigator.geolocation) {
      setState(prev => ({
        ...prev,
        error: 'Geolocalización no soportada',
      }))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, altitude, accuracy, speed, heading } = position.coords
        const point: GPSTrackPoint = {
          latitude,
          longitude,
          altitude: altitude ?? undefined,
          accuracy: accuracy ?? undefined,
          timestamp: new Date(position.timestamp),
          speed: speed ?? 0,
          heading,
        }

        setState(prev => ({
          ...prev,
          endPoint: point,
          step: 'tracking',
          error: null,
        }))

        // Iniciar tracking automáticamente
        startTimeRef.current = new Date()
        startGPSWatch()
        startMetricsTimer()
      },
      (error) => {
        let errorMsg = 'No se pudo obtener la ubicación: '
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMsg += 'Permite el acceso a ubicación'
            break
          case error.POSITION_UNAVAILABLE:
            errorMsg += 'Ubicación no disponible'
            break
          case error.TIMEOUT:
            errorMsg += 'Timeout. Intenta de nuevo'
            break
          default:
            errorMsg += 'Error desconocido'
        }
        setState(prev => ({
          ...prev,
          error: errorMsg,
        }))
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    )
  }, [startGPSWatch, startMetricsTimer])

  // Pausar tracking
  const pauseTracking = useCallback(() => {
    stopGPSWatch()
    stopMetricsTimer()
    setState(prev => ({
      ...prev,
      isPaused: true,
      step: 'paused',
    }))
  }, [stopGPSWatch, stopMetricsTimer])

  // Reanudar tracking
  const resumeTracking = useCallback(() => {
    setState(prev => ({
      ...prev,
      isPaused: false,
      step: 'tracking',
    }))
    startGPSWatch()
    startMetricsTimer()
  }, [startGPSWatch, startMetricsTimer])

  // Detener tracking y completar
  const completeTracking = useCallback(async () => {
    stopGPSWatch()
    stopMetricsTimer()

    // Guardar en IndexedDB para modo offline
    const isOnline = navigator.onLine
    
    setState(prev => ({
      ...prev,
      step: 'completed',
      isTracking: false,
      isPaused: false,
      isOnline,
      isOfflineMode: !isOnline,
      pendingSync: !isOnline,
    }))

    // Si está offline, guardar en IndexedDB
    if (!isOnline && state.startPoint && state.endPoint) {
      try {
        await indexedDBService.saveSession({
          id: `session-${Date.now()}`,
          userId: null, // Se obtendrá al sincronizar
          name: null,
          description: null,
          difficulty: null,
          isPublic: true,
          startPoint: JSON.stringify({
            latitude: state.startPoint.latitude,
            longitude: state.startPoint.longitude,
          }),
          endPoint: JSON.stringify({
            latitude: state.endPoint.latitude,
            longitude: state.endPoint.longitude,
          }),
          status: 'completed',
          syncAttempts: 0,
          lastSyncAttempt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: null,
        })

        // Guardar puntos
        const pointsToSave = state.trackPoints.map((point, index) => ({
          sessionId: `session-${Date.now()}`,
          latitude: point.latitude,
          longitude: point.longitude,
          altitude: point.altitude ?? null,
          accuracy: point.accuracy ?? null,
          speed: point.speed,
          heading: point.heading,
          timestamp: point.timestamp.toISOString(),
          orderIndex: index,
          synced: false,
        }))

        await indexedDBService.savePointsBatch(pointsToSave)

        console.log('✅ Ruta guardada localmente (modo offline)')
      } catch (error) {
        console.error('Error guardando offline:', error)
      }
    }
  }, [stopGPSWatch, stopMetricsTimer, state.startPoint, state.endPoint, state.trackPoints])

  // Cancelar y reiniciar todo
  const cancelTracking = useCallback(() => {
    stopGPSWatch()
    stopMetricsTimer()
    
    // Limpiar refs
    startTimeRef.current = null
    lastPointRef.current = null
    lastValidPointRef.current = null
    speedHistoryRef.current = []
    stopStartTimeRef.current = null
    
    setState({
      step: 'set-start',
      startPoint: null,
      endPoint: null,
      trackPoints: [],
      isTracking: false,
      isPaused: false,
      accuracy: null,
      currentSpeed: 0,
      averageSpeed: 0,
      maxSpeed: 0,
      distanceTraveled: 0,
      elapsedTime: 0,
      pointsCount: 0,
      isStopped: false,
      stopDuration: 0,
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      isOfflineMode: false,
      syncStatus: 'idle',
      pendingSync: false,
      error: null,
      gpsSignalLost: false,
    })
  }, [stopGPSWatch, stopMetricsTimer])

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      stopGPSWatch()
      stopMetricsTimer()
    }
  }, [stopGPSWatch, stopMetricsTimer])

  // Inicializar sync manager y escuchar cambios
  useEffect(() => {
    // Inicializar sync manager
    syncManager.init({
      onStateChange: (syncState) => {
        setState(prev => ({
          ...prev,
          isOnline: syncState.isOnline,
          syncStatus: syncState.syncStatus,
          pendingSync: syncState.pendingSessions > 0,
          isOfflineMode: !syncState.isOnline,
        }))
      },
      onSyncComplete: (syncedCount) => {
        console.log(`✅ ${syncedCount} sesiones sincronizadas`)
        setState(prev => ({
          ...prev,
          pendingSync: false,
        }))
      },
    })

    // Actualizar estado inicial de conexión
    const handleOnline = () => {
      setState(prev => ({
        ...prev,
        isOnline: true,
        isOfflineMode: false,
        error: null,
      }))
    }

    const handleOffline = () => {
      setState(prev => ({
        ...prev,
        isOnline: false,
        isOfflineMode: true,
        error: 'Sin conexión. Los datos se guardan localmente.',
      }))
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      syncManager.destroy()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return {
    state,
    actions: {
      setStartPoint,
      setEndPoint,
      pauseTracking,
      resumeTracking,
      completeTracking,
      cancelTracking,
    },
  }
}
