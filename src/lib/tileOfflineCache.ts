import { openOfflineMapDb, REGION_STORE } from '@/lib/offlineMapDb'
import { cacheOsmWaysForTileRegion } from '@/lib/osmWaysOfflineCache'

export type TileRegion = {
  id: string
  name: string
  createdAt: string
  minZoom: number
  maxZoom: number
  minLat: number
  minLng: number
  maxLat: number
  maxLng: number
  tileCount: number
}

type DownloadTileRegionInput = {
  name: string
  minZoom: number
  maxZoom: number
  minLat: number
  minLng: number
  maxLat: number
  maxLng: number
  onProgress?: (done: number, total: number) => void
  /**
   * Si true (por defecto), tras guardar la región intenta descargar vías OSM
   * (motor + trail) para map-matching offline en la misma bbox.
   */
  includeOsmWays?: boolean
}

const TILE_CACHE_NAME = 'offline-map-tiles'
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

function clampLat(lat: number) {
  return Math.max(-85.05112878, Math.min(85.05112878, lat))
}

function wrapLon(lon: number) {
  let x = lon
  while (x < -180) x += 360
  while (x > 180) x -= 360
  return x
}

function lon2tileX(lon: number, z: number) {
  return Math.floor(((wrapLon(lon) + 180) / 360) * Math.pow(2, z))
}

function lat2tileY(lat: number, z: number) {
  const l = clampLat(lat)
  const rad = (l * Math.PI) / 180
  const n = Math.pow(2, z)
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n)
}

function tileUrl(z: number, x: number, y: number) {
  return TILE_URL.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y))
}

async function saveRegion(region: TileRegion): Promise<void> {
  const db = await openOfflineMapDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(REGION_STORE, 'readwrite')
    tx.objectStore(REGION_STORE).put(region)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('No se pudo guardar región'))
  })
  db.close()
}

export async function listOfflineTileRegions(): Promise<TileRegion[]> {
  const db = await openOfflineMapDb()
  const rows = await new Promise<TileRegion[]>((resolve, reject) => {
    const tx = db.transaction(REGION_STORE, 'readonly')
    const req = tx.objectStore(REGION_STORE).getAll()
    req.onsuccess = () => resolve((req.result as TileRegion[]) ?? [])
    req.onerror = () => reject(req.error ?? new Error('No se pudo leer regiones'))
  })
  db.close()
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function downloadTileRegion(input: DownloadTileRegionInput): Promise<TileRegion> {
  const includeOsm = input.includeOsmWays !== false
  const { minLat, minLng, maxLat, maxLng } = input
  const minZoom = Math.max(3, Math.min(19, input.minZoom))
  const maxZoom = Math.max(minZoom, Math.min(19, input.maxZoom))

  const all: Array<{ z: number; x: number; y: number }> = []
  for (let z = minZoom; z <= maxZoom; z++) {
    const maxIdx = Math.pow(2, z) - 1
    const xMin = Math.max(0, Math.min(maxIdx, lon2tileX(minLng, z)))
    const xMax = Math.max(0, Math.min(maxIdx, lon2tileX(maxLng, z)))
    const yMin = Math.max(0, Math.min(maxIdx, lat2tileY(maxLat, z)))
    const yMax = Math.max(0, Math.min(maxIdx, lat2tileY(minLat, z)))

    for (let x = Math.min(xMin, xMax); x <= Math.max(xMin, xMax); x++) {
      for (let y = Math.min(yMin, yMax); y <= Math.max(yMin, yMax); y++) {
        all.push({ z, x, y })
      }
    }
  }

  const cache = await caches.open(TILE_CACHE_NAME)
  const concurrency = 8
  let done = 0
  let cursor = 0

  async function worker() {
    while (cursor < all.length) {
      const idx = cursor++
      const t = all[idx]!
      const url = tileUrl(t.z, t.x, t.y)
      try {
        const req = new Request(url, { mode: 'cors', credentials: 'omit' })
        const res = await fetch(req)
        if (res.ok) await cache.put(req, res.clone())
      } catch {
        // Ignorar fallos puntuales de tiles
      } finally {
        done += 1
        input.onProgress?.(done, all.length)
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))

  const region: TileRegion = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: input.name.trim() || 'Zona offline',
    createdAt: new Date().toISOString(),
    minZoom,
    maxZoom,
    minLat,
    minLng,
    maxLat,
    maxLng,
    tileCount: all.length,
  }
  await saveRegion(region)

  if (includeOsm) {
    try {
      await cacheOsmWaysForTileRegion(region)
    } catch {
      // Sin red u Overpass saturado: las teselas siguen válidas
    }
  }

  return region
}
