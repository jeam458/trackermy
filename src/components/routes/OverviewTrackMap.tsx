'use client'

import maplibregl from 'maplibre-gl'
import { useEffect, useMemo, useRef } from 'react'
import { APP_MAP_CANVAS_HEX } from '@/components/routes/mapTheme'
import { MAPLIBRE_CARTO_DARK_STYLE } from '@/lib/maplibreAppStyles'
import type { MapPoint } from '@/hooks/useGPSRecorder'
import { Map, MapControls, useMap } from '@/components/ui/map'

const TEAL = '#4FD1C5'
const INDIGO = '#6366F1'

const SRC_POINTS = 'overview-track-pts'
const LAYER_POINTS = 'overview-track-pts-layer'
const SRC_LINE = 'overview-track-line'
const LAYER_LINE = 'overview-track-line-layer'

function MapResizeOnWindowResize() {
  const { map } = useMap()
  useEffect(() => {
    if (!map) return
    const onResize = () => requestAnimationFrame(() => map.resize())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [map])
  return null
}

function FitTrackLngLat({ lngLats }: { lngLats: [number, number][] }) {
  const { map, isLoaded } = useMap()
  useEffect(() => {
    if (!isLoaded || !map || lngLats.length === 0) return
    if (lngLats.length === 1) {
      map.jumpTo({ center: lngLats[0], zoom: 17 })
      return
    }
    const b = new maplibregl.LngLatBounds(lngLats[0], lngLats[0])
    for (const c of lngLats) b.extend(c)
    map.fitBounds(b, { padding: 28, maxZoom: 18, duration: 0 })
  }, [map, isLoaded, lngLats])
  return null
}

function PanToSelectedLngLat({
  lngLats,
  selectedIndex,
}: {
  lngLats: [number, number][]
  selectedIndex: number | null
}) {
  const { map, isLoaded } = useMap()
  useEffect(() => {
    if (!isLoaded || !map) return
    if (selectedIndex == null || selectedIndex < 0 || selectedIndex >= lngLats.length) return
    const c = lngLats[selectedIndex]!
    map.panTo(c, { duration: 350 })
  }, [map, isLoaded, lngLats, selectedIndex])
  return null
}

function OverviewPointsAndLine({
  lngLats,
  selectedIndex,
  onSelectIndex,
}: {
  lngLats: [number, number][]
  selectedIndex: number | null
  onSelectIndex: (index: number) => void
}) {
  const { map, isLoaded } = useMap()
  const onSelectRef = useRef(onSelectIndex)
  onSelectRef.current = onSelectIndex
  const selRef = useRef(selectedIndex)
  selRef.current = selectedIndex

  const pointData = useMemo(
    () =>
      ({
        type: 'FeatureCollection' as const,
        features: lngLats.map((coord, i) => ({
          type: 'Feature' as const,
          id: i,
          properties: { idx: i },
          geometry: { type: 'Point' as const, coordinates: coord },
        })),
      }) satisfies GeoJSON.FeatureCollection,
    [lngLats],
  )

  useEffect(() => {
    if (!isLoaded || !map) return

    const k = selectedIndex ?? -999

    const lineCoords =
      lngLats.length >= 2 ? lngLats : lngLats.length === 1 ? [lngLats[0]!, lngLats[0]!] : []

    map.addSource(SRC_LINE, {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: lineCoords },
      },
    })
    map.addLayer({
      id: LAYER_LINE,
      type: 'line',
      source: SRC_LINE,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': TEAL,
        'line-width': 4,
        'line-opacity': 0.85,
      },
    })

    map.addSource(SRC_POINTS, { type: 'geojson', data: pointData })
    map.addLayer({
      id: LAYER_POINTS,
      type: 'circle',
      source: SRC_POINTS,
      paint: {
        'circle-radius': ['case', ['==', ['get', 'idx'], k], 9, 4],
        'circle-color': ['case', ['==', ['get', 'idx'], k], TEAL, INDIGO],
        'circle-opacity': ['case', ['==', ['get', 'idx'], k], 0.45, 0.35],
        'circle-stroke-width': ['case', ['==', ['get', 'idx'], k], 3, 2],
        'circle-stroke-color': ['case', ['==', ['get', 'idx'], k], TEAL, INDIGO],
      },
    })

    const onClick = (e: maplibregl.MapLayerMouseEvent) => {
      const f = e.features?.[0]
      const idx = f?.properties?.idx
      if (typeof idx === 'number') onSelectRef.current(idx)
    }
    const onEnter = () => {
      map.getCanvas().style.cursor = 'pointer'
    }
    const onLeave = () => {
      map.getCanvas().style.cursor = ''
    }
    map.on('click', LAYER_POINTS, onClick)
    map.on('mouseenter', LAYER_POINTS, onEnter)
    map.on('mouseleave', LAYER_POINTS, onLeave)

    return () => {
      map.off('click', LAYER_POINTS, onClick)
      map.off('mouseenter', LAYER_POINTS, onEnter)
      map.off('mouseleave', LAYER_POINTS, onLeave)
      if (map.getLayer(LAYER_POINTS)) map.removeLayer(LAYER_POINTS)
      if (map.getSource(SRC_POINTS)) map.removeSource(SRC_POINTS)
      if (map.getLayer(LAYER_LINE)) map.removeLayer(LAYER_LINE)
      if (map.getSource(SRC_LINE)) map.removeSource(SRC_LINE)
    }
  }, [isLoaded, map, lngLats, pointData])

  useEffect(() => {
    if (!isLoaded || !map || !map.getSource(SRC_LINE)) return
    const src = map.getSource(SRC_LINE) as maplibregl.GeoJSONSource
    const lineCoords =
      lngLats.length >= 2 ? lngLats : lngLats.length === 1 ? [lngLats[0]!, lngLats[0]!] : []
    src.setData({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: lineCoords },
    })
  }, [isLoaded, map, lngLats])

  useEffect(() => {
    if (!isLoaded || !map || !map.getSource(SRC_POINTS)) return
    const src = map.getSource(SRC_POINTS) as maplibregl.GeoJSONSource
    src.setData(pointData)
  }, [isLoaded, map, pointData])

  useEffect(() => {
    if (!isLoaded || !map || !map.getLayer(LAYER_POINTS)) return
    const v = selRef.current ?? -999
    map.setPaintProperty(LAYER_POINTS, 'circle-radius', ['case', ['==', ['get', 'idx'], v], 9, 4])
    map.setPaintProperty(LAYER_POINTS, 'circle-color', ['case', ['==', ['get', 'idx'], v], TEAL, INDIGO])
    map.setPaintProperty(LAYER_POINTS, 'circle-opacity', ['case', ['==', ['get', 'idx'], v], 0.45, 0.35])
    map.setPaintProperty(LAYER_POINTS, 'circle-stroke-width', ['case', ['==', ['get', 'idx'], v], 3, 2])
    map.setPaintProperty(LAYER_POINTS, 'circle-stroke-color', ['case', ['==', ['get', 'idx'], v], TEAL, INDIGO])
  }, [isLoaded, map, selectedIndex])

  return null
}

export interface OverviewTrackMapProps {
  points: MapPoint[]
  selectedIndex: number | null
  onSelectIndex: (index: number) => void
  height?: number
  className?: string
}

export default function OverviewTrackMap({
  points,
  selectedIndex,
  onSelectIndex,
  height = 220,
  className = '',
}: OverviewTrackMapProps) {
  const lngLats = useMemo(
    () => points.map((p) => [p.longitude, p.latitude] as [number, number]),
    [points],
  )

  const centerLngLat = useMemo((): [number, number] => {
    if (lngLats.length === 0) return [-71.9675, -13.5319]
    const mid = Math.floor(lngLats.length / 2)
    return lngLats[mid]!
  }, [lngLats])

  if (points.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl border border-white/5 bg-[#121826] text-sm text-slate-500 ${className}`}
        style={{ height }}
      >
        Sin puntos para el mapa
      </div>
    )
  }

  return (
    <div className={`overflow-hidden rounded-2xl border border-white/10 ${className}`} style={{ height }}>
      <Map
        theme="dark"
        forceStyle={MAPLIBRE_CARTO_DARK_STYLE}
        className="map-dark-ui h-full w-full [&_.maplibregl-ctrl-attrib]:!text-[10px] [&_.maplibregl-ctrl-attrib]:!text-slate-400"
        center={centerLngLat}
        zoom={16}
        minZoom={3}
        maxZoom={22}
      >
        <MapResizeOnWindowResize />
        <MapControls position="bottom-right" showZoom showCompass />
        <FitTrackLngLat lngLats={lngLats} />
        <PanToSelectedLngLat lngLats={lngLats} selectedIndex={selectedIndex} />
        <OverviewPointsAndLine lngLats={lngLats} selectedIndex={selectedIndex} onSelectIndex={onSelectIndex} />
      </Map>
    </div>
  )
}
