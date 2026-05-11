/**
 * Gestor de sincronización para modo offline/online
 * Detecta cambios de conectividad y sincroniza automáticamente
 */

import { indexedDBService, OfflineSession, OfflineTrackPoint } from './IndexedDBService'
import { createClient } from '@/core/infrastructure/supabase/client'
import { RouteCreationRequest } from '@/core/domain/Route'
import { SupabaseRouteRepository } from '@/core/infrastructure/repositories/SupabaseRouteRepository'
import { GPSTrackProcessingService } from '@/core/application/CreateRouteUseCase'
import type { PerformanceMetrics } from '@/services/RoutePerformanceService'

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'waiting'

export interface SyncState {
  isOnline: boolean
  syncStatus: SyncStatus
  lastSyncTime: Date | null
  pendingSessions: number
  pendingPoints: number
  error: string | null
}

export interface SyncCallbacks {
  onStateChange?: (state: SyncState) => void
  onSyncProgress?: (current: number, total: number) => void
  onSyncComplete?: (syncedCount: number) => void
  onSyncError?: (error: Error) => void
}

// Generar ID único
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

class SyncManager {
  private state: SyncState = {
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    syncStatus: 'idle',
    lastSyncTime: null,
    pendingSessions: 0,
    pendingPoints: 0,
    error: null,
  }

  private callbacks: SyncCallbacks = {}
  private syncInterval: NodeJS.Timeout | null = null
  private isSyncing = false
  private connectivityListenersAttached = false
  private routeRepository = new SupabaseRouteRepository()
  private processingService = new GPSTrackProcessingService()

  // Inicializar gestor de sincronización
  init(callbacks: SyncCallbacks = {}): void {
    this.callbacks = { ...this.callbacks, ...callbacks }

    if (typeof window === 'undefined') return

    if (!this.connectivityListenersAttached) {
      this.connectivityListenersAttached = true
      window.addEventListener('online', this.handleOnline)
      window.addEventListener('offline', this.handleOffline)
      this.updateState({ isOnline: navigator.onLine })
      if (this.state.isOnline) {
        void this.syncPendingData()
      }
      this.startAutoRetry()
    } else if (this.state.isOnline) {
      void this.syncPendingData()
    }
  }

  // Limpiar listeners (solo tests o cierre total de app; no llamar al salir de una pantalla)
  destroy(): void {
    if (typeof window !== 'undefined' && this.connectivityListenersAttached) {
      window.removeEventListener('online', this.handleOnline)
      window.removeEventListener('offline', this.handleOffline)
      this.connectivityListenersAttached = false
    }

    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
  }

  // Obtener estado actual
  getState(): SyncState {
    return { ...this.state }
  }

  // Verificar si está online
  isOnline(): boolean {
    return this.state.isOnline
  }

  // Verificar si hay datos pendientes
  async hasPendingData(): Promise<boolean> {
    const pendingSessions = await indexedDBService.getPendingSessions()
    return pendingSessions.length > 0
  }

  // Obtener cantidad de datos pendientes
  async getPendingCount(): Promise<{ sessions: number; points: number }> {
    const pendingSessions = await indexedDBService.getPendingSessions()
    const pendingPoints = await indexedDBService.getPendingPoints()

    return {
      sessions: pendingSessions.length,
      points: pendingPoints.length,
    }
  }

  // Forzar sincronización manual
  async forceSync(): Promise<boolean> {
    if (this.isSyncing) {
      console.log('Sincronización ya en progreso')
      return false
    }

    if (!this.state.isOnline) {
      this.updateState({
        error: 'Sin conexión a internet',
        syncStatus: 'waiting',
      })
      return false
    }

    return await this.syncPendingData()
  }

  // Sincronizar datos pendientes
  private async syncPendingData(): Promise<boolean> {
    if (this.isSyncing) return false

    const pendingSessions = await indexedDBService.getPendingSessions()

    if (pendingSessions.length === 0) {
      this.updateState({
        syncStatus: 'idle',
        error: null,
      })
      return false
    }

    this.isSyncing = true
    this.updateState({
      syncStatus: 'syncing',
      error: null,
      pendingSessions: pendingSessions.length,
    })

    let syncedCount = 0
    let failedCount = 0

    try {
      // Verificar autenticación
      const supabase = createClient()
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        throw new Error('Usuario no autenticado. Inicia sesión para sincronizar.')
      }

      this.callbacks.onSyncProgress?.(0, pendingSessions.length)

      // Sincronizar cada sesión
      for (let i = 0; i < pendingSessions.length; i++) {
        const session = pendingSessions[i]

        try {
          await this.syncSingleSession(session, user.id)
          syncedCount++

          this.callbacks.onSyncProgress?.(i + 1, pendingSessions.length)
        } catch (error) {
          console.error(`Error sincronizando sesión ${session.id}:`, error)
          failedCount++

          // Marcar como fallida
          await indexedDBService.updateSessionStatus(session.id, 'failed', new Date())
        }
      }

      this.updateState({
        syncStatus: syncedCount > 0 ? 'success' : 'error',
        lastSyncTime: new Date(),
        pendingSessions: pendingSessions.length - syncedCount,
        error: failedCount > 0 ? `${failedCount} sesiones fallaron` : null,
      })

      this.callbacks.onSyncComplete?.(syncedCount)

      return syncedCount > 0
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error desconocido en sincronización'

      this.updateState({
        syncStatus: 'error',
        error: errorMessage,
      })

      this.callbacks.onSyncError?.(
        error instanceof Error ? error : new Error(errorMessage)
      )

      return false
    } finally {
      this.isSyncing = false
    }
  }

  /**
   * Encola un intento de ruta (cronómetro) en IndexedDB para subirlo cuando haya red.
   */
  async queueRouteAttemptOffline(params: {
    userId: string
    routeId: string
    routeName?: string
    performance: PerformanceMetrics
    gpsPoints: Array<{
      latitude: number
      longitude: number
      altitude: number | null
      speed: number | null
      timestamp: Date
      accuracy?: number
    }>
  }): Promise<void> {
    if (params.gpsPoints.length < 2) {
      throw new Error('Se requieren al menos 2 puntos GPS')
    }

    const sessionId = `attempt-${generateId()}`
    const first = params.gpsPoints[0]!
    const last = params.gpsPoints[params.gpsPoints.length - 1]!

    await indexedDBService.saveSession({
      id: sessionId,
      userId: params.userId,
      name: params.routeName || `Intento ${new Date().toLocaleDateString()}`,
      description: null,
      difficulty: null,
      isPublic: true,
      startPoint: JSON.stringify({ latitude: first.latitude, longitude: first.longitude }),
      endPoint: JSON.stringify({ latitude: last.latitude, longitude: last.longitude }),
      status: 'completed',
      syncAttempts: 0,
      lastSyncAttempt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: JSON.stringify({
        type: 'route-attempt',
        routeId: params.routeId,
        routeName: params.routeName,
        performance: params.performance,
      }),
    })

    const pointsToSave: Omit<OfflineTrackPoint, 'id' | 'createdAt'>[] = params.gpsPoints.map(
      (p, index) => ({
        sessionId,
        latitude: p.latitude,
        longitude: p.longitude,
        altitude: p.altitude ?? null,
        accuracy: p.accuracy ?? null,
        speed: p.speed ?? 0,
        heading: null,
        timestamp: p.timestamp.toISOString(),
        orderIndex: index,
        synced: false,
      })
    )

    await indexedDBService.savePointsBatch(pointsToSave)

    const pending = await this.getPendingCount()
    this.updateState({
      pendingSessions: pending.sessions,
      pendingPoints: pending.points,
    })

    if (typeof navigator !== 'undefined' && navigator.onLine && !this.isSyncing) {
      void this.syncPendingData()
    }
  }

  private async syncRouteAttemptSession(
    session: OfflineSession,
    userId: string,
    routeId: string,
    performance: PerformanceMetrics
  ): Promise<void> {
    const offlinePoints = await indexedDBService.getSessionPoints(session.id)
    if (offlinePoints.length < 2) {
      throw new Error('Intento offline sin puntos GPS suficientes')
    }

    const supabase = createClient()
    const gps_points = offlinePoints.map((p) => ({
      latitude: p.latitude,
      longitude: p.longitude,
      altitude: p.altitude,
      speed: p.speed,
      timestamp:
        typeof p.timestamp === 'string' ? p.timestamp : new Date(p.timestamp).toISOString(),
    }))

    const { error } = await supabase.from('route_attempts').insert({
      route_id: routeId,
      user_id: userId,
      total_time: performance.totalTime,
      moving_time: performance.movingTime,
      stopped_time: performance.stoppedTime,
      max_speed: performance.maxSpeed,
      avg_speed: performance.avgSpeed,
      distance: performance.totalDistance,
      elevation_gain: performance.elevationGain,
      elevation_loss: performance.elevationLoss,
      jumps_count: performance.jumps?.length ?? 0,
      sharp_movements_count: performance.sharpMovements?.length ?? 0,
      hard_brakes_count: performance.hardBrakes?.length ?? 0,
      stops_count: performance.stops?.length ?? 0,
      rhythm_score: performance.rhythmScore,
      intensity_score: performance.intensityScore,
      aggression_score: performance.aggressionScore,
      overall_score: performance.overallScore,
      gps_points,
      is_public: true,
      completed_at: new Date().toISOString(),
    })

    if (error) {
      throw new Error(error.message)
    }

    await indexedDBService.updateSessionStatus(session.id, 'synced', new Date())
    await indexedDBService.markSessionPointsAsSynced(session.id)
  }

  // Sincronizar una sesión individual
  private async syncSingleSession(
    session: OfflineSession,
    userId: string
  ): Promise<void> {
    let meta: {
      type?: string
      routeId?: string
      performance?: PerformanceMetrics
    } = {}
    try {
      if (session.metadata) {
        meta = JSON.parse(session.metadata) as typeof meta
      }
    } catch {
      meta = {}
    }

    if (meta.type === 'route-attempt' && meta.routeId && meta.performance) {
      await this.syncRouteAttemptSession(session, userId, meta.routeId, meta.performance)
      return
    }

    // Obtener puntos de la sesión
    const offlinePoints = await indexedDBService.getSessionPoints(session.id)

    if (offlinePoints.length === 0) {
      throw new Error('No hay puntos GPS en la sesión')
    }

    // Convertir puntos offline a formato de procesamiento
    const gpsPoints = offlinePoints.map((p) => ({
      latitude: p.latitude,
      longitude: p.longitude,
      altitude: p.altitude ?? undefined,
      accuracy: p.accuracy ?? undefined,
      timestamp: new Date(p.timestamp),
      speed: p.speed,
      heading: p.heading,
    }))

    // Procesar puntos con filtros GPS (sin snap a carretera por defecto; trocha/DH como al guardar en app)
    const processedTrack = this.processingService.processTrack(gpsPoints)

    // Parsear coordenadas
    const startPoint = JSON.parse(session.startPoint)
    const endPoint = session.endPoint ? JSON.parse(session.endPoint) : null

    if (!endPoint) {
      throw new Error('Punto de llegada no definido')
    }

    // Preparar request para Supabase
    const routeData: RouteCreationRequest = {
      name: session.name || `Ruta offline ${new Date(session.createdAt).toLocaleDateString()}`,
      description: session.description || 'Grabada sin conexión',
      difficulty: (session.difficulty as any) || 'Intermediate',
      trackType: 'trail',
      startCoord: [startPoint.latitude, startPoint.longitude],
      endCoord: [endPoint.latitude, endPoint.longitude],
      trackPoints: processedTrack.points.map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
        altitude: p.altitude,
        accuracy: p.accuracy,
      })),
      isPublic: session.isPublic,
    }

    // Guardar en Supabase
    const route = await this.routeRepository.createRoute(routeData, userId)

    // Marcar como sincronizada
    await indexedDBService.updateSessionStatus(session.id, 'synced', new Date())
    await indexedDBService.markSessionPointsAsSynced(session.id)

    console.log(`Sesión ${session.id} sincronizada exitosamente como ruta ${route.id}`)
  }

  // Guardar sesión offline para sincronizar después
  async saveOfflineSession(data: {
    name?: string
    description?: string
    difficulty?: string
    isPublic?: boolean
    startPoint: any
    endPoint: any
    points: any[]
    userId?: string
  }): Promise<string> {
    const sessionId = generateId()
    const now = new Date().toISOString()

    const session: OfflineSession = {
      id: sessionId,
      userId: data.userId || null,
      name: data.name || null,
      description: data.description || null,
      difficulty: data.difficulty || null,
      isPublic: data.isPublic ?? true,
      startPoint: JSON.stringify(data.startPoint),
      endPoint: data.endPoint ? JSON.stringify(data.endPoint) : null,
      status: 'completed',
      syncAttempts: 0,
      lastSyncAttempt: null,
      createdAt: now,
      updatedAt: now,
      metadata: null,
    }

    await indexedDBService.saveSession(session)

    // Guardar puntos
    const pointsToSave = data.points.map((p: any, index: number) => ({
      sessionId,
      latitude: p.latitude,
      longitude: p.longitude,
      altitude: p.altitude ?? null,
      accuracy: p.accuracy ?? null,
      speed: p.speed ?? 0,
      heading: p.heading ?? null,
      timestamp: p.timestamp instanceof Date ? p.timestamp.toISOString() : p.timestamp,
      orderIndex: index,
      synced: false,
    }))

    await indexedDBService.savePointsBatch(pointsToSave)

    // Actualizar contador
    const pending = await this.getPendingCount()
    this.updateState({
      pendingSessions: pending.sessions,
      pendingPoints: pending.points,
    })

    // Si está online, intentar sincronizar inmediatamente
    if (this.state.isOnline && !this.isSyncing) {
      this.syncPendingData()
    }

    return sessionId
  }

  // Manejar cambio a online
  private handleOnline = async () => {
    console.log('✅ Conexión restaurada')

    this.updateState({
      isOnline: true,
      error: null,
    })

    // Intentar sincronizar automáticamente
    await this.syncPendingData()
  }

  // Manejar cambio a offline
  private handleOffline = () => {
    console.log('❌ Sin conexión')

    this.updateState({
      isOnline: false,
      syncStatus: 'waiting',
      error: 'Sin conexión a internet. Los datos se guardarán localmente.',
    })
  }

  // Iniciar reintentos automáticos
  private startAutoRetry(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
    }

    this.syncInterval = setInterval(async () => {
      if (this.state.isOnline && !this.isSyncing) {
        const pending = await this.getPendingCount()
        if (pending.sessions > 0) {
          console.log('Reintento automático de sincronización...')
          this.syncPendingData()
        }
      }
    }, 30000) // Cada 30 segundos
  }

  // Actualizar estado y notificar
  private updateState(updates: Partial<SyncState>): void {
    this.state = { ...this.state, ...updates }
    this.callbacks.onStateChange?.(this.state)
  }
}

// Singleton
export const syncManager = new SyncManager()
