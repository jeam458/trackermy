/**
 * Servicio de almacenamiento offline para datos GPS
 * Usa IndexedDB para persistir sesiones de tracking y puntos GPS
 */

export interface OfflineTrackPoint {
  id?: number
  sessionId: string
  latitude: number
  longitude: number
  altitude: number | null
  accuracy: number | null
  speed: number
  heading: number | null
  timestamp: string // ISO string
  orderIndex: number
  synced: boolean
  createdAt: string
}

export interface OfflineSession {
  id: string
  userId: string | null
  name: string | null
  description: string | null
  difficulty: string | null
  isPublic: boolean
  startPoint: string // JSON de coordenadas
  endPoint: string | null // JSON de coordenadas
  status: 'in-progress' | 'completed' | 'synced' | 'failed'
  syncAttempts: number
  lastSyncAttempt: string | null
  createdAt: string
  updatedAt: string
  metadata: string | null // JSON adicional
}

export interface OfflineStats {
  totalSessions: number
  pendingSync: number
  syncedSessions: number
  failedSync: number
  totalPoints: number
  storageUsed: number // bytes aproximados
}

const DB_NAME = 'BikeTrackerOfflineDB'
const DB_VERSION = 1
const STORE_SESSIONS = 'sessions'
const STORE_POINTS = 'trackPoints'

class IndexedDBService {
  private db: IDBDatabase | null = null
  private initPromise: Promise<IDBDatabase> | null = null

  // Inicializar base de datos
  async init(): Promise<IDBDatabase> {
    if (this.db) return this.db
    if (this.initPromise) return this.initPromise

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        console.error('Error abriendo IndexedDB:', request.error)
        reject(new Error('No se pudo abrir IndexedDB'))
      }

      request.onsuccess = () => {
        this.db = request.result
        resolve(request.result)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Store de sesiones
        if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
          const sessionsStore = db.createObjectStore(STORE_SESSIONS, {
            keyPath: 'id',
          })
          sessionsStore.createIndex('status', 'status', { unique: false })
          sessionsStore.createIndex('userId', 'userId', { unique: false })
          sessionsStore.createIndex('createdAt', 'createdAt', { unique: false })
          sessionsStore.createIndex('syncAttempts', 'syncAttempts', { unique: false })
        }

        // Store de puntos
        if (!db.objectStoreNames.contains(STORE_POINTS)) {
          const pointsStore = db.createObjectStore(STORE_POINTS, {
            keyPath: 'id',
            autoIncrement: true,
          })
          pointsStore.createIndex('sessionId', 'sessionId', { unique: false })
          pointsStore.createIndex('synced', 'synced', { unique: false })
          pointsStore.createIndex('orderIndex', 'orderIndex', { unique: false })
          pointsStore.createIndex('timestamp', 'timestamp', { unique: false })
          // Índice compuesto para buscar puntos de sesión ordenados
          pointsStore.createIndex('sessionOrder', ['sessionId', 'orderIndex'], {
            unique: false,
          })
        }
      }
    })

    this.db = await this.initPromise
    return this.db
  }

  // Verificar si IndexedDB está disponible
  isAvailable(): boolean {
    return typeof indexedDB !== 'undefined'
  }

  // ==================== SESIONES ====================

  // Guardar sesión
  async saveSession(session: OfflineSession): Promise<void> {
    const db = await this.init()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_SESSIONS, 'readwrite')
      const store = transaction.objectStore(STORE_SESSIONS)
      const request = store.put(session)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  // Obtener sesión por ID
  async getSession(id: string): Promise<OfflineSession | null> {
    const db = await this.init()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_SESSIONS, 'readonly')
      const store = transaction.objectStore(STORE_SESSIONS)
      const request = store.get(id)

      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  // Obtener todas las sesiones
  async getAllSessions(): Promise<OfflineSession[]> {
    const db = await this.init()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_SESSIONS, 'readonly')
      const store = transaction.objectStore(STORE_SESSIONS)
      const request = store.getAll()

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  // Obtener sesiones pendientes de sincronización
  async getPendingSessions(): Promise<OfflineSession[]> {
    const db = await this.init()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_SESSIONS, 'readonly')
      const store = transaction.objectStore(STORE_SESSIONS)
      const index = store.index('status')
      const request = index.getAll('completed')

      request.onsuccess = () => {
        // Filtrar también las que tienen status 'in-progress'
        const inProgressTransaction = db.transaction(STORE_SESSIONS, 'readonly')
        const inProgressStore = inProgressTransaction.objectStore(STORE_SESSIONS)
        const inProgressIndex = inProgressStore.index('status')
        const inProgressRequest = inProgressIndex.getAll('in-progress')

        inProgressRequest.onsuccess = () => {
          resolve([...request.result, ...inProgressRequest.result])
        }
        inProgressRequest.onerror = () => reject(inProgressRequest.error)
      }
      request.onerror = () => reject(request.error)
    })
  }

  // Actualizar estado de sesión
  async updateSessionStatus(
    id: string,
    status: OfflineSession['status'],
    syncAttempt: Date | null = null
  ): Promise<void> {
    const session = await this.getSession(id)
    if (!session) {
      throw new Error(`Sesión no encontrada: ${id}`)
    }

    session.status = status
    session.updatedAt = new Date().toISOString()
    
    if (syncAttempt) {
      session.lastSyncAttempt = syncAttempt.toISOString()
      session.syncAttempts += 1
    }

    await this.saveSession(session)
  }

  // Eliminar sesión
  async deleteSession(id: string): Promise<void> {
    const db = await this.init()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_SESSIONS, STORE_POINTS], 'readwrite')
      
      // Eliminar puntos asociados
      const pointsStore = transaction.objectStore(STORE_POINTS)
      const index = pointsStore.index('sessionId')
      const request = index.openCursor(IDBKeyRange.only(id))

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        }
      }

      // Eliminar sesión
      const sessionsStore = transaction.objectStore(STORE_SESSIONS)
      sessionsStore.delete(id)

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  // ==================== PUNTOS GPS ====================

  // Guardar punto GPS
  async savePoint(point: Omit<OfflineTrackPoint, 'id' | 'createdAt'>): Promise<number> {
    const db = await this.init()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_POINTS, 'readwrite')
      const store = transaction.objectStore(STORE_POINTS)
      
      const pointWithDefaults = {
        ...point,
        createdAt: new Date().toISOString(),
      }
      
      const request = store.add(pointWithDefaults)

      request.onsuccess = () => resolve(request.result as number)
      request.onerror = () => reject(request.error)
    })
  }

  // Guardar múltiples puntos en batch
  async savePointsBatch(
    points: Omit<OfflineTrackPoint, 'id' | 'createdAt'>[]
  ): Promise<void> {
    if (points.length === 0) return

    const db = await this.init()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_POINTS, 'readwrite')
      const store = transaction.objectStore(STORE_POINTS)

      points.forEach((point) => {
        store.add({
          ...point,
          createdAt: new Date().toISOString(),
        })
      })

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  // Obtener puntos de una sesión ordenados
  async getSessionPoints(sessionId: string): Promise<OfflineTrackPoint[]> {
    const db = await this.init()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_POINTS, 'readonly')
      const store = transaction.objectStore(STORE_POINTS)
      const index = store.index('sessionId')
      const request = index.getAll(IDBKeyRange.only(sessionId))

      request.onsuccess = () => {
        // Ordenar por orderIndex
        const points = request.result || []
        points.sort((a, b) => a.orderIndex - b.orderIndex)
        resolve(points)
      }
      request.onerror = () => reject(request.error)
    })
  }

  // Obtener puntos pendientes de sincronización
  async getPendingPoints(): Promise<OfflineTrackPoint[]> {
    const db = await this.init()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_POINTS, 'readonly')
      const store = transaction.objectStore(STORE_POINTS)
      const index = store.index('synced')
      const request = index.getAll(IDBKeyRange.only(false))

      request.onsuccess = () => {
        const points = request.result || []
        points.sort((a, b) => a.orderIndex - b.orderIndex)
        resolve(points)
      }
      request.onerror = () => reject(request.error)
    })
  }

  // Marcar puntos como sincronizados
  async markPointsAsSynced(pointIds: number[]): Promise<void> {
    if (pointIds.length === 0) return

    const db = await this.init()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_POINTS, 'readwrite')
      const store = transaction.objectStore(STORE_POINTS)

      pointIds.forEach((id) => {
        const request = store.get(id)
        request.onsuccess = () => {
          const point = request.result
          if (point) {
            point.synced = true
            store.put(point)
          }
        }
      })

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  // Marcar todos los puntos de una sesión como sincronizados
  async markSessionPointsAsSynced(sessionId: string): Promise<void> {
    const points = await this.getSessionPoints(sessionId)
    const ids = points.map((p) => p.id!).filter((id): id is number => id !== undefined)
    await this.markPointsAsSynced(ids)
  }

  // Contar puntos de una sesión
  async getSessionPointsCount(sessionId: string): Promise<number> {
    const db = await this.init()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_POINTS, 'readonly')
      const store = transaction.objectStore(STORE_POINTS)
      const index = store.index('sessionId')
      const request = index.count(IDBKeyRange.only(sessionId))

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  // ==================== ESTADÍSTICAS ====================

  // Obtener estadísticas de almacenamiento
  async getStats(): Promise<OfflineStats> {
    const sessions = await this.getAllSessions()
    const pendingPoints = await this.getPendingPoints()

    const pendingSync = sessions.filter(
      (s) => s.status === 'completed' || s.status === 'in-progress'
    ).length
    const synced = sessions.filter((s) => s.status === 'synced').length
    const failed = sessions.filter((s) => s.status === 'failed').length

    // Calcular uso aproximado de almacenamiento
    const storageUsed = this.estimateStorageUsage(sessions, pendingPoints)

    return {
      totalSessions: sessions.length,
      pendingSync: pendingSync,
      syncedSessions: synced,
      failedSync: failed,
      totalPoints: pendingPoints.length,
      storageUsed,
    }
  }

  // Estimar uso de almacenamiento (bytes)
  private estimateStorageUsage(
    sessions: OfflineSession[],
    points: OfflineTrackPoint[]
  ): number {
    let total = 0

    sessions.forEach((s) => {
      total += JSON.stringify(s).length * 2 // UTF-16
    })

    points.forEach((p) => {
      total += JSON.stringify(p).length * 2
    })

    return total
  }

  // ==================== LIMPIEZA ====================

  // Limpiar sesiones antiguas sincronizadas
  async cleanupOldSessions(daysOld: number = 7): Promise<number> {
    const sessions = await this.getAllSessions()
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    let deleted = 0

    for (const session of sessions) {
      if (
        session.status === 'synced' &&
        new Date(session.updatedAt) < cutoffDate
      ) {
        await this.deleteSession(session.id)
        deleted++
      }
    }

    return deleted
  }

  // Limpiar toda la base de datos
  async clearAll(): Promise<void> {
    const db = await this.init()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_SESSIONS, STORE_POINTS], 'readwrite')
      const sessionsStore = transaction.objectStore(STORE_SESSIONS)
      const pointsStore = transaction.objectStore(STORE_POINTS)

      sessionsStore.clear()
      pointsStore.clear()

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  // Cerrar conexión
  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
      this.initPromise = null
    }
  }
}

// Singleton
export const indexedDBService = new IndexedDBService()
