/**
 * GPS Track Point con información de precisión y timestamp
 */
export interface GPSPoint {
  latitude: number
  longitude: number
  altitude?: number
  accuracy?: number // metros de precisión horizontal
  timestamp?: Date
  speed?: number // m/s
}

/**
 * Punto de track procesado y validado
 */
export interface ProcessedTrackPoint {
  latitude: number
  longitude: number
  altitude?: number
  accuracy?: number
  timestamp?: Date
  orderIndex: number
  isFiltered: boolean // si fue marcado como ruido
  confidence: number // 0-1, confianza en el punto
  /** true si se proyectó a la red vial (map-matching) */
  roadSnapped?: boolean
}

/**
 * Resultado del procesamiento de track GPS
 */
export interface ProcessedTrack {
  points: ProcessedTrackPoint[]
  originalCount: number
  filteredCount: number
  distanceKm: number
  elevationGainM: number
  elevationLossM: number
  quality: TrackQuality
}

export type TrackQuality = 'excellent' | 'good' | 'fair' | 'poor'

/**
 * Configuración para el filtrado de puntos GPS
 */
export interface GPSFilterConfig {
  // Distancia mínima entre puntos consecutivos (metros)
  minDistanceBetweenPoints: number
  // Precisión máxima aceptable (metros)
  maxAccuracyThreshold: number
  // Velocidad máxima razonable para downhill (km/h)
  maxSpeedKmh: number
  // Factor de suavizado Kalman
  kalmanQ: number // process noise covariance
  kalmanR: number // measurement noise covariance
  // Simplificación Douglas-Peucker (tolerancia en metros)
  douglasPeuckerTolerance: number
  // Radio para outlier detection (metros desde línea base)
  outlierRadius: number
  /** Si true, el post-proceso no aplica Kalman (p. ej. grabación ya suavizada en vivo). */
  skipKalmanInPostprocess?: boolean
}

/**
 * Configuración por defecto optimizada para downhill
 */
export const DEFAULT_GPS_FILTER_CONFIG: GPSFilterConfig = {
  minDistanceBetweenPoints: 2, // metros mínimos entre puntos (coherente con grabación en vivo)
  maxAccuracyThreshold: 25, // descartar solo lecturas muy malas (callejón urbano / bosque)
  maxSpeedKmh: 120, // DH y saltos; evita saltos espurios sin recortar bajadas reales
  kalmanQ: 0.001, // bajo process noise
  kalmanR: 0.01, // measurement noise
  douglasPeuckerTolerance: 5, // 5 metros tolerancia
  outlierRadius: 20, // 20 metros desde línea base
}
