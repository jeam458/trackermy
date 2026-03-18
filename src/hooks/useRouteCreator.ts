'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { GPSTrackProcessingService } from '@/core/application/CreateRouteUseCase'
import { SupabaseRouteRepository } from '@/core/infrastructure/repositories/SupabaseRouteRepository'
import { RouteCreationRequest } from '@/core/domain/Route'
import { GPSPoint, ProcessedTrack, TrackQuality } from '@/core/domain/GPSTrack'
import { createClient } from '@/core/infrastructure/supabase/client'
import { User } from '@/core/domain/User'
import { MapPoint } from '@/components/routes/RouteMapEditor'

export interface RouteCreationState {
  // Puntos seleccionados
  startPoint: MapPoint | null
  endPoint: MapPoint | null
  trackPoints: MapPoint[]

  // Estados de la UI
  isDrawing: boolean
  isProcessing: boolean
  isSaving: boolean
  pointSelectionMode: 'start' | 'end' | 'intermediate' | null // Nuevo: tipo de punto a agregar

  // Información de la ruta
  name: string
  description: string
  difficulty: 'Beginner' | 'Intermediate' | 'Expert'
  isPublic: boolean

  // Resultados del procesamiento
  processedTrack: ProcessedTrack | null
  quality: TrackQuality | null

  // Errores
  errors: string[]
  validationErrors: string[]
}

export interface UseRouteCreatorReturn extends RouteCreationState {
  // Acciones de dibujo
  startDrawing: () => void
  stopDrawing: () => void
  cancelDrawing: () => void
  
  // Acciones de puntos
  setStartPoint: (point: MapPoint) => void
  setEndPoint: (point: MapPoint) => void
  addTrackPoint: (point: MapPoint) => void
  removeTrackPoint: (index: number) => void
  undoLastPoint: () => void
  clearAllPoints: () => void

  // Acciones de formulario
  setName: (name: string) => void
  setDescription: (description: string) => void
  setDifficulty: (difficulty: 'Beginner' | 'Intermediate' | 'Expert') => void
  setIsPublic: (isPublic: boolean) => void

  // Procesamiento y guardado
  processTrack: () => { success: boolean; errors: string[] }
  saveRoute: () => Promise<{ success: boolean; routeId?: string; errors: string[] }>
  
  // Utilidades
  canSave: boolean
  canProcess: boolean
  getEstimatedDistance: () => number
  pointSelectionMode: 'start' | 'end' | 'intermediate' | null
  startPointSelection: (type: 'start' | 'end' | 'intermediate') => void
  cancelPointSelection: () => void
  setPointSelectionMode: React.Dispatch<React.SetStateAction<'start' | 'end' | 'intermediate' | null>>
  useCurrentLocation: () => void
}

const PROCESSING_SERVICE = new GPSTrackProcessingService()
const ROUTE_REPOSITORY = new SupabaseRouteRepository()

export function useRouteCreator(currentUser: User): UseRouteCreatorReturn {
  // Estados de puntos
  const [startPoint, setStartPoint] = useState<MapPoint | null>(null)
  const [endPoint, setEndPoint] = useState<MapPoint | null>(null)
  const [trackPoints, setTrackPoints] = useState<MapPoint[]>([])

  // Estados de la UI
  const [isDrawing, setIsDrawing] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [pointSelectionMode, setPointSelectionMode] = useState<'start' | 'end' | 'intermediate' | null>(null)

  // Información de la ruta
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [difficulty, setDifficulty] = useState<'Beginner' | 'Intermediate' | 'Expert'>('Intermediate')
  const [isPublic, setIsPublic] = useState(true)

  // Resultados del procesamiento
  const [processedTrack, setProcessedTrack] = useState<ProcessedTrack | null>(null)
  const [quality, setQuality] = useState<TrackQuality | null>(null)

  // Errores
  const [errors, setErrors] = useState<string[]>([])
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  // Iniciar dibujo
  const startDrawing = useCallback(() => {
    setIsDrawing(true)
    setPointSelectionMode('start') // Iniciar automáticamente en modo 'start'
    setErrors([])
    setValidationErrors([])
  }, [])

  // Detener dibujo
  const stopDrawing = useCallback(() => {
    setIsDrawing(false)
    setPointSelectionMode(null)
  }, [])

  // Cancelar dibujo
  const cancelDrawing = useCallback(() => {
    setIsDrawing(false)
    setPointSelectionMode(null)
    setStartPoint(null)
    setEndPoint(null)
    setTrackPoints([])
    setProcessedTrack(null)
    setQuality(null)
    setErrors([])
    setValidationErrors([])
  }, [])

  // Iniciar selección de punto (nuevo)
  const startPointSelection = useCallback((type: 'start' | 'end' | 'intermediate') => {
    setPointSelectionMode(type)
  }, [])

  // Cancelar selección de punto (nuevo)
  const cancelPointSelection = useCallback(() => {
    setPointSelectionMode(null)
  }, [])

  // Escuchar cambios en startPoint para automáticamente pedir el endPoint
  useEffect(() => {
    if (startPoint && !endPoint) {
      // Después de poner el inicio, automáticamente pedir el fin
      setPointSelectionMode('end')
    } else if (startPoint && endPoint) {
      // Después de poner el fin, limpiar selección para mostrar panel
      setPointSelectionMode(null)
    }
  }, [startPoint, endPoint])

  // Usar ubicación actual (nuevo)
  const useCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setErrors(['Geolocalización no soportada por este dispositivo'])
      return
    }

    // Mostrar mensaje de que está buscando ubicación
    console.log('Solicitando ubicación...')

    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('Ubicación obtenida:', position.coords)
        const point: MapPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          altitude: position.coords.altitude ?? undefined,
          accuracy: position.coords.accuracy ?? undefined,
        }

        // Si no hay punto de fin, usar como fin
        if (!endPoint) {
          setEndPoint(point)
        } else {
          // Si ya hay fin, agregar como intermedio
          addTrackPoint(point)
        }
        setPointSelectionMode(null)
      },
      (error) => {
        console.error('Error de geolocalización:', error)
        let errorMsg = 'No se pudo obtener tu ubicación. '
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMsg += 'Por favor permite el acceso a tu ubicación en el navegador.'
            break
          case error.POSITION_UNAVAILABLE:
            errorMsg += 'La información de ubicación no está disponible.'
            break
          case error.TIMEOUT:
            errorMsg += 'Se agotó el tiempo de espera para obtener la ubicación.'
            break
          default:
            errorMsg += 'Error desconocido.'
        }
        
        setErrors([errorMsg])
      },
      {
        enableHighAccuracy: true,
        timeout: 15000, // 15 segundos timeout
        maximumAge: 10000, // Aceptar ubicación de hasta 10 segundos atrás
      }
    )
  }, [endPoint]) // eslint-disable-line react-hooks/exhaustive-deps

  // Agregar punto intermedio
  const addTrackPoint = useCallback((point: MapPoint) => {
    setTrackPoints((prev) => [...prev, point])
  }, [])

  // Eliminar punto
  const removeTrackPoint = useCallback((index: number) => {
    setTrackPoints((prev) => prev.filter((_, i) => i !== index))
  }, [])

  // Deshacer último punto
  const undoLastPoint = useCallback(() => {
    if (trackPoints.length > 0) {
      setTrackPoints((prev) => prev.slice(0, -1))
    } else if (endPoint) {
      setEndPoint(null)
    } else if (startPoint) {
      setStartPoint(null)
    }
  }, [trackPoints, endPoint, startPoint])

  // Limpiar todos los puntos
  const clearAllPoints = useCallback(() => {
    setStartPoint(null)
    setEndPoint(null)
    setTrackPoints([])
    setProcessedTrack(null)
    setQuality(null)
  }, [])

  // Convertir MapPoint a GPSPoint
  const toGPSPoint = useCallback((point: MapPoint): GPSPoint => {
    return {
      latitude: point.latitude,
      longitude: point.longitude,
      altitude: point.altitude,
      accuracy: point.accuracy,
      timestamp: new Date(),
    }
  }, [])

  // Calcular distancia estimada
  const getEstimatedDistance = useCallback(() => {
    const allPoints = [startPoint, ...trackPoints, endPoint].filter(
      (p): p is MapPoint => p !== null
    )

    if (allPoints.length < 2) return 0

    let distance = 0
    for (let i = 1; i < allPoints.length; i++) {
      const prev = allPoints[i - 1]
      const curr = allPoints[i]

      // Haversine distance
      const R = 6371000
      const dLat = ((curr.latitude - prev.latitude) * Math.PI) / 180
      const dLng = ((curr.longitude - prev.longitude) * Math.PI) / 180
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((prev.latitude * Math.PI) / 180) *
          Math.cos((curr.latitude * Math.PI) / 180) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      distance += R * c
    }

    return distance / 1000 // km
  }, [startPoint, trackPoints, endPoint])

  // Procesar track
  const processTrack = useCallback(() => {
    const allPoints = [startPoint, ...trackPoints, endPoint].filter(
      (p): p is MapPoint => p !== null
    )

    if (allPoints.length < 2) {
      setErrors(['Se requieren al menos 2 puntos para procesar la ruta'])
      return { success: false, errors: ['Se requieren al menos 2 puntos'] }
    }

    setIsProcessing(true)
    setErrors([])

    try {
      // Convertir a GPSPoints
      const gpsPoints: GPSPoint[] = allPoints.map(toGPSPoint)

      // Procesar con los algoritmos
      const result = PROCESSING_SERVICE.processTrack(gpsPoints)

      // Validar
      const validation = PROCESSING_SERVICE.validateRoute(
        [startPoint!.latitude, startPoint!.longitude],
        [endPoint!.latitude, endPoint!.longitude],
        result.points
      )

      if (!validation.valid) {
        setValidationErrors(validation.errors)
        setIsProcessing(false)
        return { success: false, errors: validation.errors }
      }

      // Guardar resultados
      setProcessedTrack(result)
      setQuality(result.quality)
      setIsProcessing(false)

      return { success: true, errors: [] }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error procesando la ruta'
      setErrors([errorMessage])
      setIsProcessing(false)
      return { success: false, errors: [errorMessage] }
    }
  }, [startPoint, trackPoints, endPoint, toGPSPoint])

  // Guardar ruta
  const saveRoute = useCallback(async () => {
    // Validaciones previas
    const newErrors: string[] = []

    if (!name.trim()) {
      newErrors.push('El nombre de la ruta es requerido')
    }

    if (!startPoint) {
      newErrors.push('El punto de partida es requerido')
    }

    if (!endPoint) {
      newErrors.push('El punto de llegada es requerido')
    }

    if (trackPoints.length === 0) {
      newErrors.push('Se requiere al menos un punto intermedio')
    }

    if (newErrors.length > 0) {
      setErrors(newErrors)
      return { success: false, errors: newErrors }
    }

    // Procesar si no se ha hecho
    if (!processedTrack) {
      const processResult = processTrack()
      if (!processResult.success) {
        return processResult
      }
    }

    setIsSaving(true)
    setErrors([])

    try {
      // Obtener usuario actual de Supabase
      const supabase = createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        console.error('Error de autenticación:', authError)
        throw new Error('Usuario no autenticado. Por favor inicia sesión nuevamente.')
      }

      console.log('Usuario autenticado:', user.id)

      // Preparar puntos procesados
      const allRawPoints = [startPoint!, ...trackPoints, endPoint!].filter(
        (p): p is MapPoint => p !== null
      )
      const gpsPoints: GPSPoint[] = allRawPoints.map(toGPSPoint)
      const processed = processedTrack || PROCESSING_SERVICE.processTrack(gpsPoints)

      // Crear request
      const routeData: RouteCreationRequest = {
        name: name.trim(),
        description: description.trim() || undefined,
        difficulty,
        startCoord: [startPoint!.latitude, startPoint!.longitude],
        endCoord: [endPoint!.latitude, endPoint!.longitude],
        trackPoints: processed.points.map((p) => ({
          latitude: p.latitude,
          longitude: p.longitude,
          altitude: p.altitude,
          accuracy: p.accuracy,
        })),
        isPublic,
      }

      console.log('Guardando ruta:', routeData)

      // Guardar en Supabase
      const route = await ROUTE_REPOSITORY.createRoute(routeData, user.id)

      console.log('Ruta guardada exitosamente:', route.id)

      setIsSaving(false)
      
      // Resetear estado
      cancelDrawing()
      setName('')
      setDescription('')
      setDifficulty('Intermediate')
      setIsPublic(true)

      return { success: true, routeId: route.id, errors: [] }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error guardando la ruta'
      setErrors([errorMessage])
      setIsSaving(false)
      return { success: false, errors: [errorMessage] }
    }
  }, [
    name,
    description,
    difficulty,
    startPoint,
    endPoint,
    trackPoints,
    processedTrack,
    isPublic,
    processTrack,
    toGPSPoint,
    cancelDrawing,
  ])

  // Verificar si se puede guardar
  const canSave = useMemo(() => {
    return (
      name.trim().length > 0 &&
      startPoint !== null &&
      endPoint !== null &&
      trackPoints.length > 0 &&
      !isSaving &&
      !isProcessing
    )
  }, [name, startPoint, endPoint, trackPoints, isSaving, isProcessing])

  // Verificar si se puede procesar
  const canProcess = useMemo(() => {
    return (
      startPoint !== null &&
      endPoint !== null &&
      trackPoints.length > 0 &&
      !isProcessing
    )
  }, [startPoint, endPoint, trackPoints, isProcessing])

  return {
    // Estado
    startPoint,
    endPoint,
    trackPoints,
    isDrawing,
    isProcessing,
    isSaving,
    pointSelectionMode,
    name,
    description,
    difficulty,
    isPublic,
    processedTrack,
    quality,
    errors,
    validationErrors,

    // Acciones de dibujo
    startDrawing,
    stopDrawing,
    cancelDrawing,

    // Acciones de puntos
    setStartPoint,
    setEndPoint,
    addTrackPoint,
    removeTrackPoint,
    undoLastPoint,
    clearAllPoints,

    // Nuevas acciones de selección de puntos
    startPointSelection,
    cancelPointSelection,
    setPointSelectionMode,
    useCurrentLocation,

    // Acciones de formulario
    setName,
    setDescription,
    setDifficulty,
    setIsPublic,

    // Procesamiento y guardado
    processTrack,
    saveRoute,

    // Utilidades
    canSave,
    canProcess,
    getEstimatedDistance,
  }
}
