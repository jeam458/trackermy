import { NextRequest, NextResponse } from 'next/server'

type LatLng = { latitude: number; longitude: number }

/**
 * Vías caminables / ciclables en un bbox; Overpass. Resultado: la vía (way) con más arco, simplificada.
 * Atribución: © colaboradores de OpenStreetMap, ODbL.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      minLat?: number
      minLng?: number
      maxLat?: number
      maxLng?: number
    }
    const { minLat, minLng, maxLat, maxLng } = body
    if (
      typeof minLat !== 'number' ||
      typeof minLng !== 'number' ||
      typeof maxLat !== 'number' ||
      typeof maxLng !== 'number'
    ) {
      return NextResponse.json({ error: 'minLat, minLng, maxLat, maxLng requeridos' }, { status: 400 })
    }
    if (minLat >= maxLat || minLng >= maxLng) {
      return NextResponse.json({ error: 'bbox inválida' }, { status: 400 })
    }
    if (maxLat - minLat > 0.15 || maxLng - minLng > 0.15) {
      return NextResponse.json(
        { error: 'Zona demasiado grande; reduce el área (máx. ~0,15° por lado).' },
        { status: 400 }
      )
    }

    const q = `
[out:json][timeout:25];
(
  way["highway"~"path|track|footway|cycleway|bridleway|steps"](${minLat},${minLng},${maxLat},${maxLng});
);
out geom;`

    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: new URLSearchParams({ data: q }),
    })
    if (!res.ok) {
      return NextResponse.json(
        { error: 'Overpass no disponible' },
        { status: 502 }
      )
    }
    const data = (await res.json()) as {
      elements?: Array<{
        type: string
        id: number
        geometry?: Array<{ lat: number; lon: number }>
      }>
    }
    const ways = (data.elements ?? []).filter(
      (e) => e.type === 'way' && e.geometry && e.geometry.length >= 2
    ) as Array<{ geometry: Array<{ lat: number; lon: number }> }>
    if (ways.length === 0) {
      return NextResponse.json({ path: [] as LatLng[] })
    }

    const scored = ways.map((w) => {
      const g = w.geometry
      let m = 0
      for (let i = 1; i < g.length; i++) {
        const a = g[i - 1]!
        const b = g[i]!
        m += haversineFast(a.lat, a.lon, b.lat, b.lon)
      }
      return { m, w }
    })
    scored.sort((a, b) => b.m - a.m)
    const best = scored[0]!
    const path: LatLng[] = best.w.geometry.map((n) => ({
      latitude: n.lat,
      longitude: n.lon,
    }))

    return NextResponse.json({ path, attribution: 'Map data: © OpenStreetMap contributors, ODbL' })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Error obteniendo vías' }, { status: 500 })
  }
}

function haversineFast(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
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
