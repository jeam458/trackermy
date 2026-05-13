/** Búsqueda ligera (reemplazo de leaflet-geosearch / OpenStreetMapProvider). */
export type NominatimHit = { lat: number; lng: number; displayName: string }

export async function nominatimSearchFirst(query: string): Promise<NominatimHit | null> {
  const q = query.trim()
  if (!q) return null
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('format', 'json')
  url.searchParams.set('q', q)
  url.searchParams.set('limit', '1')
  const res = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'es',
    },
  })
  if (!res.ok) return null
  const data = (await res.json()) as { lat?: string; lon?: string; display_name?: string }[]
  const row = data[0]
  if (!row?.lat || !row.lon) return null
  const lat = Number(row.lat)
  const lng = Number(row.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng, displayName: String(row.display_name ?? q) }
}
