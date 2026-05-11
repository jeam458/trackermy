/**
 * Ajuste de puntos GPS a geometría OSM: `network: 'motor'` = calzada, `network: 'trail'`
 * = senda/trocha mapeada (path, track, etc.). En DH muchas líneas faltan en OSM: el track
 * publicado por el rider sigue siendo la guía. Para snap a la **ruta propia** ver `pathMapMatch`
 * o en el futuro @turf/nearest-point-on-line. Atribución: © OpenStreetMap, ODbL.
 */
import type { ProcessedTrackPoint } from '@/core/domain/GPSTrack'
import { MapPathNode, closestPointOnSegmentMeters } from '@/lib/pathMapMatch'

const DEFAULT_OVERPASS = 'https://overpass-api.de/api/interpreter'
/** Tamaño máximo del bbox (grados) por petición; trocea trayectos largos. */
const BBOX_MAX_SPAN_DEG = 0.055
/** Margen alrededor del bbox del chunk para no cortar vías en el borde. */
const BBOX_PAD_DEG = 0.003
const CHUNK_COOLDOWN_MS = 400
const MIN_MOVE_M_TO_FLAG_SNAP = 1.2

type Segment = { a: MapPathNode; b: MapPathNode }

/** `motor` = vías para coche; `trail` = path/track/footway… en OSM (senda, trocha). */
export type OsmNetworkMode = 'motor' | 'trail'

export type OsmTrackSnapOptions = {
  maxSnapMeters?: number
  overpassUrl?: string
  /** Pausa entre peticiones a Overpass (rate limit) */
  msBetweenRequests?: number
  /** Por defecto motor (compatibilidad). */
  network?: OsmNetworkMode
}

type LatLng = { latitude: number; longitude: number }

function bboxForSlice(pts: LatLng[], from: number, toExclusive: number) {
  let minLat = Number.POSITIVE_INFINITY
  let maxLat = Number.NEGATIVE_INFINITY
  let minLng = Number.POSITIVE_INFINITY
  let maxLng = Number.NEGATIVE_INFINITY
  for (let i = from; i < toExclusive; i++) {
    const p = pts[i]!
    minLat = Math.min(minLat, p.latitude)
    maxLat = Math.max(maxLat, p.latitude)
    minLng = Math.min(minLng, p.longitude)
    maxLng = Math.max(maxLng, p.longitude)
  }
  return { minLat, maxLat, minLng, maxLng }
}

/**
 * Construye índices de chunks [start, end) no solapados; el bbox nunca excede maxSpan (salvo 1 punto).
 */
function buildChunkBounds(pts: LatLng[], maxSpan: number): Array<[number, number]> {
  const n = pts.length
  if (n === 0) return []
  const chunks: Array<[number, number]> = []
  let i = 0
  while (i < n) {
    let j = i + 1
    while (j < n) {
      const b = bboxForSlice(pts, i, j + 1)
      const dLat = b.maxLat - b.minLat
      const dLng = b.maxLng - b.minLng
      if (dLat > maxSpan || dLng > maxSpan) break
      j++
    }
    j = Math.max(i + 1, j)
    chunks.push([i, j])
    i = j
  }
  return chunks
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

function parseWaysToSegments(elements: Array<{ type?: string; geometry?: Array<{ lat: number; lon: number }> }>): Segment[] {
  const segments: Segment[] = []
  for (const el of elements) {
    if (el.type !== 'way' || !el.geometry || el.geometry.length < 2) continue
    const g = el.geometry
    for (let i = 0; i < g.length - 1; i++) {
      const a = g[i]!
      const b = g[i + 1]!
      segments.push({
        a: { latitude: a.lat, longitude: a.lon },
        b: { latitude: b.lat, longitude: b.lon },
      })
    }
  }
  return segments
}

async function fetchSegmentsForBbox(
  minLat: number,
  minLng: number,
  maxLat: number,
  maxLng: number,
  overpassUrl: string,
  network: OsmNetworkMode
): Promise<Segment[]> {
  if (minLat >= maxLat || minLng >= maxLng) return []
  const waysLine =
    network === 'trail'
      ? `way["highway"~"path|track|footway|cycleway|bridleway|steps"](${minLat},${minLng},${maxLat},${maxLng});`
      : `way["highway"~"motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|road|living_street|residential|service"](${minLat},${minLng},${maxLat},${maxLng});`
  const q = `
[out:json][timeout:35];
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
  const data = (await res.json()) as { elements?: Array<{ type: string; geometry?: Array<{ lat: number; lon: number }> }> }
  return parseWaysToSegments(data.elements ?? [])
}

function bestSnapOnSegments(lat: number, lng: number, segments: Segment[], maxM: number): { lat: number; lng: number; dist: number } | null {
  if (segments.length === 0) return null
  let bestClat = 0
  let bestClng = 0
  let bestD = Number.POSITIVE_INFINITY
  for (const { a, b } of segments) {
    const { clat, clng, distM } = closestPointOnSegmentMeters(a, b, lat, lng)
    if (distM < bestD) {
      bestD = distM
      bestClat = clat
      bestClng = clng
    }
  }
  if (bestD > maxM) return null
  return { lat: bestClat, lng: bestClng, dist: bestD }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * Proyecta cada punto al tramo vial OSM más cercano dentro de maxSnapM (map-matching simple / snap to road).
 * Funciona en el navegador o Capacitor (Overpass vía HTTPS). Si falla la red, devuelve copia de los puntos originales.
 * Atribución: © colaboradores de OpenStreetMap, ODbL.
 */
export async function snapProcessedTrackToOsmNetwork(
  points: ProcessedTrackPoint[],
  options: OsmTrackSnapOptions = {}
): Promise<ProcessedTrackPoint[]> {
  if (points.length === 0) return []
  const network: OsmNetworkMode = options.network ?? 'motor'
  const maxSnapMeters =
    options.maxSnapMeters ?? (network === 'trail' ? 70 : 300)
  const overpassUrl = options.overpassUrl ?? DEFAULT_OVERPASS
  const msBetween = options.msBetweenRequests ?? CHUNK_COOLDOWN_MS
  const latLng: LatLng[] = points.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))
  const chunkBounds = buildChunkBounds(latLng, BBOX_MAX_SPAN_DEG)
  const out: ProcessedTrackPoint[] = new Array(points.length)
  for (let i = 0; i < points.length; i++) {
    out[i] = { ...points[i]! }
  }
  for (let c = 0; c < chunkBounds.length; c++) {
    const [from, to] = chunkBounds[c]!
    const b = bboxForSlice(latLng, from, to)
    const padded = padBbox(b.minLat, b.minLng, b.maxLat, b.maxLng)
    let segments: Segment[] = []
    try {
      segments = await fetchSegmentsForBbox(
        padded.minLat,
        padded.minLng,
        padded.maxLat,
        padded.maxLng,
        overpassUrl,
        network
      )
    } catch {
      segments = []
    }
    for (let i = from; i < to; i++) {
      const p = points[i]!
      const hit = bestSnapOnSegments(p.latitude, p.longitude, segments, maxSnapMeters)
      if (hit && hit.dist > MIN_MOVE_M_TO_FLAG_SNAP) {
        out[i] = {
          ...p,
          latitude: hit.lat,
          longitude: hit.lng,
          roadSnapped: true,
        }
      } else {
        out[i] = { ...p }
      }
    }
    if (c < chunkBounds.length - 1 && msBetween > 0) {
      await sleep(msBetween)
    }
  }
  return out
}
