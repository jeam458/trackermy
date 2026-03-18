import {
  GPSPoint,
  ProcessedTrackPoint,
  ProcessedTrack,
  TrackQuality,
  GPSFilterConfig,
  DEFAULT_GPS_FILTER_CONFIG,
} from '../domain/GPSTrack'
import { RouteCreationRequest, Route, RouteTrackPoint } from '../domain/Route'

/**
 * Servicio para procesamiento de tracks GPS con algoritmos de mitigación de ruido
 */
export class GPSTrackProcessingService {
  private config: GPSFilterConfig

  constructor(config: GPSFilterConfig = DEFAULT_GPS_FILTER_CONFIG) {
    this.config = config
  }

  /**
   * Procesa una lista de puntos GPS crudos aplicando todos los filtros
   */
  processTrack(rawPoints: GPSPoint[]): ProcessedTrack {
    const originalCount = rawPoints.length

    // 1. Validación básica y conversión
    let points = this.convertToProcessedPoints(rawPoints)

    // 2. Filtrar por precisión GPS
    points = this.filterByAccuracy(points)

    // 3. Filtrar por velocidad imposible (outliers de movimiento)
    points = this.filterByImpossibleSpeed(points)

    // 4. Aplicar filtro Kalman simplificado para suavizado
    points = this.applyKalmanFilter(points)

    // 5. Eliminar puntos muy cercanos (redundantes)
    points = this.filterClosePoints(points)

    // 6. Detectar y remover outliers geométricos
    points = this.removeGeometricOutliers(points)

    // 7. Simplificar con Douglas-Peucker
    points = this.simplifyDouglasPeucker(points)

    const filteredCount = originalCount - points.length
    const distanceKm = this.calculateDistance(points)
    const { elevationGain, elevationLoss } = this.calculateElevation(points)
    const quality = this.calculateQuality(originalCount, filteredCount, points)

    return {
      points,
      originalCount,
      filteredCount,
      distanceKm,
      elevationGainM: elevationGain,
      elevationLossM: elevationLoss,
      quality,
    }
  }

  private convertToProcessedPoints(rawPoints: GPSPoint[]): ProcessedTrackPoint[] {
    return rawPoints.map((point, index) => ({
      latitude: point.latitude,
      longitude: point.longitude,
      altitude: point.altitude,
      accuracy: point.accuracy,
      timestamp: point.timestamp,
      orderIndex: index,
      isFiltered: false,
      confidence: 1.0,
    }))
  }

  /**
   * Filtra puntos con baja precisión GPS
   */
  private filterByAccuracy(points: ProcessedTrackPoint[]): ProcessedTrackPoint[] {
    return points.filter((point) => {
      if (point.accuracy === undefined) return true
      if (point.accuracy > this.config.maxAccuracyThreshold) {
        return false
      }
      return true
    })
  }

  /**
   * Filtra puntos que implicarían velocidad imposible para downhill
   */
  private filterByImpossibleSpeed(points: ProcessedTrackPoint[]): ProcessedTrackPoint[] {
    if (points.length < 2) return points

    const filtered: ProcessedTrackPoint[] = [points[0]]

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]
      const curr = points[i]

      const distanceM = this.haversineDistance(
        prev.latitude,
        prev.longitude,
        curr.latitude,
        curr.longitude
      )

      // Si tenemos timestamps, calcular velocidad real
      if (prev.timestamp && curr.timestamp) {
        const timeDiffS = Math.abs(curr.timestamp.getTime() - prev.timestamp.getTime()) / 1000
        if (timeDiffS > 0) {
          const speedMps = distanceM / timeDiffS
          const speedKmh = speedMps * 3.6

          if (speedKmh <= this.config.maxSpeedKmh) {
            filtered.push(curr)
          }
        } else {
          filtered.push(curr)
        }
      } else {
        // Sin timestamp, asumir que es válido
        filtered.push(curr)
      }
    }

    return filtered
  }

  /**
   * Aplica filtro Kalman simplificado para suavizar coordenadas
   */
  private applyKalmanFilter(points: ProcessedTrackPoint[]): ProcessedTrackPoint[] {
    if (points.length < 3) return points

    const filtered: ProcessedTrackPoint[] = []
    
    // Estado inicial: primer punto
    let estLat = points[0].latitude
    let estLng = points[0].longitude
    let estVar = 0.0001 // varianza inicial pequeña

    const { kalmanQ, kalmanR } = this.config

    for (let i = 0; i < points.length; i++) {
      const point = points[i]

      // Predicción
      const predVar = estVar + kalmanQ

      // Actualización
      const kalmanGain = predVar / (predVar + kalmanR)
      estLat = estLat + kalmanGain * (point.latitude - estLat)
      estLng = estLng + kalmanGain * (point.longitude - estLng)
      estVar = (1 - kalmanGain) * predVar

      filtered.push({
        ...point,
        latitude: estLat,
        longitude: estLng,
        confidence: Math.min(1, 0.5 + kalmanGain * 0.5),
      })
    }

    return filtered
  }

  /**
   * Elimina puntos muy cercanos entre sí
   */
  private filterClosePoints(points: ProcessedTrackPoint[]): ProcessedTrackPoint[] {
    if (points.length < 2) return points

    const filtered: ProcessedTrackPoint[] = [points[0]]

    for (let i = 1; i < points.length; i++) {
      const prev = filtered[filtered.length - 1]
      const curr = points[i]

      const distanceM = this.haversineDistance(
        prev.latitude,
        prev.longitude,
        curr.latitude,
        curr.longitude
      )

      if (distanceM >= this.config.minDistanceBetweenPoints) {
        filtered.push(curr)
      }
    }

    return filtered
  }

  /**
   * Detecta y remueve outliers geométricos (puntos que se desvían mucho de la trayectoria)
   */
  private removeGeometricOutliers(points: ProcessedTrackPoint[]): ProcessedTrackPoint[] {
    if (points.length < 3) return points

    const filtered: ProcessedTrackPoint[] = [points[0]]

    for (let i = 1; i < points.length - 1; i++) {
      const prev = filtered[filtered.length - 1]
      const curr = points[i]
      const next = points[i + 1]

      // Calcular distancia perpendicular del punto a la línea entre prev y next
      const perpDistance = this.perpendicularDistance(
        curr.latitude,
        curr.longitude,
        prev.latitude,
        prev.longitude,
        next.latitude,
        next.longitude
      )

      if (perpDistance <= this.config.outlierRadius) {
        filtered.push(curr)
      } else {
        // Marcar como outlier pero mantener si es el último punto
        if (i === points.length - 2) {
          filtered.push(curr)
        }
      }
    }

    // Siempre incluir el último punto
    filtered.push(points[points.length - 1])

    return filtered
  }

  /**
   * Simplifica el track usando algoritmo Douglas-Peucker
   */
  private simplifyDouglasPeucker(points: ProcessedTrackPoint[]): ProcessedTrackPoint[] {
    if (points.length < 3) return points

    const epsilon = this.config.douglasPeuckerTolerance / 111000 // convertir metros a grados aprox

    const simplified = this.douglasPeuckerRecursive(points, 0, points.length - 1, epsilon)
    return simplified
  }

  private douglasPeuckerRecursive(
    points: ProcessedTrackPoint[],
    start: number,
    end: number,
    epsilon: number
  ): ProcessedTrackPoint[] {
    if (end <= start + 1) {
      return points.slice(start, end + 1)
    }

    // Encontrar el punto con máxima distancia
    let maxDist = 0
    let maxIndex = start

    const startLat = points[start].latitude
    const startLng = points[start].longitude
    const endLat = points[end].latitude
    const endLng = points[end].longitude

    for (let i = start + 1; i < end; i++) {
      const dist = this.perpendicularDistance(
        points[i].latitude,
        points[i].longitude,
        startLat,
        startLng,
        endLat,
        endLng
      )

      if (dist > maxDist) {
        maxDist = dist
        maxIndex = i
      }
    }

    // Si la distancia máxima es mayor que epsilon, dividir recursivamente
    if (maxDist > epsilon) {
      const left = this.douglasPeuckerRecursive(points, start, maxIndex, epsilon)
      const right = this.douglasPeuckerRecursive(points, maxIndex, end, epsilon)
      return [...left.slice(0, -1), ...right]
    } else {
      // Mantener solo los puntos extremos
      return [points[start], points[end]]
    }
  }

  /**
   * Calcula la distancia total del track en km
   */
  private calculateDistance(points: ProcessedTrackPoint[]): number {
    if (points.length < 2) return 0

    let totalDistanceM = 0

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]
      const curr = points[i]

      totalDistanceM += this.haversineDistance(
        prev.latitude,
        prev.longitude,
        curr.latitude,
        curr.longitude
      )
    }

    return totalDistanceM / 1000
  }

  /**
   * Calcula elevación acumulada (ganancia y pérdida)
   */
  private calculateElevation(points: ProcessedTrackPoint[]): {
    elevationGain: number
    elevationLoss: number
  } {
    if (points.length < 2 || points[0].altitude === undefined) {
      return { elevationGain: 0, elevationLoss: 0 }
    }

    let gain = 0
    let loss = 0

    for (let i = 1; i < points.length; i++) {
      const prevAlt = points[i - 1].altitude ?? 0
      const currAlt = points[i].altitude ?? 0
      const diff = currAlt - prevAlt

      if (diff > 0) {
        gain += diff
      } else {
        loss += Math.abs(diff)
      }
    }

    return { elevationGain: gain, elevationLoss: loss }
  }

  /**
   * Calcula la calidad del track basado en el filtrado
   */
  private calculateQuality(
    originalCount: number,
    filteredCount: number,
    points: ProcessedTrackPoint[]
  ): TrackQuality {
    if (points.length < 2) return 'poor'

    const filterRatio = filteredCount / originalCount
    const avgConfidence =
      points.reduce((sum, p) => sum + p.confidence, 0) / points.length

    // Excelente: poco filtrado, alta confianza
    if (filterRatio < 0.1 && avgConfidence > 0.9) return 'excellent'
    // Bueno: filtrado moderado
    if (filterRatio < 0.3 && avgConfidence > 0.8) return 'good'
    // Regular: mucho filtrado necesario
    if (filterRatio < 0.5 && avgConfidence > 0.6) return 'fair'
    // Pobre: muchos puntos descartados
    return 'poor'
  }

  /**
   * Calcula distancia entre dos coordenadas usando fórmula Haversine
   */
  private haversineDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371000 // radio de la Tierra en metros
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
  }

  /**
   * Calcula distancia perpendicular de un punto a una línea
   */
  private perpendicularDistance(
    pointLat: number,
    pointLng: number,
    lineStartLat: number,
    lineStartLng: number,
    lineEndLat: number,
    lineEndLng: number
  ): number {
    // Usar aproximación plana para distancias cortas
    const x0 = pointLng
    const y0 = pointLat
    const x1 = lineStartLng
    const y1 = lineStartLat
    const x2 = lineEndLng
    const y2 = lineEndLat

    const A = x0 - x1
    const B = y0 - y1
    const C = x2 - x1
    const D = y2 - y1

    const dot = A * C + B * D
    const lenSq = C * C + D * D

    let param = -1
    if (lenSq !== 0) {
      param = dot / lenSq
    }

    let xx, yy

    if (param < 0) {
      xx = x1
      yy = y1
    } else if (param > 1) {
      xx = x2
      yy = y2
    } else {
      xx = x1 + param * C
      yy = y1 + param * D
    }

    const dx = x0 - xx
    const dy = y0 - yy

    // Convertir a metros (aproximación)
    const metersPerDegree = 111000
    return Math.sqrt(dx * dx + dy * dy) * metersPerDegree
  }

  /**
   * Valida que una ruta tenga puntos suficientes y coherentes
   */
  validateRoute(
    startCoord: [number, number],
    endCoord: [number, number],
    trackPoints: ProcessedTrackPoint[]
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // Validar punto de inicio
    if (!startCoord || startCoord.length !== 2) {
      errors.push('Punto de partida inválido')
    }

    // Validar punto de llegada
    if (!endCoord || endCoord.length !== 2) {
      errors.push('Punto de llegada inválido')
    }

    // Validar cantidad mínima de puntos
    if (trackPoints.length < 2) {
      errors.push('Se requieren al menos 2 puntos para crear una ruta')
    }

    // Validar que el primer punto esté cerca del inicio
    if (trackPoints.length > 0 && startCoord) {
      const distStart = this.haversineDistance(
        startCoord[0],
        startCoord[1],
        trackPoints[0].latitude,
        trackPoints[0].longitude
      )
      if (distStart > 50) {
        errors.push('El primer punto del track debe estar cerca del punto de partida (< 50m)')
      }
    }

    // Validar que el último punto esté cerca del fin
    if (trackPoints.length > 0 && endCoord) {
      const lastPoint = trackPoints[trackPoints.length - 1]
      const distEnd = this.haversineDistance(
        endCoord[0],
        endCoord[1],
        lastPoint.latitude,
        lastPoint.longitude
      )
      if (distEnd > 50) {
        errors.push('El último punto del track debe estar cerca del punto de llegada (< 50m)')
      }
    }

    // Validar distancia mínima de ruta
    const totalDistance = this.calculateDistance(trackPoints)
    if (totalDistance < 0.1) {
      errors.push('La ruta debe tener al menos 100 metros de longitud')
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Convierte ProcessedTrackPoint a RouteTrackPoint para persistencia
   */
  toRouteTrackPoints(processedPoints: ProcessedTrackPoint[]): RouteTrackPoint[] {
    return processedPoints.map((point, index) => ({
      latitude: point.latitude,
      longitude: point.longitude,
      altitude: point.altitude,
      accuracy: point.accuracy,
      timestamp: point.timestamp,
      orderIndex: index,
    }))
  }
}
