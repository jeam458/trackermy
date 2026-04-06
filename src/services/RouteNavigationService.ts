/**
 * Servicio de navegación para rutas
 * Proporciona indicaciones de dirección para seguir una ruta (online/offline)
 */

import { MapPoint } from '@/components/routes/RouteMapEditor'

export interface NavigationInstruction {
  distance: number // metros hasta la próxima instrucción
  direction: 'straight' | 'left' | 'right' | 'sharp-left' | 'sharp-right' | 'uturn'
  angle: number // grados
  instruction: string // texto descriptivo
  targetPoint: MapPoint
}

export interface NavigationState {
  isNavigating: boolean
  currentLocation: MapPoint | null
  currentInstruction: NavigationInstruction | null
  distanceToNext: number // metros
  distanceRemaining: number // metros totales
  progress: number // porcentaje 0-100
  isOnRoute: boolean // ¿está cerca de la ruta?
  deviation: number // metros de desviación
  nextPoints: MapPoint[] // próximos puntos para visualizar
}

export interface RouteNavigationConfig {
  // Distancia máxima para considerar que está "en la ruta" (metros)
  maxDistanceToRoute?: number // default: 20 metros
  
  // Distancia para anticipar próxima instrucción (metros)
  instructionAnticipation?: number // default: 30 metros
  
  // Cantidad de puntos ahead para mostrar
  pointsAhead?: number // default: 10
}

const DEFAULT_CONFIG: Required<RouteNavigationConfig> = {
  maxDistanceToRoute: 20,
  instructionAnticipation: 30,
  pointsAhead: 10,
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

// Calcular bearing entre dos puntos (grados)
function calculateBearing(from: MapPoint, to: MapPoint): number {
  const lat1 = (from.latitude * Math.PI) / 180
  const lat2 = (to.latitude * Math.PI) / 180
  const dLng = ((to.longitude - from.longitude) * Math.PI) / 180

  const y = Math.sin(dLng) * Math.cos(lat2)
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)

  let bearing = Math.atan2(y, x)
  bearing = (bearing * 180) / Math.PI
  return (bearing + 360) % 360
}

// Determinar dirección basada en cambio de bearing
function getDirection(fromBearing: number, toBearing: number): {
  direction: NavigationInstruction['direction']
  angle: number
} {
  let angleDiff = toBearing - fromBearing
  
  // Normalizar a -180 a 180
  if (angleDiff > 180) angleDiff -= 360
  if (angleDiff < -180) angleDiff += 360

  const absAngle = Math.abs(angleDiff)

  if (absAngle < 20) {
    return { direction: 'straight', angle: absAngle }
  } else if (absAngle < 60) {
    return {
      direction: angleDiff > 0 ? 'right' : 'left',
      angle: absAngle,
    }
  } else if (absAngle < 120) {
    return {
      direction: angleDiff > 0 ? 'sharp-right' : 'sharp-left',
      angle: absAngle,
    }
  } else {
    return { direction: 'uturn', angle: absAngle }
  }
}

// Generar texto de instrucción
function generateInstructionText(direction: NavigationInstruction['direction'], distance: number): string {
  const distanceText = distance < 1000 ? `${distance.toFixed(0)} m` : `${(distance / 1000).toFixed(1)} km`

  switch (direction) {
    case 'straight':
      return `Continúa recto por ${distanceText}`
    case 'left':
      return `Gira a la izquierda en ${distanceText}`
    case 'right':
      return `Gira a la derecha en ${distanceText}`
    case 'sharp-left':
      return `Gira pronunciadamente a la izquierda en ${distanceText}`
    case 'sharp-right':
      return `Gira pronunciadamente a la derecha en ${distanceText}`
    case 'uturn':
      return `Gira en U en ${distanceText}`
    default:
      return `Continúa por ${distanceText}`
  }
}

export class RouteNavigationService {
  private config: Required<RouteNavigationConfig>
  private routePoints: MapPoint[] = []
  private currentPointIndex: number = 0

  constructor(config?: RouteNavigationConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  // Establecer ruta a seguir
  setRoute(points: MapPoint[]): void {
    this.routePoints = points
    this.currentPointIndex = 0
  }

  // Actualizar ubicación y obtener estado de navegación
  updateLocation(location: MapPoint): NavigationState {
    if (this.routePoints.length === 0) {
      return {
        isNavigating: false,
        currentLocation: location,
        currentInstruction: null,
        distanceToNext: 0,
        distanceRemaining: 0,
        progress: 0,
        isOnRoute: false,
        deviation: 0,
        nextPoints: [],
      }
    }

    // Encontrar punto más cercano en la ruta
    const nearestResult = this.findNearestPointOnRoute(location)
    const distanceToRoute = nearestResult.distance

    // Actualizar índice de punto actual
    this.currentPointIndex = nearestResult.index

    // Calcular distancia restante
    let distanceRemaining = 0
    for (let i = nearestResult.index; i < this.routePoints.length - 1; i++) {
      distanceRemaining += haversineDistance(this.routePoints[i], this.routePoints[i + 1])
    }

    // Calcular progreso
    const progress = this.routePoints.length > 1
      ? (nearestResult.index / (this.routePoints.length - 1)) * 100
      : 0

    // Obtener próxima instrucción
    const nextInstruction = this.getNextInstruction(location, nearestResult.index)

    // Obtener próximos puntos
    const nextPoints = this.routePoints.slice(
      nearestResult.index,
      nearestResult.index + this.config.pointsAhead
    )

    return {
      isNavigating: true,
      currentLocation: location,
      currentInstruction: nextInstruction,
      distanceToNext: nextInstruction?.distance ?? 0,
      distanceRemaining,
      progress,
      isOnRoute: distanceToRoute <= this.config.maxDistanceToRoute,
      deviation: distanceToRoute,
      nextPoints,
    }
  }

  // Encontrar punto más cercano en la ruta
  private findNearestPointOnRoute(location: MapPoint): {
    index: number
    distance: number
  } {
    let minDistance = Infinity
    let minIndex = 0

    // Buscar solo desde el punto actual para mejor rendimiento
    for (let i = this.currentPointIndex; i < this.routePoints.length; i++) {
      const distance = haversineDistance(location, this.routePoints[i])
      if (distance < minDistance) {
        minDistance = distance
        minIndex = i
      }
    }

    return {
      index: minIndex,
      distance: minDistance,
    }
  }

  // Obtener próxima instrucción de navegación
  private getNextInstruction(location: MapPoint, currentIndex: number): NavigationInstruction | null {
    if (currentIndex >= this.routePoints.length - 1) {
      return {
        distance: 0,
        direction: 'straight',
        angle: 0,
        instruction: '¡Has llegado a tu destino!',
        targetPoint: this.routePoints[this.routePoints.length - 1],
      }
    }

    // Buscar próximo cambio de dirección
    for (let i = currentIndex + 1; i < this.routePoints.length - 1; i++) {
      const prevPoint = this.routePoints[i - 1]
      const currPoint = this.routePoints[i]
      const nextPoint = this.routePoints[i + 1]

      const bearing1 = calculateBearing(prevPoint, currPoint)
      const bearing2 = calculateBearing(currPoint, nextPoint)
      const { direction, angle } = getDirection(bearing1, bearing2)

      // Si hay un giro significativo
      if (direction !== 'straight') {
        const distanceToTurn = haversineDistance(location, currPoint)

        // Solo mostrar si está dentro del rango de anticipación
        if (distanceToTurn <= this.config.instructionAnticipation * 2) {
          return {
            distance: distanceToTurn,
            direction,
            angle,
            instruction: generateInstructionText(direction, distanceToTurn),
            targetPoint: currPoint,
          }
        }
      }
    }

    // Si no hay giros, instrucción de continuar recto
    const nextPoint = this.routePoints[Math.min(currentIndex + 1, this.routePoints.length - 1)]
    const distance = haversineDistance(location, nextPoint)

    return {
      distance,
      direction: 'straight',
      angle: 0,
      instruction: generateInstructionText('straight', distance),
      targetPoint: nextPoint,
    }
  }

  // Verificar si se salió de la ruta
  checkDeviation(location: MapPoint): {
    isOffRoute: boolean
    deviation: number
    nearestPoint: MapPoint | null
  } {
    const nearest = this.findNearestPointOnRoute(location)
    const isOffRoute = nearest.distance > this.config.maxDistanceToRoute * 2

    return {
      isOffRoute,
      deviation: nearest.distance,
      nearestPoint: isOffRoute ? this.routePoints[nearest.index] : null,
    }
  }

  // Generar instrucciones de voz (texto)
  generateVoiceInstruction(state: NavigationState): string {
    if (!state.currentInstruction) return ''

    const { direction, distance } = state.currentInstruction

    if (distance < 10) {
      switch (direction) {
        case 'left':
        case 'sharp-left':
          return '¡Gira a la izquierda ahora!'
        case 'right':
        case 'sharp-right':
          return '¡Gira a la derecha ahora!'
        case 'uturn':
          return '¡Gira en U ahora!'
        default:
          return '¡Continúa recto!'
      }
    }

    return state.currentInstruction.instruction
  }

  // Resetear navegación
  reset(): void {
    this.routePoints = []
    this.currentPointIndex = 0
  }
}
