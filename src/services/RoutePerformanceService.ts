/**
 * Servicio de análisis de rendimiento de riders
 * Detecta saltos, movimientos bruscos, velocidad y ritmo del ciclista
 */

export interface GPSPoint {
  latitude: number
  longitude: number
  altitude: number | null
  speed: number | null
  timestamp: Date
  accuracy?: number
}

export interface PerformanceMetrics {
  // Tiempos
  totalTime: number // segundos
  movingTime: number // segundos (sin paradas)
  stoppedTime: number // segundos
  
  // Velocidades (m/s)
  minSpeed: number
  maxSpeed: number
  avgSpeed: number
  medianSpeed: number
  
  // Distancia
  totalDistance: number // metros
  
  // Elevación
  elevationGain: number // metros positivos
  elevationLoss: number // metros negativos
  maxAltitude: number
  minAltitude: number
  
  // Eventos detectados
  jumps: JumpEvent[]
  sharpMovements: SharpMovementEvent[]
  stops: StopEvent[]
  hardBrakes: HardBrakeEvent[]
  accelerations: AccelerationEvent[]
  
  // Ritmo del ciclista
  rhythmScore: number // 0-100 (qué tan constante fue)
  intensityScore: number // 0-100 (qué tan intenso fue el recorrido)
  aggressionScore: number // 0-100 (qué tan agresivo fue el estilo)
  
  // Segmentos
  segments: Segment[]
  
  // Score general
  overallScore: number // 0-100
}

export interface JumpEvent {
  startTime: Date
  endTime: Date
  duration: number // segundos en el aire
  height: number // metros de altura
  distance: number // metros de distancia
  landingSpeed: number // m/s al aterrizar
  severity: 'light' | 'medium' | 'hard'
}

export interface SharpMovementEvent {
  timestamp: Date
  direction: 'left' | 'right'
  angle: number // grados de cambio de dirección
  speed: number // m/s en el momento
  severity: 'mild' | 'moderate' | 'sharp'
}

export interface StopEvent {
  startTime: Date
  endTime: Date
  duration: number // segundos
  location: { latitude: number; longitude: number }
}

export interface HardBrakeEvent {
  timestamp: Date
  speedBefore: number // m/s
  speedAfter: number // m/s
  deceleration: number // m/s²
  severity: 'moderate' | 'hard' | 'extreme'
}

export interface AccelerationEvent {
  timestamp: Date
  speedBefore: number
  speedAfter: number
  acceleration: number // m/s²
  duration: number // segundos
}

export interface Segment {
  id: number
  startDistance: number // metros desde inicio
  endDistance: number
  distance: number
  time: number // segundos
  avgSpeed: number
  maxSpeed: number
  elevationChange: number
  type: 'uphill' | 'downhill' | 'flat' | 'technical'
}

// Calcular distancia Haversine (metros)
function haversineDistance(point1: GPSPoint, point2: GPSPoint): number {
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
function calculateBearing(point1: GPSPoint, point2: GPSPoint): number {
  const lat1 = (point1.latitude * Math.PI) / 180
  const lat2 = (point2.latitude * Math.PI) / 180
  const dLng = ((point2.longitude - point1.longitude) * Math.PI) / 180

  const y = Math.sin(dLng) * Math.cos(lat2)
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)

  let bearing = Math.atan2(y, x)
  bearing = (bearing * 180) / Math.PI
  return (bearing + 360) % 360
}

// Calcular mediana
function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

export class RoutePerformanceService {
  // Analizar rendimiento completo del rider
  analyzePerformance(points: GPSPoint[]): PerformanceMetrics {
    if (points.length < 2) {
      throw new Error('Se requieren al menos 2 puntos para analizar')
    }

    // Calcular métricas básicas
    const totalTime = (points[points.length - 1].timestamp.getTime() - points[0].timestamp.getTime()) / 1000
    const speeds = points.map(p => p.speed ?? 0).filter(s => s > 0)
    const allSpeeds = points.map(p => p.speed ?? 0)
    
    const movingTime = speeds.length > 0
      ? speeds.reduce((sum, _, idx) => {
          if (idx === 0) return 1
          const timeDiff = (points[idx].timestamp.getTime() - points[idx - 1].timestamp.getTime()) / 1000
          return sum + timeDiff
        }, 0)
      : 0
    
    const stoppedTime = totalTime - movingTime

    // Calcular distancia total
    let totalDistance = 0
    for (let i = 1; i < points.length; i++) {
      totalDistance += haversineDistance(points[i - 1], points[i])
    }

    // Calcular elevación
    let elevationGain = 0
    let elevationLoss = 0
    let maxAltitude = -Infinity
    let minAltitude = Infinity

    for (let i = 1; i < points.length; i++) {
      const prevAlt = points[i - 1].altitude
      const currAlt = points[i].altitude

      if (prevAlt !== null && currAlt !== null) {
        const diff = currAlt - prevAlt
        if (diff > 0) elevationGain += diff
        else elevationLoss += Math.abs(diff)

        maxAltitude = Math.max(maxAltitude, currAlt)
        minAltitude = Math.min(minAltitude, currAlt)
      }
    }

    // Detectar eventos
    const jumps = this.detectJumps(points)
    const sharpMovements = this.detectSharpMovements(points)
    const stops = this.detectStops(points)
    const hardBrakes = this.detectHardBrakes(points)
    const accelerations = this.detectAccelerations(points)

    // Calcular segmentos
    const segments = this.calculateSegments(points)

    // Calcular scores
    const rhythmScore = this.calculateRhythmScore(points, speeds)
    const intensityScore = this.calculateIntensityScore(speeds, elevationGain, totalDistance)
    const aggressionScore = this.calculateAggressionScore(jumps, sharpMovements, hardBrakes)

    // Score general ponderado
    const overallScore = Math.round(
      rhythmScore * 0.3 +
      intensityScore * 0.3 +
      aggressionScore * 0.2 +
      Math.min(100, (speeds.length > 0 ? Math.max(...speeds) : 0) / 20 * 100) * 0.2
    )

    return {
      totalTime,
      movingTime,
      stoppedTime,
      minSpeed: allSpeeds.length > 0 ? Math.min(...allSpeeds) : 0,
      maxSpeed: allSpeeds.length > 0 ? Math.max(...allSpeeds) : 0,
      avgSpeed: speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0,
      medianSpeed: median(speeds),
      totalDistance,
      elevationGain,
      elevationLoss,
      maxAltitude: maxAltitude === -Infinity ? 0 : maxAltitude,
      minAltitude: minAltitude === Infinity ? 0 : minAltitude,
      jumps,
      sharpMovements,
      stops,
      hardBrakes,
      accelerations,
      rhythmScore,
      intensityScore,
      aggressionScore,
      segments,
      overallScore,
    }
  }

  // Detectar saltos (cuando hay pérdida de altitud seguida de ganancia rápida)
  private detectJumps(points: GPSPoint[]): JumpEvent[] {
    const jumps: JumpEvent[] = []
    let i = 1

    while (i < points.length - 1) {
      const prevAlt = points[i - 1].altitude
      const currAlt = points[i].altitude
      const nextAlt = points[i + 1].altitude

      if (prevAlt !== null && currAlt !== null && nextAlt !== null) {
        // Detectar patrón de salto: subida rápida + bajada rápida
        const ascent = currAlt - prevAlt
        const descent = nextAlt - currAlt

        if (ascent > 0.5 && descent < -0.5) {
          const duration = (points[i + 1].timestamp.getTime() - points[i - 1].timestamp.getTime()) / 1000
          const height = ascent + Math.abs(descent)
          const distance = haversineDistance(points[i - 1], points[i + 1])
          const landingSpeed = points[i + 1].speed ?? 0

          let severity: 'light' | 'medium' | 'hard' = 'light'
          if (height > 2) severity = 'hard'
          else if (height > 1) severity = 'medium'

          jumps.push({
            startTime: points[i - 1].timestamp,
            endTime: points[i + 1].timestamp,
            duration,
            height,
            distance,
            landingSpeed,
            severity,
          })

          i += 2
          continue
        }
      }

      i++
    }

    return jumps
  }

  // Detectar movimientos bruscos (cambios de dirección > 30 grados)
  private detectSharpMovements(points: GPSPoint[]): SharpMovementEvent[] {
    const movements: SharpMovementEvent[] = []

    for (let i = 2; i < points.length; i++) {
      const bearing1 = calculateBearing(points[i - 2], points[i - 1])
      const bearing2 = calculateBearing(points[i - 1], points[i])

      let angleDiff = Math.abs(bearing2 - bearing1)
      if (angleDiff > 180) angleDiff = 360 - angleDiff

      if (angleDiff > 30) {
        const direction = bearing2 > bearing1 ? 'right' : 'left'
        const speed = points[i].speed ?? 0

        let severity: 'mild' | 'moderate' | 'sharp' = 'mild'
        if (angleDiff > 90) severity = 'sharp'
        else if (angleDiff > 60) severity = 'moderate'

        movements.push({
          timestamp: points[i].timestamp,
          direction,
          angle: angleDiff,
          speed,
          severity,
        })
      }
    }

    return movements
  }

  // Detectar paradas (velocidad < 0.5 m/s por más de 3 segundos)
  private detectStops(points: GPSPoint[]): StopEvent[] {
    const stops: StopEvent[] = []
    let stopStart: number | null = null

    for (let i = 0; i < points.length; i++) {
      const speed = points[i].speed ?? 0

      if (speed < 0.5) {
        if (stopStart === null) {
          stopStart = i
        } else {
          const duration = (points[i].timestamp.getTime() - points[stopStart].timestamp.getTime()) / 1000
          if (duration >= 3) {
            stops.push({
              startTime: points[stopStart].timestamp,
              endTime: points[i].timestamp,
              duration,
              location: {
                latitude: points[stopStart].latitude,
                longitude: points[stopStart].longitude,
              },
            })
          }
        }
      } else {
        stopStart = null
      }
    }

    return stops
  }

  // Detectar frenadas bruscas (deceleración > 3 m/s²)
  private detectHardBrakes(points: GPSPoint[]): HardBrakeEvent[] {
    const brakes: HardBrakeEvent[] = []

    for (let i = 1; i < points.length; i++) {
      const speedBefore = points[i - 1].speed ?? 0
      const speedAfter = points[i].speed ?? 0
      const timeDiff = (points[i].timestamp.getTime() - points[i - 1].timestamp.getTime()) / 1000

      if (timeDiff > 0 && speedBefore > speedAfter) {
        const deceleration = (speedBefore - speedAfter) / timeDiff

        if (deceleration > 3) {
          let severity: 'moderate' | 'hard' | 'extreme' = 'moderate'
          if (deceleration > 6) severity = 'extreme'
          else if (deceleration > 4.5) severity = 'hard'

          brakes.push({
            timestamp: points[i].timestamp,
            speedBefore,
            speedAfter,
            deceleration,
            severity,
          })
        }
      }
    }

    return brakes
  }

  // Detectar aceleraciones (aceleración > 2 m/s²)
  private detectAccelerations(points: GPSPoint[]): AccelerationEvent[] {
    const accelerations: AccelerationEvent[] = []

    for (let i = 1; i < points.length; i++) {
      const speedBefore = points[i - 1].speed ?? 0
      const speedAfter = points[i].speed ?? 0
      const timeDiff = (points[i].timestamp.getTime() - points[i - 1].timestamp.getTime()) / 1000

      if (timeDiff > 0 && speedAfter > speedBefore) {
        const acceleration = (speedAfter - speedBefore) / timeDiff

        if (acceleration > 2) {
          accelerations.push({
            timestamp: points[i].timestamp,
            speedBefore,
            speedAfter,
            acceleration,
            duration: timeDiff,
          })
        }
      }
    }

    return accelerations
  }

  // Calcular segmentos de la ruta
  private calculateSegments(points: GPSPoint[], segmentLength: number = 100): Segment[] {
    const segments: Segment[] = []
    let currentDistance = 0
    let segmentStart = 0
    let segmentId = 1

    for (let i = 1; i < points.length; i++) {
      const distance = haversineDistance(points[i - 1], points[i])
      currentDistance += distance

      if (currentDistance >= segmentLength || i === points.length - 1) {
        const segmentPoints = points.slice(segmentStart, i + 1)
        const segmentTime = (points[i].timestamp.getTime() - points[segmentStart].timestamp.getTime()) / 1000
        const segmentSpeeds = segmentPoints.map(p => p.speed ?? 0).filter(s => s > 0)

        let elevationChange = 0
        for (let j = 1; j < segmentPoints.length; j++) {
          const prevAlt = segmentPoints[j - 1].altitude
          const currAlt = segmentPoints[j].altitude
          if (prevAlt !== null && currAlt !== null) {
            elevationChange += currAlt - prevAlt
          }
        }

        const avgSpeed = segmentSpeeds.length > 0
          ? segmentSpeeds.reduce((a, b) => a + b, 0) / segmentSpeeds.length
          : 0
        const maxSpeed = segmentSpeeds.length > 0 ? Math.max(...segmentSpeeds) : 0

        let type: 'uphill' | 'downhill' | 'flat' | 'technical' = 'flat'
        if (elevationChange > 5) type = 'uphill'
        else if (elevationChange < -5) type = 'downhill'
        else if (segmentSpeeds.length > 0 && avgSpeed < 2) type = 'technical'

        segments.push({
          id: segmentId++,
          startDistance: currentDistance - distance,
          endDistance: currentDistance,
          distance: currentDistance - (currentDistance - distance),
          time: segmentTime,
          avgSpeed,
          maxSpeed,
          elevationChange,
          type,
        })

        segmentStart = i
        currentDistance = 0
      }
    }

    return segments
  }

  // Calcular score de ritmo (qué tan constante fue)
  private calculateRhythmScore(points: GPSPoint[], speeds: number[]): number {
    if (speeds.length < 2) return 50

    // Calcular coeficiente de variación (menor = más constante)
    const avg = speeds.reduce((a, b) => a + b, 0) / speeds.length
    const variance = speeds.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / speeds.length
    const stdDev = Math.sqrt(variance)
    const cv = avg > 0 ? (stdDev / avg) * 100 : 100

    // Convertir a score 0-100 (menor CV = mayor score)
    return Math.max(0, Math.min(100, Math.round(100 - cv)))
  }

  // Calcular score de intensidad
  private calculateIntensityScore(speeds: number[], elevationGain: number, totalDistance: number): number {
    if (speeds.length === 0) return 0

    const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length
    const maxSpeed = Math.max(...speeds)

    // Velocidad promedio (0-20 m/s = 0-72 km/h)
    const speedScore = Math.min(100, (avgSpeed / 15) * 100)

    // Elevación por distancia (m/m)
    const elevationIntensity = totalDistance > 0 ? (elevationGain / totalDistance) * 100 : 0
    const elevationScore = Math.min(100, elevationIntensity * 10)

    return Math.round(speedScore * 0.6 + elevationScore * 0.4)
  }

  // Calcular score de agresividad
  private calculateAggressionScore(
    jumps: JumpEvent[],
    sharpMovements: SharpMovementEvent[],
    hardBrakes: HardBrakeEvent[]
  ): number {
    // Puntos por saltos
    const jumpScore = jumps.reduce((sum, jump) => {
      const severityMultiplier = jump.severity === 'hard' ? 3 : jump.severity === 'medium' ? 2 : 1
      return sum + severityMultiplier * 5
    }, 0)

    // Puntos por movimientos bruscos
    const sharpScore = sharpMovements.reduce((sum, mov) => {
      const severityMultiplier = mov.severity === 'sharp' ? 3 : mov.severity === 'moderate' ? 2 : 1
      return sum + severityMultiplier * 2
    }, 0)

    // Puntos por frenadas
    const brakeScore = hardBrakes.reduce((sum, brake) => {
      const severityMultiplier = brake.severity === 'extreme' ? 3 : brake.severity === 'hard' ? 2 : 1
      return sum + severityMultiplier * 3
    }, 0)

    const totalScore = jumpScore + sharpScore + brakeScore
    return Math.min(100, Math.round(totalScore))
  }

  // Formatear tiempo para display
  static formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 100)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
  }

  // Formatear velocidad para display
  static formatSpeed(ms: number): string {
    const kmh = ms * 3.6
    return `${kmh.toFixed(1)} km/h`
  }
}
