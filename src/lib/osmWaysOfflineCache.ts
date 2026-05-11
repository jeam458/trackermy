/**
 * Cache IndexedDB de geometría OSM (motor + trail) alineada con regiones de teselas offline.
 * Atribución: © colaboradores de OpenStreetMap, ODbL.
 */

import { openOfflineMapDb, OSM_WAYS_STORE } from '@/lib/offlineMapDb'
import { closestPointOnSegmentMeters, type MapPathNode } from '@/lib/pathMapMatch'

const DEFAULT_OVERPASS = 'https://overpass-api.de/api/interpreter'
/** Misma tolerancia que osmTrackSnap para no partir vías en el borde. */
const BBOX_PAD_DEG = 0.003
const MAX_SINGLE_QUERY_SPAN_DEG = 0.052

export type TileRegionLike = {
  id: string
  name: string
  minLat: number
  minLng: number
  maxLat: number
  maxLng: number
  createdAt?: string
}

export type OsmTaggedSegment = {
  a: MapPathNode
  b: MapPathNode
  highway?: string
  surface?: string
  tracktype?: string
}

export type OsmWaysRegionRecord = TileRegionLike & {
  createdAt: string
  /** Segmentos de calzada (motor) */
  segmentsMotor: OsmTaggedSegment[]
  /** Sendas / caminos mapeados como trail */
  segmentsTrail: OsmTaggedSegment[]
  /** Error de última sincronización (si hubo) */
  lastFetchError?: string | null
}

function padBbox(
  minLat: number,
  minLng: number,
  maxLat: number,
  maxLng: number
): { minLat: number; minLng: number; maxLat: number; maxLng: number } {
  return {
    minLat: minLat - BBOX_PAD_DEG,
    minLng: minLng - BBOX_PAD_DEG,
    maxLat: maxLat + BBOX_PAD_DEG,
    maxLng: maxLng + BBOX_PAD_DEG,
  }
}

function bboxIntersects(
  a: { minLat: number; minLng: number; maxLat: number; maxLng: number },
  b: { minLat: number; minLng: number; maxLat: number; maxLng: number }
): boolean {
  return !(a.maxLat < b.minLat || a.minLat > b.maxLat || a.maxLng < b.minLng || a.minLng > b.maxLng)
}

type OverpassWayEl = {
  type: string
  id?: number
  tags?: Record<string, string>
  geometry?: Array<{ lat: number; lon: number }>
}

function waysToTaggedSegments(elements: OverpassWayEl[]): OsmTaggedSegment[] {
  const out: OsmTaggedSegment[] = []
  for (const el of elements) {
    if (el.type !== 'way' || !el.geometry || el.geometry.length < 2) continue
    const tags = el.tags ?? {}
    const highway = tags.highway
    const surface = tags.surface
    const tracktype = tags.tracktype
    const g = el.geometry
    for (let i = 0; i < g.length - 1; i++) {
      const p = g[i]!
      const q = g[i + 1]!
      out.push({
        a: { latitude: p.lat, longitude: p.lon },
        b: { latitude: q.lat, longitude: q.lon },
        highway,
        surface,
        tracktype,
      })
    }
  }
  return out
}

async function fetchOverpassWays(
  minLat: number,
  minLng: number,
  maxLat: number,
  maxLng: number,
  waysLine: string,
  overpassUrl: string = DEFAULT_OVERPASS
): Promise<OsmTaggedSegment[]> {
  if (minLat >= maxLat || minLng >= maxLng) return []
  const q = `
[out:json][timeout:45];
(
  ${waysLine}
);
out geom;`
  const res = await fetch(overpassUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: new URLSearchParams({ data: q }),
  })
  if (!res.ok) return []
  const data = (await res.json()) as { elements?: OverpassWayEl[] }
  return waysToTaggedSegments(data.elements ?? [])
}

function motorWaysLine(minLat: number, minLng: number, maxLat: number, maxLng: number): string {
  return `way["highway"~"motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|road|living_street|residential|service"](${minLat},${minLng},${maxLat},${maxLng});`
}

function trailWaysLine(minLat: number, minLng: number, maxLat: number, maxLng: number): string {
  return `way["highway"~"path|track|footway|cycleway|bridleway|steps"](${minLat},${minLng},${maxLat},${maxLng});`
}

/** Trocea bbox grande en rectángulos <= maxSpan por lado. */
export function splitBboxIntoChunks(
  minLat: number,
  minLng: number,
  maxLat: number,
  maxLng: number,
  maxSpanDeg: number = MAX_SINGLE_QUERY_SPAN_DEG
): Array<{ minLat: number; minLng: number; maxLat: number; maxLng: number }> {
  const chunks: Array<{ minLat: number; minLng: number; maxLat: number; maxLng: number }> = []
  for (let la = minLat; la < maxLat - 1e-9; la += maxSpanDeg) {
    const la2 = Math.min(maxLat, la + maxSpanDeg)
    for (let lo = minLng; lo < maxLng - 1e-9; lo += maxSpanDeg) {
      const lo2 = Math.min(maxLng, lo + maxSpanDeg)
      chunks.push({ minLat: la, minLng: lo, maxLat: la2, maxLng: lo2 })
    }
  }
  if (chunks.length === 0) chunks.push({ minLat, minLng, maxLat, maxLng })
  return chunks
}

async function fetchAllMotorTrailForBbox(
  minLat: number,
  minLng: number,
  maxLat: number,
  maxLng: number,
  overpassUrl?: string
): Promise<{ motor: OsmTaggedSegment[]; trail: OsmTaggedSegment[] }> {
  const padded = padBbox(minLat, minLng, maxLat, maxLng)
  const chunks = splitBboxIntoChunks(padded.minLat, padded.minLng, padded.maxLat, padded.maxLng)
  const motor: OsmTaggedSegment[] = []
  const trail: OsmTaggedSegment[] = []
  for (const c of chunks) {
    const [m, t] = await Promise.all([
      fetchOverpassWays(c.minLat, c.minLng, c.maxLat, c.maxLng, motorWaysLine(c.minLat, c.minLng, c.maxLat, c.maxLng), overpassUrl),
      fetchOverpassWays(c.minLat, c.minLng, c.maxLat, c.maxLng, trailWaysLine(c.minLat, c.minLng, c.maxLat, c.maxLng), overpassUrl),
    ])
    motor.push(...m)
    trail.push(...t)
  }
  return { motor, trail }
}

/**
 * Descarga vías OSM para la misma bbox que una región de teselas y las guarda en IndexedDB.
 */
export async function cacheOsmWaysForTileRegion(
  region: TileRegionLike,
  overpassUrl: string = DEFAULT_OVERPASS
): Promise<void> {
  let lastErr: string | null = null
  let motor: OsmTaggedSegment[] = []
  let trail: OsmTaggedSegment[] = []
  try {
    const r = await fetchAllMotorTrailForBbox(
      region.minLat,
      region.minLng,
      region.maxLat,
      region.maxLng,
      overpassUrl
    )
    motor = r.motor
    trail = r.trail
  } catch (e) {
    lastErr = e instanceof Error ? e.message : 'fetch error'
  }

  const record: OsmWaysRegionRecord = {
    ...region,
    createdAt: region.createdAt ?? new Date().toISOString(),
    segmentsMotor: motor,
    segmentsTrail: trail,
    lastFetchError: lastErr,
  }

  const db = await openOfflineMapDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(OSM_WAYS_STORE, 'readwrite')
    tx.objectStore(OSM_WAYS_STORE).put(record)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('No se pudo guardar OSM ways'))
  })
  db.close()
}

export async function listCachedOsmWaysRegions(): Promise<OsmWaysRegionRecord[]> {
  const db = await openOfflineMapDb()
  const rows = await new Promise<OsmWaysRegionRecord[]>((resolve, reject) => {
    const tx = db.transaction(OSM_WAYS_STORE, 'readonly')
    const req = tx.objectStore(OSM_WAYS_STORE).getAll()
    req.onsuccess = () => resolve((req.result as OsmWaysRegionRecord[]) ?? [])
    req.onerror = () => reject(req.error ?? new Error('No se pudo leer OSM ways'))
  })
  db.close()
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/**
 * Une segmentos motor+trail de todas las regiones cacheadas que intersectan la bbox consultada.
 */
export async function getMergedTaggedSegmentsForBbox(
  minLat: number,
  minLng: number,
  maxLat: number,
  maxLng: number,
  mode: 'motor' | 'trail' | 'both' = 'both'
): Promise<OsmTaggedSegment[]> {
  const q = { minLat, minLng, maxLat, maxLng }
  const rows = await listCachedOsmWaysRegions()
  const merged: OsmTaggedSegment[] = []
  for (const r of rows) {
    if (!bboxIntersects(q, r)) continue
    if (mode === 'motor' || mode === 'both') merged.push(...r.segmentsMotor)
    if (mode === 'trail' || mode === 'both') merged.push(...r.segmentsTrail)
  }
  return merged
}

export type SnapPointOptions = {
  maxSnapMeters?: number
  mode?: 'motor' | 'trail' | 'both'
  /** Prioridad: si hay snap en trail y motor, preferir trail (DH). */
  preferTrail?: boolean
}

/**
 * Proyecta un punto al segmento OSM cacheado más cercano dentro de maxSnapM.
 * Sin datos cacheados devuelve null.
 */
export async function snapLatLngToCachedOsm(
  latitude: number,
  longitude: number,
  options: SnapPointOptions = {}
): Promise<MapPathNode | null> {
  const pad = 0.004
  const segs = await getMergedTaggedSegmentsForBbox(
    latitude - pad,
    longitude - pad,
    latitude + pad,
    longitude + pad,
    options.mode ?? 'both'
  )
  if (segs.length === 0) return null
  const maxM = options.maxSnapMeters ?? 80
  const preferTrail = options.preferTrail !== false

  let bestTrail: { lat: number; lng: number; d: number } | null = null
  let bestAny: { lat: number; lng: number; d: number } | null = null

  for (const seg of segs) {
    const { clat, clng, distM } = closestPointOnSegmentMeters(seg.a, seg.b, latitude, longitude)
    if (distM > maxM) continue
    const cand = { lat: clat, lng: clng, d: distM }
    if (!bestAny || distM < bestAny.d) bestAny = cand
    const hw = seg.highway ?? ''
    const isTrailHw = /path|track|footway|cycleway|bridleway|steps/i.test(hw)
    if (isTrailHw && (!bestTrail || distM < bestTrail.d)) bestTrail = cand
  }

  if (!bestAny) return null
  const chosen = preferTrail && bestTrail ? bestTrail : bestAny
  return { latitude: chosen.lat, longitude: chosen.lng }
}
