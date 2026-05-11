'use client'

import { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, CircleMarker, Popup, useMap } from 'react-leaflet'
import L, { DivIcon, Map } from 'leaflet'
import { MapPin, Navigation, Search, ChevronRight, Layers } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import {
  APP_MAP_CANVAS_HEX,
  BRAND_OUTDOOR_MAP_TILE,
  DARK_MAP_TILE,
  MAP_MARKER_AVATAR_IMG_INLINE_STYLE,
  routeColorFromId,
  tileLayerPresetProps,
} from './mapTheme'
import { PartidaSonarLeaflet } from '@/components/routes/PartidaSonarLeaflet'
import { snapLatLngToCachedOsm } from '@/lib/osmWaysOfflineCache'

import { OpenStreetMapProvider } from 'leaflet-geosearch'

const pinHtml = (label: string, bg: string) =>
  `<div style="width:30px;height:30px;border-radius:50%;background:${bg};border:3px solid #fff;color:#fff;font:bold 12px system-ui,Segoe UI,sans-serif;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,.55);">${label}</div>`

const startIcon = new DivIcon({
  className: 'leaflet-route-marker',
  html: pinHtml('A', '#16a34a'),
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  popupAnchor: [0, -12],
})

const endIcon = new DivIcon({
  className: 'leaflet-route-marker',
  html: pinHtml('B', '#dc2626'),
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  popupAnchor: [0, -12],
})

/** Posición actual durante grabación (distinto de meta estática “B”) */
const liveGpsIcon = new DivIcon({
  className: 'leaflet-route-marker',
  html: `<div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(145deg,#2dd4bf,#0d9488);border:3px solid #0f172a;box-shadow:0 2px 14px rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;font-size:15px;">🚴</div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  popupAnchor: [0, -14],
})

function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim())
  if (!m) return `rgba(148, 163, 184, ${alpha})`
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`
}

function normalizeRecordingAccent(hex: string | null | undefined, fallback: string): string {
  if (hex && /^#[0-9A-Fa-f]{6}$/.test(hex.trim())) return hex.trim()
  return fallback
}

const DEFAULT_RECORDING_ACCENT = '#2dd4bf'

function liveAvatarMapIcon(imageUrl: string): DivIcon {
  const u = encodeURI(imageUrl)
  return new DivIcon({
    className: 'leaflet-route-marker',
    html: `<div style="width:36px;height:36px;border-radius:50%;overflow:hidden;border:3px solid #0f172a;box-shadow:0 2px 14px rgba(0,0,0,.6);"><img src="${u}" alt="" style="${MAP_MARKER_AVATAR_IMG_INLINE_STYLE}"/></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -14],
  })
}

/** Foto de bici del perfil con anillo del color elegido */
function liveBikePhotoIcon(imageUrl: string, accentHex: string): DivIcon {
  const u = encodeURI(imageUrl)
  const a = accentHex
  return new DivIcon({
    className: 'leaflet-route-marker',
    html: `<div style="width:40px;height:40px;border-radius:50%;box-sizing:border-box;padding:3px;background:${a};box-shadow:0 2px 12px rgba(0,0,0,.35),0 0 0 1px rgba(255,255,255,.08) inset;">
      <div style="width:100%;height:100%;border-radius:50%;overflow:hidden;border:2px solid #0f172a;background:#0f172a;">
        <img src="${u}" alt="" style="${MAP_MARKER_AVATAR_IMG_INLINE_STYLE}"/>
      </div>
    </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -12],
  })
}

/** Sin foto de bici: mismo estilo que antes pero acentuado con el color del perfil */
function liveBikeFallbackIcon(accentHex: string): DivIcon {
  const a = accentHex
  return new DivIcon({
    className: 'leaflet-route-marker',
    html: `<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(155deg,${a} 0%,#0f172a 92%);border:2.5px solid ${a};box-shadow:0 2px 10px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:15px;">🚴</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -12],
  })
}

export interface MapPoint {
  latitude: number
  longitude: number
  altitude?: number
  accuracy?: number
  speed?: number
}

interface RouteMapEditorProps {
  startPoint?: MapPoint | null
  endPoint?: MapPoint | null
  trackPoints: MapPoint[]
  onPointAdd: (point: MapPoint) => void
  onPointRemove: (index: number) => void
  onStartPointSet: (point: MapPoint) => void
  onEndPointSet: (point: MapPoint) => void
  isDrawing: boolean
  pointSelectionMode?: 'start' | 'end' | 'intermediate' | null
  startPointSelection?: (type: 'start' | 'end' | 'intermediate') => void
  cancelPointSelection?: () => void
  onUseCurrentLocation?: () => void
  center?: [number, number]
  zoom?: number
  /**
   * Grabación GPS en marcha: línea y puntos en (casi) tiempo real, cámara que sigue la bajada,
   * menos marcadores intermedios para rendimiento, refresco del mapa al desbloquear el móvil.
   */
  liveRecording?: boolean
  /** Centrar una vez cuando exista (p. ej. primer GPS antes de grabar) */
  flyToWhenReady?: [number, number] | null
  flyToBump?: number
  /** Icono reducido de perfil para la posición en vivo al grabar */
  liveMapAvatarUrl?: string | null
  /** Icono de bici para mapa (map_icon_url); prioridad sobre avatar al grabar */
  liveBikeMapIconUrl?: string | null
  /** Color de la bici (#RRGGBB) para anillo y trazo sutil al grabar */
  liveBikeColorHex?: string | null
  /**
   * Antes de grabar: tras centrar el mapa en el GPS, mostrar foto del rider en la posición en vivo
   * (misma lógica que en grabación).
   */
  previewRiderAvatar?: boolean
  /** `outdoor`: calles, agua y zonas verdes (OSM). `dark`: Carto oscuro. */
  mapTilePreset?: 'dark' | 'outdoor'
  /** Ocupa todo el alto del contenedor (p. ej. pantalla de grabación a mapa completo). */
  fillViewport?: boolean
  /**
   * Ruta publicada del catálogo: trazo + inicio/meta (verde/rojo). No usar para “nueva ruta libre”.
   * El GPS en vivo del rider va en `riderPreviewPosition`.
   */
  publishedReferencePath?: MapPoint[] | null
  /** Para color estable del trazo de referencia (misma convención que en el catálogo). */
  publishedReferenceRouteId?: string | null
  /** Posición GPS del rider antes de grabar (foto/map icon). Distinta de meta del trazo publicado. */
  riderPreviewPosition?: MapPoint | null
  /**
   * Si true, al colocar puntos en el mapa intenta proyectar a vías OSM cacheadas offline
   * (misma IndexedDB que la descarga de tiles). Requiere haber descargado la zona antes.
   */
  lockToNetwork?: boolean
  /** Radio máximo de snap a vía (metros). */
  lockToNetworkMaxSnapMeters?: number
  /** Qué red usar del cache: sendas, calzada o ambas. */
  lockToNetworkMode?: 'motor' | 'trail' | 'both'
}

// Verificar si la geolocalización está disponible
const isGeolocationAvailable = typeof navigator !== 'undefined' && navigator.geolocation

const LIVE_MARKER_BUDGET = 45

function liveRecordingMarkerIndices(len: number): number[] {
  if (len <= LIVE_MARKER_BUDGET) {
    return Array.from({ length: len }, (_, i) => i)
  }
  const stride = Math.ceil(len / LIVE_MARKER_BUDGET)
  const idx = new Set<number>()
  for (let i = 0; i < len; i += stride) idx.add(i)
  idx.add(len - 1)
  return Array.from(idx).sort((a, b) => a - b)
}

/** Encuadra el mapa al trazo publicado al elegir ruta (no compite con el seguimiento en vivo al grabar). */
function FitBoundsToPublishedRoute({
  positions,
  enabled,
}: {
  positions: [number, number][]
  enabled: boolean
}) {
  const map = useMap()
  const signature =
    positions.length +
    ':' +
    (positions[0]?.[0] ?? '') +
    ':' +
    (positions[positions.length - 1]?.[1] ?? '')
  useEffect(() => {
    if (!enabled || positions.length < 2) return
    const ll = positions.map((p) => L.latLng(p[0], p[1]))
    const b = L.latLngBounds(ll)
    map.fitBounds(b, { padding: [32, 32], maxZoom: 16, animate: true })
  }, [map, enabled, signature, positions])
  return null
}

/** Sigue el último punto GPS y recupera tiles tras segundo plano / pantalla apagada. */
function LiveRecordingMapFollower({
  enabled,
  allLinePoints,
}: {
  enabled: boolean
  allLinePoints: MapPoint[]
}) {
  const map = useMap()
  const lineRef = useRef(allLinePoints)
  lineRef.current = allLinePoints
  const lastPanMs = useRef(0)
  const tailSignature =
    allLinePoints.length > 0
      ? `${allLinePoints.length}:${allLinePoints[allLinePoints.length - 1].latitude.toFixed(6)}:${allLinePoints[allLinePoints.length - 1].longitude.toFixed(6)}`
      : ''

  useEffect(() => {
    if (!enabled || allLinePoints.length === 0) return
    const last = allLinePoints[allLinePoints.length - 1]
    const now = Date.now()
    if (now - lastPanMs.current < 800) return
    lastPanMs.current = now
    const z = Math.max(map.getZoom(), 16)
    map.flyTo([last.latitude, last.longitude], z, {
      duration: 0.4,
      easeLinearity: 0.22,
    })
  }, [enabled, tailSignature, map])

  useEffect(() => {
    if (!enabled) return

    const refreshLayout = () => {
      requestAnimationFrame(() => {
        map.invalidateSize({ animate: false })
        const pts = lineRef.current
        if (pts.length > 0) {
          const l = pts[pts.length - 1]
          map.setView([l.latitude, l.longitude], Math.max(map.getZoom(), 16), {
            animate: false,
          })
        }
      })
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        setTimeout(refreshLayout, 120)
      }
    }

    document.addEventListener('visibilitychange', onVisibility)

    let appListener: { remove: () => Promise<void> } | undefined
    let cancelled = false

    void (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core')
        if (cancelled || !Capacitor.isNativePlatform()) return
        const { App } = await import('@capacitor/app')
        appListener = await App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) setTimeout(refreshLayout, 180)
        })
      } catch {
        /* noop */
      }
    })()

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      void appListener?.remove()
    }
  }, [enabled, map])

  return null
}

function FlyToWhenReady({
  target,
  zoomMin = 16,
  bump = 0,
}: {
  target: [number, number] | null | undefined
  zoomMin?: number
  /** Incrementar para forzar otro vuelo (p. ej. botón “Centrar en mi GPS”) */
  bump?: number
}) {
  const map = useMap()
  const seen = useRef<string | null>(null)
  useEffect(() => {
    if (!target) return
    const sig = `${bump}|${target[0].toFixed(6)},${target[1].toFixed(6)}`
    if (seen.current === sig) return
    seen.current = sig
    map.flyTo(target, Math.max(map.getZoom(), zoomMin), {
      duration: 0.55,
      easeLinearity: 0.25,
    })
  }, [target, bump, map, zoomMin])
  return null
}

function MapEventHandler({
  onMapClick,
  onMapReady,
}: {
  onMapClick: (lat: number, lng: number) => void | Promise<void>
  onMapReady: (map: Map) => void
}) {
  const map = useMapEvents({
    click: (e) => {
      void Promise.resolve(onMapClick(e.latlng.lat, e.latlng.lng))
    },
    load: (e) => {
      onMapReady(e.target)
    },
  })

  useEffect(() => {
    onMapReady(map)
  }, [map, onMapReady])

  return null
}

function MapSearchPanel({
  onPickStart,
  onPickEnd,
}: {
  onPickStart: (p: MapPoint) => void
  onPickEnd: (p: MapPoint) => void
}) {
  const map = useMap()
  const [qStart, setQStart] = useState('')
  const [qEnd, setQEnd] = useState('')
  const [busy, setBusy] = useState<'start' | 'end' | null>(null)
  const providerRef = useRef(new OpenStreetMapProvider())

  const search = async (which: 'start' | 'end') => {
    const q = which === 'start' ? qStart.trim() : qEnd.trim()
    if (!q) return
    setBusy(which)
    try {
      const results = await providerRef.current.search({ query: q })
      const r = results[0]
      if (!r) return
      const lat = r.y
      const lng = r.x
      map.flyTo([lat, lng], 17, { duration: 0.8 })
      const pt: MapPoint = { latitude: lat, longitude: lng }
      if (which === 'start') onPickStart(pt)
      else onPickEnd(pt)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div
      className="leaflet-top leaflet-right"
      style={{ marginTop: 52, marginRight: 8, zIndex: 1000, width: 280, maxWidth: 'calc(100% - 16px)' }}
    >
      <div className="flex flex-col gap-2 p-2 rounded-lg border border-slate-600 bg-slate-900/95 text-slate-100 shadow-xl backdrop-blur-sm">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Búsqueda</div>
        <div className="flex gap-1">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-green-400" size={14} />
            <input
              value={qStart}
              onChange={(e) => setQStart(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search('start')}
              placeholder="Inicio (dirección)"
              className="w-full pl-7 pr-2 py-1.5 rounded-md bg-slate-800 border border-slate-600 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => search('start')}
            className="shrink-0 px-2 py-1.5 rounded-md bg-green-600 hover:bg-green-500 text-white text-xs font-medium disabled:opacity-50"
          >
            Ir
          </button>
        </div>
        <div className="flex gap-1">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-red-400" size={14} />
            <input
              value={qEnd}
              onChange={(e) => setQEnd(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search('end')}
              placeholder="Meta (dirección)"
              className="w-full pl-7 pr-2 py-1.5 rounded-md bg-slate-800 border border-slate-600 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => search('end')}
            className="shrink-0 px-2 py-1.5 rounded-md bg-red-600 hover:bg-red-500 text-white text-xs font-medium disabled:opacity-50"
          >
            Ir
          </button>
        </div>
      </div>
    </div>
  )
}

function UserLocationTracker({
  onLocationUpdate,
  enabled = false,
}: {
  onLocationUpdate: (point: MapPoint) => void
  enabled: boolean
}) {
  useMapEvents({})
  const watchIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled || !navigator.geolocation) {
      return
    }

    // Limpiar watch anterior si existe
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const point: MapPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          altitude: position.coords.altitude ?? undefined,
          accuracy: position.coords.accuracy ?? undefined,
        }
        onLocationUpdate(point)
        // No hacer setView automáticamente para no molestar al usuario
        // El usuario puede usar el botón "Usar Mi Ubicación" si lo desea
      },
      (error) => {
        // Solo loguear errores, no mostrar alertas molestas
        if (error.code === error.PERMISSION_DENIED) {
          console.log('Permiso de ubicación denegado')
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          console.log('Ubicación no disponible')
        } else if (error.code === error.TIMEOUT) {
          console.log('Timeout al obtener ubicación')
        } else {
          console.error('Error de geolocalización:', error)
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000, // Aceptar ubicación de hasta 5 segundos
        timeout: 10000, // 10 segundos timeout
      }
    )

    // Cleanup
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [enabled, onLocationUpdate])

  return null
}

export function RouteMapEditor({
  startPoint,
  endPoint,
  trackPoints,
  onPointAdd,
  onPointRemove,
  onStartPointSet,
  onEndPointSet,
  isDrawing,
  pointSelectionMode = null,
  startPointSelection = () => {},
  cancelPointSelection = () => {},
  onUseCurrentLocation = () => {},
  center = [-13.5319, -71.9675], // Cusco, Peru por defecto
  zoom = 18, // Zoom máximo detalle (se ven casas, árboles, senderos de 1m)
  liveRecording = false,
  flyToWhenReady = null,
  flyToBump = 0,
  liveMapAvatarUrl = null,
  liveBikeMapIconUrl = null,
  liveBikeColorHex = null,
  previewRiderAvatar = false,
  mapTilePreset = 'dark',
  fillViewport = false,
  publishedReferencePath = null,
  publishedReferenceRouteId = null,
  riderPreviewPosition = null,
  lockToNetwork = false,
  lockToNetworkMaxSnapMeters,
  lockToNetworkMode = 'both',
}: RouteMapEditorProps) {
  const mapRef = useRef<Map | null>(null)
  const mapContainerResizeRef = useRef<HTMLDivElement | null>(null)
  const baseTile = mapTilePreset === 'outdoor' ? BRAND_OUTDOOR_MAP_TILE : DARK_MAP_TILE

  /** Recalcular tiles si el contenedor cambia de tamaño (p. ej. maximizar/reducir el mapa en grabación). */
  useEffect(() => {
    const el = mapContainerResizeRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      const m = mapRef.current
      if (!m) return
      requestAnimationFrame(() => {
        m.invalidateSize({ animate: false })
      })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const publishedPositions = useMemo((): [number, number][] => {
    if (!publishedReferencePath || publishedReferencePath.length < 2) return []
    return publishedReferencePath.map((p) => [p.latitude, p.longitude] as [number, number])
  }, [publishedReferencePath])

  const referenceLineColor = useMemo(() => {
    if (publishedReferenceRouteId) return routeColorFromId(publishedReferenceRouteId)
    return '#ef4444'
  }, [publishedReferenceRouteId])

  const recordingAccent = useMemo(
    () => normalizeRecordingAccent(liveBikeColorHex, DEFAULT_RECORDING_ACCENT),
    [liveBikeColorHex]
  )

  const liveLineColor = useMemo(
    () => (liveRecording ? hexToRgba(recordingAccent, 0.38) : '#fbbf24'),
    [liveRecording, recordingAccent]
  )

  const livePositionIcon = useMemo(() => {
    const showRiderIcon = liveRecording || previewRiderAvatar
    if (!showRiderIcon) return liveGpsIcon
    if (liveBikeMapIconUrl?.trim()) {
      return liveBikePhotoIcon(liveBikeMapIconUrl.trim(), recordingAccent)
    }
    if (liveMapAvatarUrl?.trim()) {
      return liveAvatarMapIcon(liveMapAvatarUrl.trim())
    }
    return liveBikeFallbackIcon(recordingAccent)
  }, [
    liveRecording,
    previewRiderAvatar,
    liveBikeMapIconUrl,
    liveMapAvatarUrl,
    recordingAccent,
  ])

  const handleMapClick = useCallback(
    async (lat: number, lng: number) => {
      if (!isDrawing) return

      let newPoint: MapPoint = { latitude: lat, longitude: lng }
      if (lockToNetwork) {
        const snapped = await snapLatLngToCachedOsm(lat, lng, {
          maxSnapMeters: lockToNetworkMaxSnapMeters ?? 95,
          mode: lockToNetworkMode,
          preferTrail: lockToNetworkMode !== 'motor',
        })
        if (snapped) newPoint = { latitude: snapped.latitude, longitude: snapped.longitude }
      }

      if (pointSelectionMode) {
        switch (pointSelectionMode) {
          case 'start':
            onStartPointSet(newPoint)
            cancelPointSelection()
            break

          case 'end':
            onEndPointSet(newPoint)
            cancelPointSelection()
            break

          case 'intermediate':
            onPointAdd(newPoint)
            break
        }
      }
    },
    [
      isDrawing,
      pointSelectionMode,
      onPointAdd,
      onStartPointSet,
      onEndPointSet,
      cancelPointSelection,
      lockToNetwork,
      lockToNetworkMaxSnapMeters,
      lockToNetworkMode,
    ]
  )

  const handleMapReady = useCallback((map: Map) => {
    mapRef.current = map
  }, [])

  const handleLocationUpdate = useCallback(() => {
    // Reservado: seguimiento en mapa sin mover la cámara
  }, [])

  // Construir array completo de puntos para el polyline (inicio → trazo → posición actual)
  const allPoints: MapPoint[] = []
  if (startPoint) allPoints.push(startPoint)
  allPoints.push(...trackPoints)
  if (endPoint) allPoints.push(endPoint)

  const liveMarkerIdx =
    liveRecording && trackPoints.length > 0
      ? liveRecordingMarkerIndices(trackPoints.length)
      : null

  return (
    <div
      ref={mapContainerResizeRef}
      className={`relative w-full ${fillViewport ? 'h-full min-h-0' : ''}`}
    >
      <MapContainer
        center={center}
        zoom={zoom}
        minZoom={3}
        maxZoom={baseTile.maxZoom}
        className="w-full h-full rounded-lg map-dark-ui"
        style={{
          minHeight: fillViewport ? '100%' : '400px',
          height: fillViewport ? '100%' : undefined,
          background: baseTile.canvas,
        }}
      >
        <TileLayer {...tileLayerPresetProps(baseTile)} />

        {publishedPositions.length >= 2 && (
          <FitBoundsToPublishedRoute positions={publishedPositions} enabled={!liveRecording} />
        )}

        {publishedPositions.length >= 2 && (
          <Polyline
            key={`pub-ref-${publishedReferenceRouteId ?? 'x'}-${publishedPositions.length}`}
            positions={publishedPositions}
            color={referenceLineColor}
            weight={liveRecording ? 3.5 : 5}
            opacity={liveRecording ? 0.4 : 0.92}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {publishedPositions.length >= 1 && (
          <PartidaSonarLeaflet
            position={publishedPositions[0]!}
            ringColor={referenceLineColor}
            signature={`sonar-pub-${publishedReferenceRouteId ?? 'x'}-${publishedPositions[0]![0].toFixed(5)}-${publishedPositions[0]![1].toFixed(5)}`}
            zIndexOffset={48}
            showCoreDot={false}
          />
        )}

        {publishedPositions.length >= 1 && (
          <Marker
            key={`pub-start-${publishedPositions[0]![0]}-${publishedPositions[0]![1]}`}
            position={publishedPositions[0]!}
            icon={startIcon}
            zIndexOffset={100}
          >
            <Popup>
              <div className="p-2">
                <strong className="text-green-600">Salida (ruta publicada)</strong>
                <p className="mt-1 text-xs text-gray-500">
                  {publishedPositions[0]![0].toFixed(5)}, {publishedPositions[0]![1].toFixed(5)}
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        {publishedPositions.length >= 2 && (
          <Marker
            key={`pub-end-${publishedPositions[publishedPositions.length - 1]![0]}-${publishedPositions[publishedPositions.length - 1]![1]}`}
            position={publishedPositions[publishedPositions.length - 1]!}
            icon={endIcon}
            zIndexOffset={90}
          >
            <Popup>
              <div className="p-2">
                <strong className="text-red-600">Meta (ruta publicada)</strong>
                <p className="mt-1 text-xs text-gray-500">
                  {publishedPositions[publishedPositions.length - 1]![0].toFixed(5)},{' '}
                  {publishedPositions[publishedPositions.length - 1]![1].toFixed(5)}
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        {isDrawing && (
          <MapSearchPanel onPickStart={onStartPointSet} onPickEnd={onEndPointSet} />
        )}

        {startPoint && (
          <Marker
            key={liveRecording ? 'recording-start-fixed' : `start-${startPoint.latitude}-${startPoint.longitude}`}
            position={[startPoint.latitude, startPoint.longitude]}
            icon={startIcon}
          >
            <Popup>
              <div className="p-2">
                <strong className="text-green-600">
                  {liveRecording ? 'Inicio de la bajada' : 'Punto de Partida'}
                </strong>
                <p className="text-xs text-gray-500 mt-1">
                  {startPoint.latitude.toFixed(6)}, {startPoint.longitude.toFixed(6)}
                </p>
                {startPoint.accuracy && (
                  <p className="text-xs text-gray-400">
                    Precisión: ±{startPoint.accuracy.toFixed(1)}m
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Rider en posición actual (solo antes de iniciar grabación): no usar como “meta” del catálogo */}
        {!liveRecording &&
          riderPreviewPosition &&
          previewRiderAvatar && (
          <Marker
            zIndexOffset={1400}
            key={`rider-preview-${riderPreviewPosition.latitude}-${riderPreviewPosition.longitude}`}
            position={[riderPreviewPosition.latitude, riderPreviewPosition.longitude]}
            icon={livePositionIcon}
          >
            <Popup>
              <div className="p-2">
                <strong className="text-teal-600">Tu posición (GPS)</strong>
                <p className="text-xs text-gray-500 mt-1">
                  {riderPreviewPosition.latitude.toFixed(6)}, {riderPreviewPosition.longitude.toFixed(6)}
                </p>
                {riderPreviewPosition.accuracy && (
                  <p className="text-xs text-gray-400">
                    Precisión: ±{riderPreviewPosition.accuracy.toFixed(1)}m
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Marker de fin / posición en vivo (preview GPS antes de grabar = foto del rider) */}
        {endPoint && (
          <Marker
            key={
              liveRecording
                ? `end-live-${endPoint.latitude.toFixed(5)}-${endPoint.longitude.toFixed(5)}`
                : `end-${endPoint.latitude}-${endPoint.longitude}`
            }
            position={[endPoint.latitude, endPoint.longitude]}
            icon={
              liveRecording
                ? livePositionIcon
                : previewRiderAvatar
                  ? livePositionIcon
                  : endIcon
            }
          >
            <Popup>
              <div className="p-2">
                <strong
                  className={
                    liveRecording
                      ? 'text-red-600'
                      : previewRiderAvatar
                        ? 'text-teal-600'
                        : 'text-red-600'
                  }
                >
                  {liveRecording
                    ? 'Posición actual'
                    : previewRiderAvatar
                      ? 'Tu posición (GPS)'
                      : 'Punto de Llegada'}
                </strong>
                <p className="text-xs text-gray-500 mt-1">
                  {endPoint.latitude.toFixed(6)}, {endPoint.longitude.toFixed(6)}
                </p>
                {endPoint.accuracy && (
                  <p className="text-xs text-gray-400">
                    Precisión: ±{endPoint.accuracy.toFixed(1)}m
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Puntos intermedios (en vivo: muestreados para no saturar el DOM) */}
        {(liveMarkerIdx ?? trackPoints.map((_, i) => i)).map((index) => {
          const point = trackPoints[index]
          if (!point) return null
          const r = liveRecording ? 3 : 8
          return (
            <CircleMarker
              key={liveRecording ? `live-tp-${index}` : index}
              center={[point.latitude, point.longitude]}
              radius={r}
              color={liveRecording ? hexToRgba(recordingAccent, 0.55) : '#38bdf8'}
              fillColor={liveRecording ? recordingAccent : '#0ea5e9'}
              fillOpacity={liveRecording ? 0.2 : 0.6}
              weight={1}
              eventHandlers={{
                click: (e) => {
                  e.originalEvent.stopPropagation()
                  if (isDrawing) {
                    onPointRemove(index)
                  }
                },
              }}
            >
              <Popup>
                <div className="p-2">
                  <strong>Punto {index + 1}</strong>
                  <p className="text-xs text-gray-500 mt-1">
                    {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
                  </p>
                  {point.altitude != null && (
                    <p className="text-xs text-gray-400">
                      Altitud: {point.altitude.toFixed(0)}m
                    </p>
                  )}
                  {isDrawing && (
                    <p className="text-xs text-blue-500 mt-2">
                      Click para eliminar
                    </p>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          )
        })}

        {/* Línea de la ruta (tiempo real en grabación) */}
        {allPoints.length > 1 && (
          <Polyline
            key={liveRecording ? `live-line-${allPoints.length}` : 'line'}
            positions={allPoints.map((p) => [p.latitude, p.longitude] as [number, number])}
            color={liveLineColor}
            weight={liveRecording ? 2.5 : 5}
            opacity={liveRecording ? 1 : 0.92}
            dashArray={isDrawing ? '10, 10' : undefined}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {liveRecording && (
          <LiveRecordingMapFollower enabled={liveRecording} allLinePoints={allPoints} />
        )}

        {flyToWhenReady != null && (
          <FlyToWhenReady target={flyToWhenReady} zoomMin={16} bump={flyToBump} />
        )}

        {/* Manejador de eventos */}
        <MapEventHandler onMapClick={handleMapClick} onMapReady={handleMapReady} />

        {/* Tracker de ubicación del usuario (solo al dibujar ruta en editor) */}
        <UserLocationTracker
          onLocationUpdate={handleLocationUpdate}
          enabled={isDrawing && !liveRecording}
        />
      </MapContainer>

      {/* Overlay de instrucciones y selección - CON Z-INDEX ALTO PARA ESTAR ENCIMA DEL MAPA */}
      {isDrawing && (
        <div className="absolute top-4 left-4 bg-slate-900/95 backdrop-blur-sm border border-slate-600 rounded-lg shadow-xl p-4 max-w-xs text-slate-100" style={{ zIndex: 9999 }}>
          <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
            <Navigation size={18} className="text-amber-400" />
            Dibujar Ruta
          </h3>

          <div className="mb-4 pb-4 border-b border-slate-600">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-3 h-3 rounded-full ${startPoint ? 'bg-green-500' : 'bg-slate-600'}`} />
              <span className="text-sm text-slate-300">Partida {startPoint ? '✓' : ''}</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-3 h-3 rounded-full ${endPoint ? 'bg-red-500' : 'bg-slate-600'}`} />
              <span className="text-sm text-slate-300">Meta {endPoint ? '✓' : ''}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-sky-500" />
              <span className="text-sm text-slate-300">Intermedios</span>
              <span className="text-xs bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-full ml-auto">
                {trackPoints.length}
              </span>
            </div>
          </div>

          {startPoint && !endPoint && !pointSelectionMode && (
            <button
              type="button"
              onClick={() => startPointSelection?.('end')}
              className="w-full mb-3 py-2.5 px-3 bg-amber-500 hover:bg-amber-400 text-slate-900 text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg"
            >
              Siguiente: marcar meta
              <ChevronRight size={18} />
            </button>
          )}

          {endPoint && !pointSelectionMode && (
            <button
              type="button"
              onClick={() => startPointSelection?.('intermediate')}
              className="w-full mb-3 py-2 px-3 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              Siguiente: puntos del trazado
              <ChevronRight size={16} />
            </button>
          )}

          {startPoint && !pointSelectionMode && (
            <div className="space-y-2">
              <p className="text-sm text-slate-400 mb-2">
                {!endPoint ? 'O elige en el mapa / buscador' : 'Refina el recorrido con puntos intermedios'}
              </p>

              {!endPoint ? (
                <>
                  <button
                    onClick={() => startPointSelection?.('end')}
                    className="w-full py-2 px-3 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                  >
                    <MapPin size={16} />
                    Tocar mapa: meta
                  </button>
                  
                  <button
                    onClick={() => startPointSelection?.('intermediate')}
                    className="w-full py-2 px-3 bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Navigation size={16} />
                    Punto intermedio (mapa)
                  </button>

                  {isGeolocationAvailable && (
                    <button
                      onClick={() => {
                        onUseCurrentLocation?.()
                      }}
                      className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                      <Navigation size={16} />
                      Mi ubicación
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    onClick={() => startPointSelection?.('intermediate')}
                    className="w-full py-2 px-3 bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Navigation size={16} />
                    Otro intermedio
                  </button>
                  
                  {isGeolocationAvailable && (
                    <button
                      onClick={() => {
                        onUseCurrentLocation?.()
                      }}
                      className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                      <Navigation size={16} />
                      Mi ubicación
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {pointSelectionMode && (
            <div className="space-y-3">
              <div
                className={`p-3 rounded-lg border-2 ${
                  pointSelectionMode === 'start'
                    ? 'bg-green-950/80 border-green-500'
                    : pointSelectionMode === 'end'
                      ? 'bg-red-950/80 border-red-500'
                      : 'bg-sky-950/80 border-sky-500'
                }`}
              >
                <p className="text-sm font-medium mb-1 flex items-center gap-2 text-white">
                  {pointSelectionMode === 'start' && <MapPin className="text-green-400" size={16} />}
                  {pointSelectionMode === 'end' && <MapPin className="text-red-400" size={16} />}
                  {pointSelectionMode === 'intermediate' && <Navigation className="text-sky-400" size={16} />}
                  {pointSelectionMode === 'start' && 'Toca el mapa: INICIO'}
                  {pointSelectionMode === 'end' && 'Toca el mapa: META'}
                  {pointSelectionMode === 'intermediate' && 'Toca el mapa: punto intermedio'}
                </p>
              </div>

              <button
                onClick={cancelPointSelection}
                className="w-full py-2 px-3 bg-slate-600 hover:bg-slate-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-slate-600">
            <p className="text-xs text-slate-500">
              Total puntos: <span className="font-medium text-slate-200">{allPoints.length}</span>
            </p>
          </div>

          <div className="absolute -top-2 -right-2 bg-slate-800 border border-slate-600 rounded-full shadow-lg p-2" title="Mapa oscuro">
            <Layers size={16} className="text-amber-400" />
          </div>
        </div>
      )}
    </div>
  )
}

// Componente de visualización de ruta (solo lectura)
interface RouteMapViewerProps {
  startPoint: MapPoint
  endPoint: MapPoint
  trackPoints: MapPoint[]
  center?: [number, number]
  zoom?: number
}

export function RouteMapViewer({
  startPoint,
  endPoint,
  trackPoints,
  center,
  zoom = 18, // Zoom máximo detalle
}: RouteMapViewerProps) {
  const allPoints = [startPoint, ...trackPoints, endPoint]

  // Calcular centro si no se proporciona
  if (!center && allPoints.length > 0) {
    const sumLat = allPoints.reduce((sum, p) => sum + p.latitude, 0)
    const sumLng = allPoints.reduce((sum, p) => sum + p.longitude, 0)
    center = [sumLat / allPoints.length, sumLng / allPoints.length]
  }

  return (
    <MapContainer
      center={center || [-13.5319, -71.9675]} // Cusco por defecto
      zoom={zoom}
      className="w-full h-full rounded-lg map-dark-ui"
      style={{ minHeight: '300px', background: APP_MAP_CANVAS_HEX }}
      scrollWheelZoom={false}
    >
      <TileLayer {...tileLayerPresetProps(DARK_MAP_TILE)} />

      {startPoint && (
        <Marker
          key={`v-s-${startPoint.latitude}-${startPoint.longitude}`}
          position={[startPoint.latitude, startPoint.longitude]}
          icon={startIcon}
        />
      )}

      {endPoint && (
        <Marker
          key={`v-e-${endPoint.latitude}-${endPoint.longitude}`}
          position={[endPoint.latitude, endPoint.longitude]}
          icon={endIcon}
        />
      )}

      {trackPoints.map((point, index) => (
        <CircleMarker
          key={index}
          center={[point.latitude, point.longitude]}
          radius={6}
          color="#3b82f6"
          fillColor="#3b82f6"
          fillOpacity={0.5}
        />
      ))}

      {allPoints.length > 1 && (
        <Polyline
          positions={allPoints.map((p) => [p.latitude, p.longitude] as [number, number])}
          color="#fbbf24"
          weight={5}
          opacity={0.9}
        />
      )}
    </MapContainer>
  )
}
