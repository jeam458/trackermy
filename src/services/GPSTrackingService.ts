'use client'

import { GPSTrackPoint } from '@/hooks/useMobileGPSTracker'
import { MapPoint } from '@/components/routes/RouteMapEditor'

export interface GPSReading {
  latitude: number
  longitude: number
  altitude: number | null
  accuracy: number | null
  speed: number | null
  heading: number | null
  timestamp: Date
  speedAccuracy: number | null
}

export interface GPSSession {
  isActive: boolean
  readings: GPSReading[]
  currentReading: GPSReading | null
  error: string | null
  permissionGranted: boolean
}

export interface GPSCalibration {
  // Offset de altitud (metros)
  altitudeOffset: number
  
  // Factor de corrección de velocidad
  speedCorrectionFactor: number
  
  // Última calibración
  lastCalibration: Date | null
  
  // Calidad de señal promedio
  averageSignalQuality: number
}

// Calcular distancia Haversine (metros)
function haversineDistance(point1: MapPoint, point2: MapPoint): number {
  const R = 6371000
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

// Calcular velocidad entre dos puntos
function calculateSpeedFromPoints(point1: GPSReading, point2: GPSReading): number {
  const mapPoint1: MapPoint = {
    latitude: point1.latitude,
    longitude: point1.longitude,
    altitude: point1.altitude ?? undefined,
  }
  const mapPoint2: MapPoint = {
    latitude: point2.latitude,
    longitude: point2.longitude,
    altitude: point2.altitude ?? undefined,
  }
  const distance = haversineDistance(mapPoint1, mapPoint2)
  const timeDiff = (point2.timestamp.getTime() - point1.timestamp.getTime()) / 1000
  
  if (timeDiff === 0) return 0
  return distance / timeDiff // m/s
}

// Evaluar calidad de señal GPS (0-100)
function evaluateSignalQuality(accuracy: number | null, satellites: number | null = null): number {
  if (!accuracy) return 0
  
  // Basado en precisión horizontal
  let quality = 100
  
  if (accuracy > 50) quality = 20
  else if (accuracy > 30) quality = 40
  else if (accuracy > 20) quality = 60
  else if (accuracy > 10) quality = 75
  else if (accuracy > 5) quality = 90
  else quality = 100
  
  return quality
}

// Filtro de Kalman simplificado para suavizar coordenadas
class SimpleKalmanFilter {
  private estimate: number
  private errorEstimate: number
  private errorMeasurement: number

  constructor(initialEstimate: number, initialError: number, measurementError: number) {
    this.estimate = initialEstimate
    this.errorEstimate = initialError
    this.errorMeasurement = measurementError
  }

  update(measurement: number): number {
    const kalmanGain = this.errorEstimate / (this.errorEstimate + this.errorMeasurement)
    this.estimate = this.estimate + kalmanGain * (measurement - this.estimate)
    this.errorEstimate = (1 - kalmanGain) * this.errorEstimate
    return this.estimate
  }

  getEstimate(): number {
    return this.estimate
  }
}

export class GPSTrackingService {
  private watchId: number | null = null
  private session: GPSSession = {
    isActive: false,
    readings: [],
    currentReading: null,
    error: null,
    permissionGranted: false,
  }
  
  private kalmanLat: SimpleKalmanFilter | null = null
  private kalmanLng: SimpleKalmanFilter | null = null
  private calibration: GPSCalibration = {
    altitudeOffset: 0,
    speedCorrectionFactor: 1.0,
    lastCalibration: null,
    averageSignalQuality: 0,
  }

  // Iniciar sesión de tracking
  async startSession(
    onLocationUpdate: (reading: GPSReading) => void,
    onError: (error: string) => void,
    enableHighAccuracy: boolean = true,
    maximumAge: number = 0,
    timeout: number = 15000
  ): Promise<boolean> {
    if (!navigator.geolocation) {
      const errorMsg = 'Geolocalización no soportada'
      this.session.error = errorMsg
      onError(errorMsg)
      return false
    }

    // Verificar permisos
    const permissionGranted = await this.checkPermission()
    if (!permissionGranted) {
      const errorMsg = 'Permiso de ubicación denegado'
      this.session.error = errorMsg
      onError(errorMsg)
      return false
    }

    this.session.isActive = true
    this.session.error = null
    this.session.readings = []

    // Inicializar filtros de Kalman
    this.kalmanLat = null
    this.kalmanLng = null

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const reading = this.processGPSReading(position)
        this.session.currentReading = reading
        this.session.readings.push(reading)
        
        // Mantener solo últimas 1000 lecturas
        if (this.session.readings.length > 1000) {
          this.session.readings = this.session.readings.slice(-1000)
        }

        onLocationUpdate(reading)
      },
      (error) => {
        let errorMsg = 'Error de GPS: '
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMsg += 'Permiso denegado'
            this.session.permissionGranted = false
            break
          case error.POSITION_UNAVAILABLE:
            errorMsg += 'Ubicación no disponible'
            break
          case error.TIMEOUT:
            errorMsg += 'Timeout'
            break
          default:
            errorMsg += 'Error desconocido'
        }
        this.session.error = errorMsg
        onError(errorMsg)
      },
      {
        enableHighAccuracy,
        maximumAge,
        timeout,
      }
    )

    return true
  }

  // Detener sesión
  stopSession(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId)
      this.watchId = null
    }
    this.session.isActive = false
    this.kalmanLat = null
    this.kalmanLng = null
  }

  // Obtener ubicación actual (una sola vez)
  async getCurrentPosition(): Promise<GPSReading | null> {
    if (!navigator.geolocation) {
      throw new Error('Geolocalización no soportada')
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const reading = this.processGPSReading(position)
          resolve(reading)
        },
        (error) => {
          let errorMsg = 'Error obteniendo ubicación: '
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMsg += 'Permiso denegado'
              break
            case error.POSITION_UNAVAILABLE:
              errorMsg += 'Ubicación no disponible'
              break
            case error.TIMEOUT:
              errorMsg += 'Timeout'
              break
            default:
              errorMsg += 'Error desconocido'
          }
          reject(new Error(errorMsg))
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      )
    })
  }

  // Procesar lectura GPS
  private processGPSReading(position: GeolocationPosition): GPSReading {
    const { latitude, longitude, altitude, accuracy, speed, heading } = position.coords
    
    let filteredLat = latitude
    let filteredLng = longitude

    // Aplicar filtro de Kalman si está disponible
    if (this.kalmanLat && this.kalmanLng) {
      filteredLat = this.kalmanLat.update(latitude)
      filteredLng = this.kalmanLng.update(longitude)
    } else {
      // Inicializar filtros
      this.kalmanLat = new SimpleKalmanFilter(latitude, 1, accuracy || 10)
      this.kalmanLng = new SimpleKalmanFilter(longitude, 1, accuracy || 10)
    }

    // Aplicar corrección de altitud
    const correctedAltitude = altitude !== null ? altitude + this.calibration.altitudeOffset : null

    // Calcular calidad de señal
    const signalQuality = evaluateSignalQuality(accuracy ?? null)

    // Actualizar calidad promedio
    this.calibration.averageSignalQuality = 
      (this.calibration.averageSignalQuality * this.session.readings.length + signalQuality) /
      (this.session.readings.length + 1)

    return {
      latitude: filteredLat,
      longitude: filteredLng,
      altitude: correctedAltitude,
      accuracy: accuracy ?? null,
      speed: speed !== null ? speed * this.calibration.speedCorrectionFactor : null,
      heading,
      timestamp: new Date(position.timestamp),
      speedAccuracy: null,
    }
  }

  // Verificar permisos
  private async checkPermission(): Promise<boolean> {
    try {
      if (navigator.permissions) {
        const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
        this.session.permissionGranted = result.state === 'granted'
        return this.session.permissionGranted
      }
      // Si no hay API de permisos, asumir que está concedido
      this.session.permissionGranted = true
      return true
    } catch {
      // Fallback si no hay soporte de permisos
      this.session.permissionGranted = true
      return true
    }
  }

  // Obtener sesión actual
  getSession(): GPSSession {
    return { ...this.session }
  }

  // Obtener calibración actual
  getCalibration(): GPSCalibration {
    return { ...this.calibration }
  }

  // Calibrar manualmente
  calibrate(knownAltitude?: number): void {
    if (this.session.currentReading && knownAltitude !== undefined) {
      this.calibration.altitudeOffset = knownAltitude - (this.session.currentReading.altitude || 0)
      this.calibration.lastCalibration = new Date()
    }
  }

  // Obtener puntos de track procesados
  getTrackPoints(minAccuracy?: number, minDistance?: number): GPSTrackPoint[] {
    const points: GPSTrackPoint[] = []
    let lastPoint: MapPoint | null = null

    for (const reading of this.session.readings) {
      // Filtrar por precisión
      if (minAccuracy && reading.accuracy && reading.accuracy > minAccuracy) {
        continue
      }

      // Filtrar por distancia mínima
      if (lastPoint && minDistance) {
        const readingAsMapPoint: MapPoint = {
          latitude: reading.latitude,
          longitude: reading.longitude,
          altitude: reading.altitude ?? undefined,
        }
        const distance = haversineDistance(lastPoint, readingAsMapPoint)
        if (distance < minDistance) {
          continue
        }
      }

      const point: GPSTrackPoint = {
        latitude: reading.latitude,
        longitude: reading.longitude,
        altitude: reading.altitude ?? undefined,
        accuracy: reading.accuracy ?? undefined,
        timestamp: reading.timestamp,
        speed: reading.speed ?? 0,
        heading: reading.heading,
      }

      points.push(point)
      lastPoint = {
        latitude: reading.latitude,
        longitude: reading.longitude,
        altitude: reading.altitude ?? undefined,
      }
    }

    return points
  }

  // Obtener estadísticas de la sesión
  getSessionStats(): {
    totalPoints: number
    totalDistance: number
    averageSpeed: number
    maxSpeed: number
    averageAccuracy: number
    duration: number
  } | null {
    if (this.session.readings.length < 2) return null

    let totalDistance = 0
    let maxSpeed = 0
    let totalAccuracy = 0
    let accurateReadings = 0

    for (let i = 1; i < this.session.readings.length; i++) {
      const prev = this.session.readings[i - 1]
      const curr = this.session.readings[i]

      // Distancia - convertir GPSReading a MapPoint
      const prevMap: MapPoint = {
        latitude: prev.latitude,
        longitude: prev.longitude,
        altitude: prev.altitude ?? undefined,
      }
      const currMap: MapPoint = {
        latitude: curr.latitude,
        longitude: curr.longitude,
        altitude: curr.altitude ?? undefined,
      }
      totalDistance += haversineDistance(prevMap, currMap)

      // Velocidad
      const speed = calculateSpeedFromPoints(prev, curr)
      if (speed > maxSpeed) {
        maxSpeed = speed
      }

      // Precisión
      if (curr.accuracy) {
        totalAccuracy += curr.accuracy
        accurateReadings++
      }
    }

    const duration = (this.session.readings[this.session.readings.length - 1].timestamp.getTime() -
      this.session.readings[0].timestamp.getTime()) / 1000

    const averageSpeed = duration > 0 ? totalDistance / duration : 0
    const averageAccuracy = accurateReadings > 0 ? totalAccuracy / accurateReadings : 0

    return {
      totalPoints: this.session.readings.length,
      totalDistance,
      averageSpeed,
      maxSpeed,
      averageAccuracy,
      duration,
    }
  }
}
