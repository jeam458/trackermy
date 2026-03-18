import { Route, RouteUpdateRequest } from '../domain/Route'
import { ProcessedTrackPoint } from '../domain/GPSTrack'

/**
 * Servicio para corregir y mejorar rutas automáticamente
 */
export class RouteEnhancementService {
  /**
   * Corregir ruta incompleta o con errores
   */
  enhanceRoute(route: Partial<Route>): RouteEnhancementResult {
    const enhanced: Partial<Route> = { ...route }
    const result: RouteEnhancementResult = {
      original: route,
      enhanced,
      changes: [],
    }

    // 1. Corregir punto final si falta
    if (this.needsEndPointFix(route)) {
      this.fixEndPoint(enhanced, result.changes)
    }

    // 2. Calcular distancia real desde los puntos del track
    if (this.needsDistanceCalculation(route)) {
      this.calculateDistance(enhanced, result.changes)
    }

    // 3. Calcular elevación ganada/perdida
    if (this.needsElevationCalculation(route)) {
      this.calculateElevation(enhanced, result.changes)
    }

    return result
  }

  /**
   * Verificar si necesita corrección de punto final
   */
  private needsEndPointFix(route: Partial<Route>): boolean {
    // Si no hay punto final PERO hay puntos intermedios
    if (!route.endCoord && route.trackPoints && route.trackPoints.length > 0) {
      return true
    }
    
    // Si el punto final está muy lejos del último punto intermedio (> 100m)
    if (route.endCoord && route.trackPoints && route.trackPoints.length > 0) {
      const lastPoint = route.trackPoints[route.trackPoints.length - 1]
      const distance = this.haversineDistance(
        route.endCoord[0], route.endCoord[1],
        lastPoint.latitude, lastPoint.longitude
      )
      
      // Si está a más de 100 metros, probablemente esté mal ubicado
      if (distance > 100) {
        return true
      }
    }

    return false
  }

  /**
   * Corregir punto final usando el último punto intermedio
   */
  private fixEndPoint(route: Partial<Route>, changes: EnhancementChange[]): void {
    if (!route.trackPoints || route.trackPoints.length === 0) return

    const lastPoint = route.trackPoints[route.trackPoints.length - 1]
    const oldEndCoord = route.endCoord

    // Usar el último punto intermedio como punto final
    route.endCoord = [lastPoint.latitude, lastPoint.longitude]

    if (oldEndCoord) {
      changes.push({
        field: 'endCoord',
        old: oldEndCoord,
        new: route.endCoord,
        reason: 'Punto final corregido automáticamente (último punto intermedio)',
      })
    } else {
      changes.push({
        field: 'endCoord',
        old: null,
        new: route.endCoord,
        reason: 'Punto final agregado automáticamente (último punto intermedio)',
      })
    }
  }

  /**
   * Verificar si necesita cálculo de distancia
   */
  private needsDistanceCalculation(route: Partial<Route>): boolean {
    // Si no hay distancia O si es 0 O si hay puntos del track
    if (!route.distanceKm || route.distanceKm === 0) {
      return true
    }

    // Si hay puntos del track, recalcular para mayor precisión
    if (route.trackPoints && route.trackPoints.length > 1) {
      return true
    }

    return false
  }

  /**
   * Calcular distancia real desde los puntos del track
   */
  private calculateDistance(route: Partial<Route>, changes: EnhancementChange[]): void {
    const points = this.getAllPoints(route)
    
    if (points.length < 2) {
      route.distanceKm = 0
      return
    }

    let totalDistance = 0

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]
      const curr = points[i]

      totalDistance += this.haversineDistance(
        prev.latitude, prev.longitude,
        curr.latitude, curr.longitude
      )
    }

    const oldDistance = route.distanceKm || 0
    route.distanceKm = totalDistance / 1000 // Convertir a km

    changes.push({
      field: 'distanceKm',
      old: oldDistance,
      new: route.distanceKm,
      reason: `Distancia calculada desde ${points.length} puntos del track`,
    })
  }

  /**
   * Verificar si necesita cálculo de elevación
   */
  private needsElevationCalculation(route: Partial<Route>): boolean {
    // Si no hay elevación O si hay puntos con altitud
    if (!route.elevationGainM && !route.elevationLossM) {
      return true
    }

    // Si hay puntos con altitud, recalcular
    if (route.trackPoints && route.trackPoints.some(p => p.altitude !== undefined)) {
      return true
    }

    return false
  }

  /**
   * Calcular elevación ganada y perdida
   */
  private calculateElevation(route: Partial<Route>, changes: EnhancementChange[]): void {
    const points = this.getAllPoints(route)
    
    let elevationGain = 0
    let elevationLoss = 0
    let pointsWithAltitude = 0

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]
      const curr = points[i]

      if (prev.altitude !== undefined && curr.altitude !== undefined) {
        pointsWithAltitude++
        const diff = curr.altitude - prev.altitude

        if (diff > 0) {
          elevationGain += diff
        } else {
          elevationLoss += Math.abs(diff)
        }
      }
    }

    const oldGain = route.elevationGainM || 0
    const oldLoss = route.elevationLossM || 0

    route.elevationGainM = elevationGain
    route.elevationLossM = elevationLoss

    if (pointsWithAltitude > 0) {
      changes.push({
        field: 'elevationGainM',
        old: oldGain,
        new: elevationGain,
        reason: `Elevación positiva calculada desde ${pointsWithAltitude} puntos con altitud`,
      })

      changes.push({
        field: 'elevationLossM',
        old: oldLoss,
        new: elevationLoss,
        reason: `Elevación negativa calculada desde ${pointsWithAltitude} puntos con altitud`,
      })
    }
  }

  /**
   * Obtener todos los puntos de la ruta (inicio + intermedios + fin)
   */
  private getAllPoints(route: Partial<Route>): ProcessedTrackPoint[] {
    const points: ProcessedTrackPoint[] = []

    // Agregar punto de inicio
    if (route.startCoord) {
      points.push({
        latitude: route.startCoord[0],
        longitude: route.startCoord[1],
        orderIndex: 0,
        confidence: 1,
        isFiltered: false,
      })
    }

    // Agregar puntos intermedios
    if (route.trackPoints) {
      route.trackPoints.forEach((point, index) => {
        points.push({
          latitude: point.latitude,
          longitude: point.longitude,
          altitude: point.altitude,
          orderIndex: index + 1,
          confidence: 1,
          isFiltered: false,
        })
      })
    }

    // Agregar punto final si existe y es diferente del último
    if (route.endCoord && route.trackPoints && route.trackPoints.length > 0) {
      const lastPoint = route.trackPoints[route.trackPoints.length - 1]
      const isDifferent = 
        Math.abs(route.endCoord[0] - lastPoint.latitude) > 0.0001 ||
        Math.abs(route.endCoord[1] - lastPoint.longitude) > 0.0001

      if (isDifferent) {
        points.push({
          latitude: route.endCoord[0],
          longitude: route.endCoord[1],
          orderIndex: points.length,
          confidence: 1,
          isFiltered: false,
        })
      }
    }

    return points
  }

  /**
   * Calcular distancia entre dos coordenadas (Haversine)
   */
  private haversineDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371000 // Radio de la Tierra en metros
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
   * Calcular pendiente promedio entre dos puntos
   */
  calculateSlope(
    lat1: number,
    lng1: number,
    alt1: number,
    lat2: number,
    lng2: number,
    alt2: number
  ): number {
    const horizontalDistance = this.haversineDistance(lat1, lng1, lat2, lng2)
    const verticalDistance = alt2 - alt1

    if (horizontalDistance === 0) return 0

    return (verticalDistance / horizontalDistance) * 100 // Porcentaje
  }

  /**
   * Obtener pendiente máxima de una ruta
   */
  getMaxSlope(route: Partial<Route>): number {
    const points = this.getAllPoints(route)
    let maxSlope = 0

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]
      const curr = points[i]

      if (prev.altitude !== undefined && curr.altitude !== undefined) {
        const slope = Math.abs(this.calculateSlope(
          prev.latitude, prev.longitude, prev.altitude,
          curr.latitude, curr.longitude, curr.altitude
        ))

        if (slope > maxSlope) {
          maxSlope = slope
        }
      }
    }

    return maxSlope
  }
}

/**
 * Resultado de la mejora de ruta
 */
export interface RouteEnhancementResult {
  original: Partial<Route>
  enhanced: Partial<Route>
  changes: EnhancementChange[]
}

/**
 * Cambio realizado en la ruta
 */
export interface EnhancementChange {
  field: string
  old: any
  new: any
  reason: string
}
