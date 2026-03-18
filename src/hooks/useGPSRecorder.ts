'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export interface MapPoint {
  latitude: number
  longitude: number
  altitude?: number
  accuracy?: number
  timestamp?: Date
}

export interface RecordingOptions {
  // Intervalo de grabación en milisegundos
  recordingInterval: number
  // Precisión mínima requerida (metros)
  minAccuracy: number
  // Distancia mínima entre puntos (metros)
  minDistance: number
  // Habilitar/deshabilitar grabación
  enabled: boolean
}

export interface RecordingState {
  isRecording: boolean
  isPaused: boolean
  points: MapPoint[]
  startTime: Date | null
  elapsedTime: number // segundos
  currentAccuracy: number | null
  currentSpeed: number | null // m/s
  error: string | null
}

export interface UseGPSRecorderReturn extends RecordingState {
  startRecording: () => void
  stopRecording: () => void
  pauseRecording: () => void
  resumeRecording: () => void
  clearRecording: () => void
  exportPoints: () => MapPoint[]
}

const DEFAULT_OPTIONS: RecordingOptions = {
  recordingInterval: 1000, // 1 segundo
  minAccuracy: 15, // 15 metros
  minDistance: 3, // 3 metros
  enabled: true,
}

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
  const [error, setError] = useState<string | null>(null)

  const watchIdRef = useRef<number | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const lastPointRef = useRef<MapPoint | null>(null)

  // Calcular distancia entre dos puntos (Haversine)
  const calculateDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000 // metros
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLng = ((lng2 - lng1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }, [])

  // Calcular velocidad entre dos puntos
  const calculateSpeed = useCallback((point1: MapPoint, point2: MapPoint): number | null => {
    if (!point1.timestamp || !point2.timestamp) return null
    
    const distance = calculateDistance(
      point1.latitude,
      point1.longitude,
      point2.latitude,
      point2.longitude
    )
    
    const timeDiff = point2.timestamp.getTime() - point1.timestamp.getTime()
    if (timeDiff <= 0) return null
    
    return distance / (timeDiff / 1000) // m/s
  }, [calculateDistance])

  // Filtrar punto por calidad
  const shouldAcceptPoint = useCallback((point: MapPoint): { accept: boolean; reason?: string } => {
    // Verificar precisión
    if (point.accuracy !== undefined && point.accuracy > opts.minAccuracy) {
      return { accept: false, reason: 'Baja precisión GPS' }
    }

    // Verificar distancia mínima desde último punto
    if (lastPointRef.current) {
      const distance = calculateDistance(
        lastPointRef.current.latitude,
        lastPointRef.current.longitude,
        point.latitude,
        point.longitude
      )

      if (distance < opts.minDistance) {
        return { accept: false, reason: 'Muy cerca del punto anterior' }
      }

      // Verificar velocidad máxima razonable (80 km/h = 22.2 m/s)
      const speed = calculateSpeed(lastPointRef.current, point)
      if (speed !== null && speed > 22.2) {
        return { accept: false, reason: 'Velocidad imposible' }
      }
    }

    return { accept: true }
  }, [opts.minAccuracy, opts.minDistance, calculateDistance, calculateSpeed])

  // Manejar nueva posición GPS
  const handlePosition = useCallback((position: GeolocationPosition) => {
    if (!isRecording || isPaused) return

    const point: MapPoint = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      altitude: position.coords.altitude ?? undefined,
      accuracy: position.coords.accuracy ?? undefined,
      timestamp: new Date(position.timestamp),
    }

    // Actualizar estado actual
    setCurrentAccuracy(position.coords.accuracy ?? null)
    
    // Calcular velocidad actual
    if (lastPointRef.current && point.timestamp) {
      const speed = calculateSpeed(lastPointRef.current, point)
      setCurrentSpeed(speed)
    }

    // Verificar si aceptamos el punto
    const { accept, reason } = shouldAcceptPoint(point)
    
    if (!accept) {
      console.log(`Punto rechazado: ${reason}`)
      return
    }

    // Agregar punto
    setPoints((prev) => [...prev, point])
    lastPointRef.current = point
  }, [isRecording, isPaused, calculateSpeed, shouldAcceptPoint])

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

  // Iniciar grabación
  const startRecording = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocalización no soportada por este dispositivo')
      return
    }

    setError(null)
    setIsRecording(true)
    setIsPaused(false)
    setStartTime(new Date())
    setElapsedTime(0)
    setPoints([])
    lastPointRef.current = null

    // Iniciar watch de posición
    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000,
      }
    )

    // Iniciar timer de.elapsed time
    timerRef.current = setInterval(() => {
      setElapsedTime((prev) => prev + 1)
    }, 1000)
  }, [handlePosition, handleError])

  // Detener grabación
  const stopRecording = useCallback(() => {
    setIsRecording(false)
    setIsPaused(false)

    // Limpiar watch
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }

    // Limpiar timer
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Pausar grabación
  const pauseRecording = useCallback(() => {
    setIsPaused(true)

    // Limpiar watch temporalmente
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [])

  // Reanudar grabación
  const resumeRecording = useCallback(() => {
    setIsPaused(false)

    // Reiniciar watch
    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000,
      }
    )
  }, [handlePosition, handleError])

  // Limpiar grabación
  const clearRecording = useCallback(() => {
    setPoints([])
    setElapsedTime(0)
    setStartTime(null)
    lastPointRef.current = null
  }, [])

  // Exportar puntos
  const exportPoints = useCallback(() => {
    return points
  }, [points])

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
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
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearRecording,
    exportPoints,
  }
}

/**
 * Formatear tiempo en segundos a formato MM:SS
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

/**
 * Formatear distancia en metros a string legible
 */
export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`
  }
  return `${meters.toFixed(0)} m`
}

/**
 * Formatear velocidad en m/s a km/h
 */
export function formatSpeed(ms: number): string {
  return `${(ms * 3.6).toFixed(1)} km/h`
}
