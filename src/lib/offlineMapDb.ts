/**
 * IndexedDB compartida: regiones de teselas offline + geometría OSM cacheada.
 * Atribución datos OSM: © colaboradores de OpenStreetMap, ODbL.
 */

export const OFFLINE_MAP_DB_NAME = 'guarddh-offline-map'
export const OFFLINE_MAP_DB_VERSION = 2

export const REGION_STORE = 'regions'
export const OSM_WAYS_STORE = 'osmWays'

export function openOfflineMapDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OFFLINE_MAP_DB_NAME, OFFLINE_MAP_DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(REGION_STORE)) {
        const st = db.createObjectStore(REGION_STORE, { keyPath: 'id' })
        st.createIndex('createdAt', 'createdAt')
      }
      if (!db.objectStoreNames.contains(OSM_WAYS_STORE)) {
        const st = db.createObjectStore(OSM_WAYS_STORE, { keyPath: 'id' })
        st.createIndex('createdAt', 'createdAt')
        st.createIndex('minLat', 'minLat')
        st.createIndex('maxLat', 'maxLat')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('No se pudo abrir IndexedDB'))
  })
}
