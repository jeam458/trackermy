'use client'

import { useState, useEffect, useLayoutEffect, useRef, useId, useMemo, useCallback, Suspense } from 'react'
import { animate } from 'animejs'
import dynamic from 'next/dynamic'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/core/infrastructure/supabase/client'
import { User } from '@/core/domain/User'
import type { Route } from '@/core/domain/Route'
import { RouteMapEditorDynamic } from '@/components/routes/MapWrapper'
import {
  useGPSRecorder,
  formatTime,
  formatDistance,
  formatSpeed,
  type MapPoint,
} from '@/hooks/useGPSRecorder'
import { GPSTrackProcessingService } from '@/core/application/CreateRouteUseCase'
import { DEFAULT_GPS_FILTER_CONFIG } from '@/core/domain/GPSTrack'
import { SupabaseRouteRepository } from '@/core/infrastructure/repositories/SupabaseRouteRepository'
import { ProfileRepository } from '@/core/infrastructure/repositories/ProfileRepository'
import { MAP_AVATAR_THUMB_IMG_CLASS } from '@/components/routes/mapTheme'
import {
  ensureLocationForRecording,
  getQuickPosition,
  haversineMeters,
  openAppLocationSettings,
} from '@/services/recordingLocationPreflight'
import { buildRouteAttemptInsert } from '@/lib/routeAttemptInsert'
import { appendExtrapolatedFinishMetaGps } from '@/lib/routeAttemptGateTiming'
import { toast } from '@/lib/toast'
import { getAuthUserOrNull } from '@/lib/authSession'
import { logRouteTrackDiagnostics } from '@/lib/routeTrackDiagnostics'
import { PageLoadingShimmer } from '@/components/ui/PageLoadingShimmer'
import { routeViewUrl } from '@/lib/routeViewNavigation'
import { tryPersistRouteIconFromLocalAi } from '@/lib/refineRouteIconWithLocalAi'
import { snapGpsPointsToPublishedRoute } from '@/lib/snapGpsToReferenceRoute'
import {
  ROUTE_ATTEMPT_MAX_OFF_ROUTE_M,
  ROUTE_ATTEMPT_START_END_RADIUS_M,
} from '@/lib/routeAttemptConstants'
import type { RouteAttemptGatesConfig } from '@/hooks/useGPSRecorder'
import {
  applyOsmSnapsToProcessedTrack,
} from '@/lib/trackSnapPipeline'
import { applyOfflineHmmSnapToProcessedTrackIfAvailable } from '@/lib/offlineHmmSnap'
import type { RouteTrackType } from '@/core/domain/Route'
import { RoutePerformanceService, type GPSPoint } from '@/services/RoutePerformanceService'
import { RecordRouteSelectionPanel } from './components/RecordRouteSelectionPanel'
import { RecordingControlsBar } from './components/RecordingControlsBar'
import { RecordExistingRouteStatus } from './components/RecordExistingRouteStatus'
import { RecordSaveModal } from './components/RecordSaveModal'
import { CountdownOverlay } from './components/CountdownOverlay'
import { EntryChoiceModal } from './components/EntryChoiceModal'
import { RecordingStatsPanel } from './components/RecordingStatsPanel'
import { RouteSetupPanel } from './components/RouteSetupPanel'
import { CreateRouteModal } from './components/CreateRouteModal'
import { DASHBOARD_BOTTOM_NAV_Z_INDEX } from '@/app/dashboard/components/DashboardBottomNav'
import {
  DashboardAppTopBar,
  DashboardAppTopBarHeading,
  DASHBOARD_APP_TOP_BAR_ICON_BUTTON_CLASS,
  DashboardAppTopBarTrailingCluster,
} from '@/app/dashboard/components/DashboardAppTopBar'
import { RECORD_SCREEN_ENTRY_QUERY } from '@/lib/recordScreenEntry'
import { cn } from '@/lib/utils'
import { downloadTileRegion, listOfflineTileRegions } from '@/lib/tileOfflineCache'
import {
  PlusCircle,
  X,
  Navigation,
  Crosshair,
  Maximize2,
  Minimize2,
} from 'lucide-react'

const SelectedRoutePreviewMap = dynamic(
  () =>
    import('@/components/routes/SelectedRoutePreviewMap').then((m) => ({
      default: m.SelectedRoutePreviewMap,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-32 rounded-xl border border-white/10 bg-gdh-card flex items-center justify-center text-sm text-slate-500">
        Cargando vista previa del mapa…
      </div>
    ),
  }
)

/** Misma escala que el radio de salida del intento: hay que estar cerca del partidor para armar. */
const PROXIMITY_START_M = ROUTE_ATTEMPT_START_END_RADIUS_M
const COUNTDOWN_STROKE_LEN = 264
const RECORD_DEEP_LINK_CACHE_KEY = 'record:deep-link-route-id'

/** Longitud del trazado en km si la BD viene en 0 o vacía */
function routePathKmFromTrack(r: Route): number {
  const pts = r.trackPoints
  if (pts.length < 2) return 0
  let m = 0
  for (let i = 1; i < pts.length; i++) {
    m += haversineMeters(
      pts[i - 1].latitude,
      pts[i - 1].longitude,
      pts[i].latitude,
      pts[i].longitude
    )
  }
  return m / 1000
}

function routeDisplayKm(r: Route): number {
  const fromTrack = routePathKmFromTrack(r)
  if (r.distanceKm > 0) return r.distanceKm
  return fromTrack
}

/** Longitud del trazado GPS en km (misma lógica que la UI de grabación). */
function pathLengthKmFromPoints(points: MapPoint[]): number {
  if (points.length < 2) return 0
  let totalM = 0
  const R = 6371000
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    const dLat = ((b.latitude - a.latitude) * Math.PI) / 180
    const dLng = ((b.longitude - a.longitude) * Math.PI) / 180
    const h =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((a.latitude * Math.PI) / 180) *
        Math.cos((b.latitude * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
    totalM += R * c
  }
  return totalM / 1000
}

function suggestFreeRouteName(now = new Date()): string {
  const dd = String(now.getDate()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mi = String(now.getMinutes()).padStart(2, '0')
  return `Ruta libre ${dd}/${mm} ${hh}:${mi}`
}

function exportedToGpsPoints(exported: MapPoint[]): GPSPoint[] {
  let lastMs = Date.now()
  const timestamps = exported.map((p, i) => {
    const t = p.timestamp ?? new Date(lastMs + (i === 0 ? 0 : 1000))
    lastMs = t.getTime()
    return t
  })

  return exported.map((p, i) => {
    const timestamp = timestamps[i]!
    let speed: number | null = null
    if (i > 0) {
      const prev = exported[i - 1]!
      const prevTs = timestamps[i - 1]!
      const dt = (timestamp.getTime() - prevTs.getTime()) / 1000
      if (dt > 0) {
        const d = haversineMeters(
          prev.latitude,
          prev.longitude,
          p.latitude,
          p.longitude
        )
        speed = d / dt
      }
    }
    return {
      latitude: p.latitude,
      longitude: p.longitude,
      altitude: p.altitude ?? null,
      speed,
      timestamp,
      accuracy: p.accuracy,
    }
  })
}

type RecordPresetFromUrlProps = {
  routes: Route[]
  routesLoading: boolean
  pickRecordingRoute: (r: Route, source: 'list' | 'url') => Promise<boolean>
  onDeepLinkPresetApplied: () => void
  onUrlRouteIdChange: (routeId: string | null) => void
}

/**
 * Desde ficha de ruta: `/dashboard/routes/record?routeId=…` → misma selección que al elegir ruta en el buscador.
 */
function RecordPresetFromUrl({
  routes,
  routesLoading,
  pickRecordingRoute,
  onDeepLinkPresetApplied,
  onUrlRouteIdChange,
}: RecordPresetFromUrlProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const routeIdFromUrl = (searchParams.get('routeId') ?? '').trim() || null
  const lastHandledRef = useRef<string | null>(null)

  useEffect(() => {
    if (!routeIdFromUrl) {
      lastHandledRef.current = null
      return
    }
    if (lastHandledRef.current && lastHandledRef.current !== routeIdFromUrl) {
      lastHandledRef.current = null
    }
    onUrlRouteIdChange(routeIdFromUrl)
  }, [routeIdFromUrl, onUrlRouteIdChange])

  useEffect(() => {
    if (!routeIdFromUrl) {
      lastHandledRef.current = null
      return
    }
    if (routesLoading) return

    const run = async () => {
      if (lastHandledRef.current === routeIdFromUrl) return
      lastHandledRef.current = routeIdFromUrl

      // Siempre rehidratar con GET por id:
      // - evitamos depender de `routes` parcial (a veces llega sin trackPoints completos)
      // - dejamos el `routeId` en la URL para que el page pueda mantener el estado.
      try {
        const repo = new SupabaseRouteRepository()
        const fetched = await repo.getRouteById(routeIdFromUrl)
        if (!fetched) {
          toast.error('Error', 'No se pudo cargar la ruta para grabación.')
          return
        }
        if (process.env.NODE_ENV === 'development') {
          logRouteTrackDiagnostics('RecordPresetFromUrl/fetch-always', fetched)
        }
        const ok = await pickRecordingRoute(fetched, 'url')
        if (ok) {
          onDeepLinkPresetApplied()
        }
      } catch {
        toast.error('Error', 'No se pudo cargar la ruta para grabación.')
      }
    }

    void run()
  }, [
    routes,
    routesLoading,
    routeIdFromUrl,
    pickRecordingRoute,
    router,
    onDeepLinkPresetApplied,
    onUrlRouteIdChange,
  ])

  return null
}

export default function RecordRoutePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const countdownGradientId = useId().replace(/:/g, '')
  const recordingTargetRef = useRef<'new' | { routeId: string }>('new')
  const [user, setUser] = useState<User | null>(null)
  /** 3 → 2 → 1 → inicia grabación */
  const [armCountdown, setArmCountdown] = useState<number | null>(null)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [routeName, setRouteName] = useState('')
  const [routeDescription, setRouteDescription] = useState('')
  const [createRouteModalOpen, setCreateRouteModalOpen] = useState(false)
  const [entryChoiceModalOpen, setEntryChoiceModalOpen] = useState(false)
  const [newRouteDraftName, setNewRouteDraftName] = useState('')
  const [newRouteDraftDescription, setNewRouteDraftDescription] = useState('')
  const entryChoiceShownRef = useRef(false)
  const [newRouteSelectedName, setNewRouteSelectedName] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [stopGateError, setStopGateError] = useState<string | null>(null)
  const [trackType, setTrackType] = useState<RouteTrackType>('trail')
  const [useOsmRoadSnap, setUseOsmRoadSnap] = useState(false)
  const [useOsmTrailSnap, setUseOsmTrailSnap] = useState(false)
  const [routes, setRoutes] = useState<Route[]>([])
  const [routesLoading, setRoutesLoading] = useState(true)
  /** null = nueva ruta libre */
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
  /** Snapshot estable de la ruta elegida para grabar (evita perder preview si se refresca el listado). */
  const [selectedRouteSnapshot, setSelectedRouteSnapshot] = useState<Route | null>(null)
  /** Llegada desde ficha con `?routeId=` → UI compacta sin buscador. */
  const [recordingEntryFromDetail, setRecordingEntryFromDetail] = useState(false)
  /** Mientras la URL lleva `?routeId=` (preset en curso o lista aún cargando). */
  const [urlRecordRouteId, setUrlRecordRouteId] = useState<string | null>(null)

  /** Sync inmediato con ?routeId= antes del modal de entrada (evita condición de carrera con RecordPresetFromUrl). */
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return
    if (!pathname?.includes('/dashboard/routes/record')) return
    const id = (new URLSearchParams(window.location.search).get('routeId') ?? '').trim()
    if (!id) return
    setUrlRecordRouteId(id)
    setRecordingEntryFromDetail(true)
    setEntryChoiceModalOpen(false)
    entryChoiceShownRef.current = true
    try {
      window.sessionStorage.setItem(
        RECORD_DEEP_LINK_CACHE_KEY,
        JSON.stringify({ id, ts: Date.now() })
      )
    } catch {
      /* noop */
    }
  }, [pathname])

  useEffect(() => {
    if (!urlRecordRouteId) return
    setEntryChoiceModalOpen(false)
    entryChoiceShownRef.current = true
  }, [urlRecordRouteId])

  const [recordingPickQuery, setRecordingPickQuery] = useState('')
  const [recordingSearchHits, setRecordingSearchHits] = useState<Route[]>([])
  const [recordingSearchBusy, setRecordingSearchBusy] = useState(false)
  const [recordingPickFocused, setRecordingPickFocused] = useState(false)
  /** Tras pulsar «Centrar mapa en mi GPS»: mostrar marcador con foto del rider (no en la carga inicial silenciosa). */
  const [mapShowsRiderAvatar, setMapShowsRiderAvatar] = useState(false)
  /** Panel de búsqueda / OSM: mapa a pantalla casi completa. */
  const [routeSetupOpen, setRouteSetupOpen] = useState(false)
  /** Modo compacto: solo buscador + selector de ruta existente. */
  const [routeSetupExistingOnly, setRouteSetupExistingOnly] = useState(false)
  /** Solo con icono maximizar; por defecto el mapa tiene alto acotado (barra inferior siempre visible). */
  const [mapMaximized, setMapMaximized] = useState(false)
  const [distanceToStartM, setDistanceToStartM] = useState<number | null>(null)
  const [checkingPosition, setCheckingPosition] = useState(false)
  const [startingArm, setStartingArm] = useState(false)
  /** Copia al detener grabación para el modal (evita leer solo ref en JSX). */
  const [saveContext, setSaveContext] = useState<'new' | { routeId: string }>('new')
  /** Primer GPS para centrar mapa antes de grabar */
  const [mapBootstrapPos, setMapBootstrapPos] = useState<[number, number] | null>(null)
  const [mapFlyBump, setMapFlyBump] = useState(0)
  /** Icono pequeño para mapa al grabar (map_avatar_url del perfil). */
  const [mapAvatarUrl, setMapAvatarUrl] = useState<string | null>(null)
  const [bikeMapIconUrl, setBikeMapIconUrl] = useState<string | null>(null)
  const [bikeColorHex, setBikeColorHex] = useState<string | null>(null)
  /** Polilínea de OSM descargada (prioridad para map-matching bajo "Nueva ruta") */
  const [osmMapPath, setOsmMapPath] = useState<Array<{ latitude: number; longitude: number }> | null>(
    null
  )
  const [osmMapLoading, setOsmMapLoading] = useState(false)
  const [osmMapError, setOsmMapError] = useState<string | null>(null)
  const [tileDownloadBusy, setTileDownloadBusy] = useState(false)
  const [tileDownloadProgress, setTileDownloadProgress] = useState<{ done: number; total: number } | null>(null)
  const [offlineTileRegionsCount, setOfflineTileRegionsCount] = useState(0)

  const selectedRouteForPreview = useMemo(() => {
    if (!selectedRouteId) return null
    const fromList = routes.find((x) => x.id === selectedRouteId) ?? null
    const snap =
      selectedRouteSnapshot && selectedRouteSnapshot.id === selectedRouteId
        ? selectedRouteSnapshot
        : null
    if (!fromList && !snap) return null
    if (!fromList) return snap
    if (!snap) return fromList
    const lc = fromList.trackPoints?.length ?? 0
    const sc = snap.trackPoints?.length ?? 0
    const listOk = lc >= 2
    const snapOk = sc >= 2
    if (snapOk && !listOk) return snap
    if (listOk && !snapOk) return fromList
    if (listOk && snapOk) return sc >= lc ? snap : fromList
    return sc >= lc ? snap : fromList
  }, [selectedRouteId, routes, selectedRouteSnapshot])

  const mapMatchPath = useMemo(() => {
    if (selectedRouteForPreview && selectedRouteForPreview.trackPoints.length >= 2) {
      return selectedRouteForPreview.trackPoints.map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
      }))
    }
    if (osmMapPath && osmMapPath.length >= 2) {
      return osmMapPath
    }
    return null
  }, [selectedRouteForPreview, osmMapPath])

  const routeAttemptGates = useMemo((): RouteAttemptGatesConfig | null => {
    const r = selectedRouteForPreview
    if (!r || r.trackPoints.length < 2) return null
    const sorted = [...r.trackPoints].sort((a, b) => a.orderIndex - b.orderIndex)
    return {
      startLat: r.startCoord[0],
      startLng: r.startCoord[1],
      endLat: r.endCoord[0],
      endLng: r.endCoord[1],
      startEndRadiusM: ROUTE_ATTEMPT_START_END_RADIUS_M,
      maxOffRouteM: ROUTE_ATTEMPT_MAX_OFF_ROUTE_M,
      referencePath: sorted.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
    }
  }, [selectedRouteForPreview])

  // Hook de grabación GPS
  const {
    isRecording,
    isPaused,
    points,
    elapsedTime,
    currentAccuracy,
    currentSpeed,
    maxSessionSpeedMps,
    error: gpsError,
    awaitingStartGate,
    routeAttemptOffRoute,
    distanceMetersToStart,
    distanceMetersToEnd,
    routeAttemptGateTiming,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearRecording,
    exportPoints,
  } = useGPSRecorder({
    recordingInterval: 1000,
    minAccuracy: 22,
    minDistance: 2,
    maxSpeedMps: 40,
    minBearingChangeForAcceptDeg: 6,
    stallResampleAfterMs: 5000,
    mapMatchPath: mapMatchPath && mapMatchPath.length >= 2 ? mapMatchPath : null,
    routeAttemptGates: routeAttemptGates,
    liveKalmanEnabled: true,
    hardRejectAccuracyM: 20,
  })

  useEffect(() => {
    if (!gpsError) return
    const body = gpsError.startsWith('Error de GPS') ? gpsError : `Error de GPS: ${gpsError}`
    toast.error('Error de GPS', `${body} Revisa permisos o abre ajustes de ubicación si hace falta.`, {
      duration: 10000,
    })
  }, [gpsError])

  // Usuario: sesión local primero; perfil en segundo plano para no bloquear lista de rutas / mapa.
  useEffect(() => {
    void (async () => {
      const supaUser = await getAuthUserOrNull()
      if (!supaUser) return

      const metaAvatar = supaUser.user_metadata?.avatarUrl as string | undefined
      setUser({
        id: supaUser.id,
        email: supaUser.email || '',
        fullName:
          (supaUser.user_metadata?.fullName as string | undefined) ||
          supaUser.email?.split('@')[0] ||
          'Usuario',
        avatarUrl: metaAvatar,
      })

      void (async () => {
        let avatar: string | undefined = metaAvatar
        let mapA: string | null = null
        try {
          const profileRepo = new ProfileRepository()
          const prof = await profileRepo.getProfile(supaUser.id)
          if (prof?.avatar_url) avatar = prof.avatar_url
          mapA = prof?.map_avatar_url ?? null
          setBikeMapIconUrl(prof?.bike_map_icon_url ?? null)
          const ch = prof?.color_hex?.trim()
          setBikeColorHex(ch && /^#[0-9A-Fa-f]{6}$/.test(ch) ? ch : null)
        } catch (e) {
          console.warn('Perfil para grabación:', e)
        }
        setMapAvatarUrl(mapA)
        setUser((prev) =>
          prev && prev.id === supaUser.id
            ? {
                ...prev,
                avatarUrl: avatar ?? prev.avatarUrl,
              }
            : prev
        )
      })()
    })()
  }, [])

  useEffect(() => {
    if (!user) return
    const load = async () => {
      setRoutesLoading(true)
      try {
        const repo = new SupabaseRouteRepository()
        const [mine, pub] = await Promise.all([
          repo.getUserRoutes(user.id),
          repo.getPublicRoutes(35, 0),
        ])
        const byId = new Map<string, Route>()
        for (const r of pub) byId.set(r.id, r)
        for (const r of mine) byId.set(r.id, r)
        setRoutes(
          Array.from(byId.values()).sort((a, b) =>
            a.name.localeCompare(b.name, 'es')
          )
        )
      } catch (e) {
        console.error(e)
      } finally {
        setRoutesLoading(false)
      }
    }
    void load()
  }, [user])

  useEffect(() => {
    if (!user) return
    const q = recordingPickQuery.trim()
    if (!q) {
      setRecordingSearchHits([])
      setRecordingSearchBusy(false)
      return
    }
    setRecordingSearchBusy(true)
    const t = window.setTimeout(() => {
      const repo = new SupabaseRouteRepository()
      repo
        .searchRoutesForRecording(user.id, q, 45)
        .then(setRecordingSearchHits)
        .catch((e) => {
          console.error(e)
          setRecordingSearchHits([])
        })
        .finally(() => setRecordingSearchBusy(false))
    }, 300)
    return () => window.clearTimeout(t)
  }, [recordingPickQuery, user])

  const pickRecordingRoute = useCallback(
    async (r: Route, source: 'list' | 'url' = 'list'): Promise<boolean> => {
      if (source === 'list') {
        setRecordingEntryFromDetail(false)
        if (typeof window !== 'undefined') {
          window.sessionStorage.removeItem(RECORD_DEEP_LINK_CACHE_KEY)
        }
      }
      if (source === 'url') {
        // Al elegir desde la ficha, la UI debe ser la del flujo compacto (sin buscador).
        setRecordingEntryFromDetail(true)
        if (typeof window !== 'undefined') {
          const payload = JSON.stringify({ id: r.id, ts: Date.now() })
          window.sessionStorage.setItem(RECORD_DEEP_LINK_CACHE_KEY, payload)
        }
      }
      // Desde ficha (?routeId=): la ruta y el mapa deben mostrarse aunque el GPS falle al entrar;
      // el listado exige ubicación antes de elegir (comportamiento anterior).
      if (source === 'list') {
        const loc = await ensureLocationForRecording()
        if (!loc.ok) {
          toast.warning('Activa tu GPS', loc.message, { duration: 6500 })
          if (loc.openSettings) void openAppLocationSettings()
          return false
        }
      }

      setSelectedRouteId(r.id)
      setSelectedRouteSnapshot(r)
      if (process.env.NODE_ENV === 'development') {
        logRouteTrackDiagnostics(`pickRecordingRoute(${source})`, r)
      }
      setRoutes((prev) => {
        if (prev.some((x) => x.id === r.id)) return prev
        return [...prev, r].sort((a, b) => a.name.localeCompare(b.name, 'es'))
      })
      setRecordingPickQuery('')
      setRecordingSearchHits([])
      setRecordingPickFocused(false)
      setRouteSetupOpen(false)
      setNewRouteSelectedName(null)
      setOsmMapPath(null)
      setOsmMapError(null)

      if (source === 'url') {
        const loc = await ensureLocationForRecording()
        if (!loc.ok) {
          toast.warning('Activa tu GPS', loc.message, { duration: 6500 })
          if (loc.openSettings) void openAppLocationSettings()
        }
      }

      try {
        const pos = await getQuickPosition()
        setMapBootstrapPos([pos.latitude, pos.longitude])
        setMapShowsRiderAvatar(true)
        setMapFlyBump((n) => n + 1)
        const d = haversineMeters(pos.latitude, pos.longitude, r.startCoord[0], r.startCoord[1])
        setDistanceToStartM(d)
        if (d > PROXIMITY_START_M) {
          toast.warning(
            'Aún lejos del partidor',
            `Estás a ${Math.round(d)} m del inicio. Acércate a ≤ ${PROXIMITY_START_M} m para habilitar «Iniciar ruta».`,
            { duration: 7800 }
          )
        } else {
          toast.success('Ruta lista', `Estás a ${Math.round(d)} m del partidor.`)
        }
      } catch {
        setDistanceToStartM(null)
      }
      return true
    },
    []
  )

  const clearRecordingRouteSelection = useCallback((opts?: { force?: boolean }) => {
    const force = opts?.force === true
    if (!force) {
      const hasActiveUrlRouteId =
        !!urlRecordRouteId ||
        (typeof window !== 'undefined' &&
          !!new URL(window.location.href).searchParams.get('routeId')?.trim())
      if (hasActiveUrlRouteId) {
        return
      }
    }
    setRecordingEntryFromDetail(false)
    setSelectedRouteId(null)
    setSelectedRouteSnapshot(null)
    setNewRouteSelectedName(null)
    setRecordingPickQuery('')
    setRecordingSearchHits([])
    setRecordingPickFocused(false)
    setOsmMapPath(null)
    setOsmMapError(null)
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(RECORD_DEEP_LINK_CACHE_KEY)
    }
  }, [urlRecordRouteId])

  const handleUrlRecordRouteIdChange = useCallback((id: string | null) => {
    setUrlRecordRouteId(id)
    // Al llegar desde detalle (?routeId=...), activamos modo compacto de inmediato
    // para evitar flashes de la UI de búsqueda antes de que termine el preset.
    if (id) {
      setRecordingEntryFromDetail(true)
      if (typeof window !== 'undefined') {
        const payload = JSON.stringify({ id, ts: Date.now() })
        window.sessionStorage.setItem(RECORD_DEEP_LINK_CACHE_KEY, payload)
      }
    }
  }, [])

  useEffect(() => {
    if (!urlRecordRouteId) return
    if (selectedRouteForPreview) return
    if (!user) return

    let cancelled = false
    void (async () => {
      let r = routes.find((x) => x.id === urlRecordRouteId) ?? null
      if (!r) {
        try {
          const repo = new SupabaseRouteRepository()
          const fetched = await repo.getRouteById(urlRecordRouteId)
          if (!fetched) return
          if (process.env.NODE_ENV === 'development') {
            logRouteTrackDiagnostics('deepLinkFallback/fetch-missing', fetched)
          }
          if (fetched.trackPoints.length < 2) {
            toast.warning(
              'Trazado incompleto',
              'Esta ruta no tiene puntos suficientes para dibujarla en el mapa.'
            )
          }
          r = fetched
        } catch {
          return
        }
      }
      if (cancelled || !r) return
      setSelectedRouteId(r.id)
      setSelectedRouteSnapshot(r)
      if (process.env.NODE_ENV === 'development') {
        logRouteTrackDiagnostics('deepLinkFallback/applied', r)
      }
      setRoutes((prev) => {
        if (prev.some((x) => x.id === r.id)) return prev
        return [...prev, r].sort((a, b) => a.name.localeCompare(b.name, 'es'))
      })
      setNewRouteSelectedName(null)
      setOsmMapPath(null)
      setOsmMapError(null)
      try {
        const pos = await getQuickPosition()
        if (cancelled) return
        setMapBootstrapPos([pos.latitude, pos.longitude])
        setMapShowsRiderAvatar(true)
        setMapFlyBump((n) => n + 1)
        const d = haversineMeters(pos.latitude, pos.longitude, r.startCoord[0], r.startCoord[1])
        setDistanceToStartM(d)
      } catch {
        if (cancelled) return
        setDistanceToStartM(null)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [urlRecordRouteId, selectedRouteForPreview, user, routes])

  /** Trazo del catálogo (intento / referencia en mapa). Sin ruta seleccionada → null (flujo “nueva ruta libre”). */
  const publishedReferencePathPoints = useMemo((): MapPoint[] | null => {
    const r = selectedRouteForPreview
    // Para sonar y marcador de salida basta con >=1 punto.
    // Para polilínea se requieren >=2 (lo maneja `RouteMapEditorDynamic` con los props).
    if (!r || r.trackPoints.length < 1) return null
    const sorted = [...r.trackPoints].sort((a, b) => a.orderIndex - b.orderIndex)
    return sorted.map((tp) => ({ latitude: tp.latitude, longitude: tp.longitude }))
  }, [selectedRouteForPreview])

  /**
   * Posición del rider en el mapa principal: con ruta elegida basta el GPS ya obtenido;
   * en trazado libre solo tras “Centrar mapa en mi GPS”.
   */
  const riderPreviewPoint = useMemo((): MapPoint | null => {
    if (isRecording || !mapBootstrapPos) return null
    if (selectedRouteId != null) {
      return { latitude: mapBootstrapPos[0], longitude: mapBootstrapPos[1] }
    }
    if (mapShowsRiderAvatar) {
      return { latitude: mapBootstrapPos[0], longitude: mapBootstrapPos[1] }
    }
    return null
  }, [isRecording, mapBootstrapPos, mapShowsRiderAvatar, selectedRouteId])

  const recordingPickList = recordingPickQuery.trim() ? recordingSearchHits : routes

  const loadOsmWaysForMapArea = useCallback(async () => {
    if (!mapBootstrapPos) {
      setOsmMapError('Primero centra el mapa en tu GPS o espera a obtener posición.')
      return
    }
    setOsmMapLoading(true)
    setOsmMapError(null)
    try {
      const pad = 0.012
      const [lat, lng] = mapBootstrapPos
      const res = await fetch('/api/osm-ways', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minLat: lat - pad,
          minLng: lng - pad,
          maxLat: lat + pad,
          maxLng: lng + pad,
        }),
      })
      const data = (await res.json()) as {
        path?: Array<{ latitude: number; longitude: number }>
        error?: string
      }
      if (!res.ok) {
        throw new Error(data.error || 'Error al cargar')
      }
      const path = data.path ?? []
      if (path.length < 2) {
        setOsmMapPath(null)
        setOsmMapError('No se encontró una vía caminable en esta área. Prueba otro recorte o zoom.')
        return
      }
      setOsmMapPath(path)
    } catch (e) {
      setOsmMapError(e instanceof Error ? e.message : 'Error al descargar vías')
      setOsmMapPath(null)
    } finally {
      setOsmMapLoading(false)
    }
  }, [mapBootstrapPos])

  const refreshOfflineTileRegionsCount = useCallback(async () => {
    try {
      const rows = await listOfflineTileRegions()
      setOfflineTileRegionsCount(rows.length)
    } catch {
      setOfflineTileRegionsCount(0)
    }
  }, [])

  const downloadOfflineTilesForCurrentArea = useCallback(async () => {
    if (!mapBootstrapPos && !selectedRouteForPreview) {
      toast.warning('Sin referencia de área', 'Primero centra el mapa con GPS o selecciona una ruta.')
      return
    }
    setTileDownloadBusy(true)
    setTileDownloadProgress({ done: 0, total: 1 })
    try {
      let minLat: number
      let minLng: number
      let maxLat: number
      let maxLng: number
      let label: string

      if (selectedRouteForPreview && selectedRouteForPreview.trackPoints.length >= 2) {
        const pts = selectedRouteForPreview.trackPoints
        minLat = Math.min(...pts.map((p) => p.latitude))
        minLng = Math.min(...pts.map((p) => p.longitude))
        maxLat = Math.max(...pts.map((p) => p.latitude))
        maxLng = Math.max(...pts.map((p) => p.longitude))
        const pad = 0.008
        minLat -= pad
        minLng -= pad
        maxLat += pad
        maxLng += pad
        label = `Ruta: ${selectedRouteForPreview.name}`
      } else {
        const [lat, lng] = mapBootstrapPos!
        const pad = 0.015
        minLat = lat - pad
        minLng = lng - pad
        maxLat = lat + pad
        maxLng = lng + pad
        label = 'Zona local'
      }

      const region = await downloadTileRegion({
        name: label,
        minZoom: 13,
        maxZoom: 18,
        minLat,
        minLng,
        maxLat,
        maxLng,
        onProgress: (done, total) => setTileDownloadProgress({ done, total }),
      })
      await refreshOfflineTileRegionsCount()
      toast.success(
        'Zona offline',
        `${region.tileCount} tiles + vías OSM en cache (si Overpass respondió) para snap sin red.`
      )
    } catch (e) {
      toast.error('No se pudo descargar tiles', e instanceof Error ? e.message : 'Intenta nuevamente.')
    } finally {
      setTileDownloadBusy(false)
    }
  }, [mapBootstrapPos, selectedRouteForPreview, refreshOfflineTileRegionsCount])

  const refreshMapBootstrapLocation = useCallback(async (): Promise<boolean> => {
    try {
      const pos = await getQuickPosition()
      setMapBootstrapPos([pos.latitude, pos.longitude])
      setMapShowsRiderAvatar(true)
      setMapFlyBump((n) => n + 1)
      return true
    } catch {
      toast.warning(
        'Sin ubicación',
        'No se pudo obtener tu ubicación. Concede permiso a la app o abre ajustes de ubicación; también puedes usar «Centrar mapa en mi GPS».',
        { duration: 8500 }
      )
      return false
    }
  }, [])

  /** Tramo libre: limpia selección, muestra icono rider y avisa cómo iniciar grabación. */
  const handleNuevaRutaLibre = useCallback(async () => {
    const loc = await ensureLocationForRecording()
    if (!loc.ok) {
      toast.warning('Activa tu GPS', loc.message, { duration: 6500 })
      if (loc.openSettings) void openAppLocationSettings()
      return
    }

    clearRecordingRouteSelection({ force: true })
    setRouteSetupOpen(false)

    let tienePosicionParaRider = false
    if (mapBootstrapPos) {
      setMapShowsRiderAvatar(true)
      setMapFlyBump((n) => n + 1)
      tienePosicionParaRider = true
    } else {
      tienePosicionParaRider = await refreshMapBootstrapLocation()
    }

    if (tienePosicionParaRider) {
      toast.info(
        'Nueva ruta libre',
        'Tu posición se muestra en el mapa con tu icono de rider. Cuando estés listo, pulsa «Iniciar ruta».',
        { duration: 7000 }
      )
    } else {
      toast.warning(
        'Ubicación necesaria',
        'Concede permiso de ubicación o pulsa «Centrar mapa en mi GPS». Después podrás pulsar «Iniciar ruta».',
        { duration: 8500 }
      )
    }
  }, [clearRecordingRouteSelection, mapBootstrapPos, refreshMapBootstrapLocation])

  const handleCreateNewRouteDraft = useCallback(async () => {
    const name = newRouteDraftName.trim()
    if (!name) {
      toast.warning('Falta nombre', 'Ingresa el nombre para tu nueva ruta.')
      return
    }
    setRouteName(name)
    setRouteDescription(newRouteDraftDescription.trim())
    setCreateRouteModalOpen(false)
    setNewRouteDraftName('')
    setNewRouteDraftDescription('')
    await handleNuevaRutaLibre()
    // clearRecordingRouteSelection (dentro de nueva ruta libre) borra newRouteSelectedName; lo restauramos al final.
    setNewRouteSelectedName(name)
  }, [handleNuevaRutaLibre, newRouteDraftDescription, newRouteDraftName])

  /** FAB del bottom nav u otros enlaces: `?entry=free|new|existing` evita el modal inicial y aplica el modo. */
  useLayoutEffect(() => {
    const raw = (searchParams.get(RECORD_SCREEN_ENTRY_QUERY) ?? '').trim()
    if (raw !== 'free' && raw !== 'new' && raw !== 'existing') return

    entryChoiceShownRef.current = true
    setEntryChoiceModalOpen(false)

    const next = new URLSearchParams(searchParams.toString())
    next.delete(RECORD_SCREEN_ENTRY_QUERY)
    const qs = next.toString()
    router.replace(qs ? `/dashboard/routes/record?${qs}` : '/dashboard/routes/record', { scroll: false })

    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      if (raw === 'free') {
        void handleNuevaRutaLibre()
      } else if (raw === 'new') {
        setNewRouteDraftName(routeName)
        setNewRouteDraftDescription(routeDescription)
        setCreateRouteModalOpen(true)
      } else {
        setRouteSetupExistingOnly(true)
        setRouteSetupOpen(true)
      }
    })

    return () => {
      cancelled = true
    }
  }, [searchParams, router, handleNuevaRutaLibre, routeName, routeDescription])

  // Si otro flujo limpia `?routeId=...` inesperadamente, rehidratar desde caché temporal.
  useEffect(() => {
    if (urlRecordRouteId || selectedRouteId) return
    if (typeof window === 'undefined') return
    const raw = window.sessionStorage.getItem(RECORD_DEEP_LINK_CACHE_KEY)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as { id?: string; ts?: number }
      const id = parsed.id?.trim()
      const ts = typeof parsed.ts === 'number' ? parsed.ts : 0
      if (!id) {
        window.sessionStorage.removeItem(RECORD_DEEP_LINK_CACHE_KEY)
        return
      }
      // TTL corto para no “secuestrar” la página record en visitas futuras.
      if (Date.now() - ts > 5 * 60 * 1000) {
        window.sessionStorage.removeItem(RECORD_DEEP_LINK_CACHE_KEY)
        return
      }
      router.replace(`/dashboard/routes/record?routeId=${encodeURIComponent(id)}`, {
        scroll: false,
      })
    } catch {
      window.sessionStorage.removeItem(RECORD_DEEP_LINK_CACHE_KEY)
    }
  }, [router, selectedRouteId, urlRecordRouteId])

  // Candado: si estamos en flujo desde detalle y hay ruta seleccionada,
  // nunca dejar la URL sin `routeId`.
  useEffect(() => {
    if (!selectedRouteId || !recordingEntryFromDetail) return
    if (typeof window === 'undefined') return
    const currentId = new URL(window.location.href).searchParams.get('routeId')?.trim() ?? ''
    if (currentId === selectedRouteId) return
    router.replace(
      `/dashboard/routes/record?routeId=${encodeURIComponent(selectedRouteId)}`,
      { scroll: false }
    )
  }, [router, selectedRouteId, recordingEntryFromDetail])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const pos = await getQuickPosition()
        if (!cancelled) {
          setMapBootstrapPos([pos.latitude, pos.longitude])
          setMapFlyBump((n) => n + 1)
        }
      } catch {
        /* sin permiso aún: Cusco por defecto; el usuario puede usar “Centrar en mi GPS” */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (entryChoiceShownRef.current) return
    if (isRecording) return
    if (recordingEntryFromDetail || urlRecordRouteId) return
    if (selectedRouteId) return
    entryChoiceShownRef.current = true
    setEntryChoiceModalOpen(true)
  }, [isRecording, recordingEntryFromDetail, selectedRouteId, urlRecordRouteId])

  useEffect(() => {
    if (!routeSetupOpen) return
    void refreshOfflineTileRegionsCount()
  }, [routeSetupOpen, refreshOfflineTileRegionsCount])

  const resolveRouteForDistance = useCallback((): Route | null => {
    if (!selectedRouteId) return null
    return (
      routes.find((r) => r.id === selectedRouteId) ??
      (selectedRouteSnapshot?.id === selectedRouteId ? selectedRouteSnapshot : null)
    )
  }, [selectedRouteId, routes, selectedRouteSnapshot])

  const refreshDistanceToSelectedRoute = useCallback(async () => {
    if (!selectedRouteId) {
      setDistanceToStartM(null)
      return
    }
    const route = resolveRouteForDistance()
    if (!route) return
    setCheckingPosition(true)
    try {
      const pos = await getQuickPosition()
      setDistanceToStartM(
        haversineMeters(
          pos.latitude,
          pos.longitude,
          route.startCoord[0],
          route.startCoord[1]
        )
      )
    } catch {
      setDistanceToStartM(null)
      toast.warning(
        'Sin posición',
        'No se pudo leer tu posición. Permite ubicación para compararte con el inicio de la ruta.',
        { duration: 8500 }
      )
    } finally {
      setCheckingPosition(false)
    }
  }, [selectedRouteId, resolveRouteForDistance])

  useEffect(() => {
    if (!selectedRouteId) {
      setDistanceToStartM(null)
      return
    }
    if (!resolveRouteForDistance()) return
    void refreshDistanceToSelectedRoute()
  }, [selectedRouteId, routes, selectedRouteSnapshot, resolveRouteForDistance, refreshDistanceToSelectedRoute])

  useEffect(() => {
    if (armCountdown === null) return
    if (armCountdown <= 1) {
      const id = window.setTimeout(() => {
        setStopGateError(null)
        startRecording()
        setArmCountdown(null)
      }, 900)
      return () => window.clearTimeout(id)
    }
    const id = window.setTimeout(() => setArmCountdown(armCountdown - 1), 900)
    return () => window.clearTimeout(id)
  }, [armCountdown, startRecording])

  // Calcular distancia total
  const calculateDistance = () => {
    if (points.length < 2) return 0

    let total = 0
    for (let i = 1; i < points.length; i++) {
      const R = 6371000
      const dLat = ((points[i].latitude - points[i - 1].latitude) * Math.PI) / 180
      const dLng = ((points[i].longitude - points[i - 1].longitude) * Math.PI) / 180
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((points[i - 1].latitude * Math.PI) / 180) *
          Math.cos((points[i].latitude * Math.PI) / 180) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      total += R * c
    }
    return total
  }

  const distanceM = calculateDistance()

  // Calcular velocidad promedio
  /** Media de trayecto: distancia / tiempo (no promedio de lecturas) */
  const avgSpeed = elapsedTime > 0 && distanceM > 0 ? distanceM / elapsedTime : 0

  const handleStart = async () => {
    setStartingArm(true)
    try {
      if (selectedRouteId) {
        if (
          distanceToStartM === null ||
          distanceToStartM > PROXIMITY_START_M
        ) {
          toast.warning(
            'Muy lejos del partidor',
            `Para grabar sobre una ruta existente debes estar a menos de ${PROXIMITY_START_M} m de su inicio (ahora: ${distanceToStartM != null ? Math.round(distanceToStartM) : 'sin lectura'} m). Cambia a «Nueva ruta» o acércate al punto de partida.`,
            { duration: 9000 }
          )
          return
        }
        recordingTargetRef.current = { routeId: selectedRouteId }
      } else {
        recordingTargetRef.current = 'new'
      }

      const loc = await ensureLocationForRecording()
      if (!loc.ok) {
        toast.warning('Activa tu GPS', loc.message, { duration: 6500 })
        if (loc.openSettings) void openAppLocationSettings()
        return
      }
      setArmCountdown(3)
    } finally {
      setStartingArm(false)
    }
  }

  // Manejar pausa/reanudar
  const handlePauseResume = () => {
    if (isPaused) {
      resumeRecording()
    } else {
      pauseRecording()
    }
  }

  // Manejar detención (última toma de alta presión al cerrar = trazo hasta el destino real)
  const handleStop = () => {
    setStopGateError(null)
    void stopRecording()
      .then((finalPts) => {
        if (finalPts.length > 1) {
          setSaveContext(
            recordingTargetRef.current === 'new'
              ? 'new'
              : { routeId: recordingTargetRef.current.routeId }
          )
          setShowSaveModal(true)
        }
      })
      .catch((e) => {
        setStopGateError(
          e instanceof Error ? e.message : 'No se pudo finalizar la grabación'
        )
      })
  }

  // Manejar cancelación
  const handleCancel = () => {
    void stopRecording({ flushLastFix: false, skipRouteAttemptValidation: true }).then(() => {
      clearRecording()
      setShowSaveModal(false)
      setRouteName('')
      setRouteDescription('')
      setNewRouteSelectedName(null)
      setSaveError(null)
      setTrackType('trail')
      setUseOsmRoadSnap(false)
      setUseOsmTrailSnap(false)
      setSaveContext('new')
      recordingTargetRef.current = 'new'
    })
  }

  // Manejar guardado: intento en ruta existente o nueva ruta en BD
  const handleSave = async () => {
    if (!user) return

    if (points.length < 2) {
      setSaveError('Se requieren al menos 2 puntos')
      return
    }

    const target = recordingTargetRef.current
    const isAttempt = target !== 'new'

    if (isAttempt && routeAttemptOffRoute) {
      setSaveError(
        `Intento no válido: te alejaste más de ${ROUTE_ATTEMPT_MAX_OFF_ROUTE_M} m de la ruta trazada en más de un tramo.`
      )
      return
    }

    setIsSaving(true)
    setSaveError(null)

    try {
      const exportedPoints = exportPoints()

      if (isAttempt) {
        const routeId = target.routeId
        const perfSvc = new RoutePerformanceService()
        let gpsPoints = exportedToGpsPoints(exportedPoints)
        let routeForSnap = routes.find((r) => r.id === routeId)
        if (!routeForSnap || routeForSnap.trackPoints.length < 2) {
          const repo = new SupabaseRouteRepository()
          const fetched = await repo.getRouteById(routeId)
          if (fetched && fetched.trackPoints.length >= 2) {
            routeForSnap = fetched
          }
        }
        if (routeForSnap && routeForSnap.trackPoints.length >= 2) {
          gpsPoints = snapGpsPointsToPublishedRoute(gpsPoints, routeForSnap)
          gpsPoints = appendExtrapolatedFinishMetaGps(
            gpsPoints,
            routeForSnap.endCoord[0],
            routeForSnap.endCoord[1],
            ROUTE_ATTEMPT_START_END_RADIUS_M
          )
        }
        const performance = perfSvc.analyzePerformance(gpsPoints)
        const supabase = createClient()
        const { error } = await supabase
          .from('route_attempts')
          .insert(
            buildRouteAttemptInsert(
              performance,
              gpsPoints,
              routeId,
              user.id,
              routeAttemptGateTiming
            )
          )
        if (error) throw error
        setIsSaving(false)
        setShowSaveModal(false)
        clearRecording()
        setRouteName('')
        setRouteDescription('')
        setNewRouteSelectedName(null)
        setTrackType('trail')
        setUseOsmRoadSnap(false)
        setUseOsmTrailSnap(false)
        setSaveContext('new')
        recordingTargetRef.current = 'new'
        router.push(routeViewUrl(routeId, 'record'))
        return
      }

      const processingService = new GPSTrackProcessingService({
        ...DEFAULT_GPS_FILTER_CONFIG,
        skipKalmanInPostprocess: true,
      })
      const gpsPointsRaw = exportedPoints.map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
        altitude: p.altitude,
        accuracy: p.accuracy,
        timestamp: p.timestamp,
      }))

      const processed = processingService.processTrack(gpsPointsRaw)
      const snappedProcessed = await applyOsmSnapsToProcessedTrack(processingService, processed, {
        useOsmRoad: useOsmRoadSnap,
        useOsmTrail: useOsmTrailSnap,
      })
      const finalProcessed = await applyOfflineHmmSnapToProcessedTrackIfAvailable(
        processingService,
        snappedProcessed,
        { maxSnapMeters: 85, mode: 'both' }
      )

      const recordedPathKm = pathLengthKmFromPoints(exportedPoints)
      const validation = processingService.validateRoute(
        [exportedPoints[0].latitude, exportedPoints[0].longitude],
        [
          exportedPoints[exportedPoints.length - 1].latitude,
          exportedPoints[exportedPoints.length - 1].longitude,
        ],
        finalProcessed.points,
        { recordedPathKm }
      )

      if (!validation.valid) {
        setSaveError(validation.errors.join(', '))
        setIsSaving(false)
        return
      }

      const perfSvc = new RoutePerformanceService()
      const gpsForAttempt = exportedToGpsPoints(exportedPoints)
      const performance = perfSvc.analyzePerformance(gpsForAttempt)

      const repository = new SupabaseRouteRepository()

      const resolvedRouteName = routeName.trim() || suggestFreeRouteName()

      const created = await repository.createRoute(
        {
          name: resolvedRouteName,
          description: routeDescription.trim() || undefined,
          difficulty: 'Intermediate',
          trackType,
          startCoord: [exportedPoints[0].latitude, exportedPoints[0].longitude],
          endCoord: [
            exportedPoints[exportedPoints.length - 1].latitude,
            exportedPoints[exportedPoints.length - 1].longitude,
          ],
          trackPoints: finalProcessed.points.map((p) => ({
            latitude: p.latitude,
            longitude: p.longitude,
            altitude: p.altitude,
            accuracy: p.accuracy,
          })),
          isPublic: true,
        },
        user.id
      )

      void tryPersistRouteIconFromLocalAi({
        routeId: created.id,
        name: resolvedRouteName,
        description: routeDescription.trim() || undefined,
        difficulty: 'Intermediate',
      })

      const supabase = createClient()
      const { error: attemptErr } = await supabase
        .from('route_attempts')
        .insert(
          buildRouteAttemptInsert(
            performance,
            gpsForAttempt,
            created.id,
            user.id,
            routeAttemptGateTiming
          )
        )
      if (attemptErr) throw attemptErr

      setIsSaving(false)
      setShowSaveModal(false)
      clearRecording()
      setRouteName('')
      setRouteDescription('')
      setNewRouteSelectedName(null)
      setTrackType('trail')
      setUseOsmRoadSnap(false)
      setUseOsmTrailSnap(false)
      setSaveContext('new')
      recordingTargetRef.current = 'new'
      router.push(routeViewUrl(created.id, 'record'))
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Error guardando'
      )
      setIsSaving(false)
    }
  }

  const countdownRingRef = useRef<SVGCircleElement | null>(null)
  const countdownLabelRef = useRef<HTMLSpanElement | null>(null)
  const prevArmForRingAnim = useRef<number | null>(null)
  const centerMapButtonRef = useRef<HTMLButtonElement | null>(null)

  useLayoutEffect(() => {
    if (armCountdown === null) {
      prevArmForRingAnim.current = null
      return
    }
    const targetOff = COUNTDOWN_STROKE_LEN * (1 - armCountdown / 3)
    const fromOff =
      prevArmForRingAnim.current == null
        ? COUNTDOWN_STROKE_LEN
        : COUNTDOWN_STROKE_LEN * (1 - prevArmForRingAnim.current / 3)
    prevArmForRingAnim.current = armCountdown
    const ring = countdownRingRef.current
    if (ring) {
      ring.setAttribute('stroke-dashoffset', String(fromOff))
      void animate(ring, {
        strokeDashoffset: [fromOff, targetOff],
        duration: 420,
        ease: 'outCubic',
      })
    }
    const label = countdownLabelRef.current
    if (label) {
      void animate(label, { scale: [1.2, 1], opacity: [0.35, 1], duration: 280, ease: 'outCubic' })
    }
  }, [armCountdown])

  /** Entrada + pulso suave en el botón «Centrar mapa» (encima del mapa). */
  useEffect(() => {
    if (isRecording) return
    const el = centerMapButtonRef.current
    if (!el) return
    void animate(el, {
      opacity: [0.65, 1],
      translateY: [12, 0],
      duration: 520,
      ease: 'outCubic',
    })
    let intervalId: number | undefined
    const startDelay = window.setTimeout(() => {
      intervalId = window.setInterval(() => {
        const node = centerMapButtonRef.current
        if (!node) return
        void animate(node, {
          scale: [1, 1.06, 1],
          duration: 1400,
          ease: 'inOutSine',
        })
      }, 4800)
    }, 900)
    return () => {
      window.clearTimeout(startDelay)
      if (intervalId) window.clearInterval(intervalId)
    }
  }, [isRecording])

  // Centro: trazo publicado (evita mapa “vacío” un frame); grabación → último GPS; si no, tu posición o Cusco
  const mapCenter: [number, number] =
    points.length > 0
      ? isRecording
        ? [points[points.length - 1].latitude, points[points.length - 1].longitude]
        : [
            points[Math.floor(points.length / 2)].latitude,
            points[Math.floor(points.length / 2)].longitude,
          ]
      : publishedReferencePathPoints && publishedReferencePathPoints.length > 0 && !isRecording
        ? [
            publishedReferencePathPoints[0]!.latitude,
            publishedReferencePathPoints[0]!.longitude,
          ]
        : mapBootstrapPos ?? [-13.5319, -71.9675]

  if (!user) {
    return <PageLoadingShimmer label="Cargando grabación…" />
  }

  const showRecordRouteSearch = !recordingEntryFromDetail && !urlRecordRouteId
  const showRoutePresetLoading = Boolean(urlRecordRouteId) && !selectedRouteForPreview
  const showCompactRouteBand =
    Boolean(selectedRouteForPreview) &&
    (recordingEntryFromDetail || Boolean(urlRecordRouteId))
  const recordingUiModalOpen =
    routeSetupOpen || createRouteModalOpen || showSaveModal || entryChoiceModalOpen

  return (
    <div className="gdh-immersive-page min-h-screen text-slate-100 relative flex flex-col">
      <Suspense fallback={null}>
        <RecordPresetFromUrl
          routes={routes}
          routesLoading={routesLoading}
          pickRecordingRoute={pickRecordingRoute}
          onDeepLinkPresetApplied={() => setRecordingEntryFromDetail(true)}
          onUrlRouteIdChange={handleUrlRecordRouteIdChange}
        />
      </Suspense>
      {armCountdown !== null && (
        <CountdownOverlay countdown={armCountdown} gradientId={countdownGradientId} />
      )}

      <DashboardAppTopBar
        leading={
          <button
            type="button"
            onClick={() => router.back()}
            className={cn(DASHBOARD_APP_TOP_BAR_ICON_BUTTON_CLASS)}
            aria-label="Cerrar"
          >
            <X size={20} aria-hidden />
          </button>
        }
        center={
          <DashboardAppTopBarHeading
            title="Grabar Bajada"
            subtitle={
              <span className="hidden sm:inline">GPS en primer plano (mejor en app nativa)</span>
            }
          />
        }
        trailing={
          <DashboardAppTopBarTrailingCluster className="max-w-[min(100%,12rem)] flex-wrap gap-2 sm:max-w-none">
            {!isRecording && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    void handleNuevaRutaLibre()
                  }}
                  className="flex max-w-[48%] flex-1 items-center justify-center gap-1 rounded-xl border border-gdh-sun/35 bg-gdh-sun/10 px-2 py-2 text-[11px] font-semibold text-gdh-sun transition hover:bg-gdh-sun/15 sm:max-w-none sm:flex-initial sm:gap-2 sm:px-4 sm:text-sm"
                >
                  <Navigation size={16} className="shrink-0 text-gdh-sun sm:h-[18px] sm:w-[18px]" aria-hidden />
                  <span className="truncate sm:max-w-none">Ruta libre</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewRouteDraftName(routeName)
                    setNewRouteDraftDescription(routeDescription)
                    setCreateRouteModalOpen(true)
                  }}
                  className="flex max-w-[48%] flex-1 items-center justify-center gap-1 rounded-xl border border-gdh-brand/35 bg-gdh-brand/10 px-2 py-2 text-[11px] font-semibold text-white transition hover:bg-gdh-brand/15 sm:max-w-none sm:flex-initial sm:gap-2 sm:px-4 sm:text-sm"
                >
                  <PlusCircle size={16} className="shrink-0 text-gdh-brand-highlight sm:h-[18px] sm:w-[18px]" aria-hidden />
                  <span className="truncate sm:max-w-none">
                    <span className="sm:hidden">Nueva</span>
                    <span className="hidden sm:inline">Nueva ruta</span>
                  </span>
                </button>
              </>
            )}
            {isRecording && (
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
                <span className="text-sm text-red-400">{isPaused ? 'Pausado' : 'Grabando'}</span>
              </div>
            )}
          </DashboardAppTopBarTrailingCluster>
        }
      />

      <RecordRouteSelectionPanel
        isRecording={isRecording}
        showRoutePresetLoading={showRoutePresetLoading}
        showRecordRouteSearch={showRecordRouteSearch}
        recordingPickQuery={recordingPickQuery}
        onRecordingPickQueryChange={setRecordingPickQuery}
        onPickFocus={() => setRecordingPickFocused(true)}
        onPickBlur={() => {
          window.setTimeout(() => setRecordingPickFocused(false), 200)
        }}
        recordingPickFocused={recordingPickFocused}
        routesLoading={routesLoading}
        recordingPickList={recordingPickList}
        onPickRoute={(r) => {
          void pickRecordingRoute(r)
        }}
        recordingSearchBusy={recordingSearchBusy}
        onOpenRouteSetup={() => setRouteSetupOpen(true)}
        showCompactRouteBand={showCompactRouteBand}
        selectedRouteForPreview={selectedRouteForPreview}
        onChangeSelectedRoute={() => clearRecordingRouteSelection({ force: true })}
        recordingEntryFromDetail={recordingEntryFromDetail}
        urlRecordRouteId={urlRecordRouteId}
        onNuevaRutaLibre={() => {
          void handleNuevaRutaLibre()
        }}
        newRouteSelectedName={newRouteSelectedName}
        onEditNewRouteName={() => {
          setCreateRouteModalOpen(true)
          setNewRouteDraftName(routeName)
          setNewRouteDraftDescription(routeDescription)
        }}
      />

        <RecordExistingRouteStatus
          visible={isRecording && selectedRouteId != null}
          awaitingStartGate={awaitingStartGate}
          distanceMetersToStart={distanceMetersToStart}
          routeAttemptOffRoute={routeAttemptOffRoute}
          stopGateError={stopGateError}
          distanceMetersToEnd={distanceMetersToEnd}
          startEndRadiusM={ROUTE_ATTEMPT_START_END_RADIUS_M}
          maxOffRouteM={ROUTE_ATTEMPT_MAX_OFF_ROUTE_M}
        />

        <div
          className={
            mapMaximized
              ? 'relative min-h-[55vh] w-full flex-1 sm:min-h-0'
              : 'relative mx-auto mt-2 min-h-[240px] w-full max-w-4xl flex-[0.8] px-4 sm:mt-3'
          }
        >
          <div className="absolute inset-0 overflow-hidden rounded-2xl border border-white/[0.06] shadow-inner shadow-black/20 sm:inset-0">
            <RouteMapEditorDynamic
              fillViewport
              startPoint={null}
              endPoint={
                isRecording && points.length >= 1 ? points[points.length - 1]! : null
              }
              trackPoints={isRecording && points.length > 1 ? points.slice(0, -1) : []}
              onPointAdd={() => {}}
              onPointRemove={() => {}}
              onStartPointSet={() => {}}
              onEndPointSet={() => {}}
              isDrawing={false}
              liveRecording={isRecording}
              mapTilePreset="dark"
              liveMapAvatarUrl={mapAvatarUrl}
              liveBikeMapIconUrl={bikeMapIconUrl}
              liveBikeColorHex={bikeColorHex}
              publishedReferencePath={publishedReferencePathPoints}
              publishedReferenceRouteId={selectedRouteId}
              riderPreviewPosition={riderPreviewPoint}
              previewRiderAvatar={!isRecording && !!riderPreviewPoint}
              center={mapCenter}
              zoom={18}
              flyToWhenReady={!isRecording ? mapBootstrapPos : null}
              flyToBump={mapFlyBump}
            />
          </div>

          <div className="absolute top-3 right-3 z-[1110] flex max-w-[calc(100%-1.5rem)] flex-wrap items-start justify-end gap-2 pointer-events-none">
            {!isRecording && (
              <button
                ref={centerMapButtonRef}
                type="button"
                onClick={() => {
                  const btn = centerMapButtonRef.current
                  if (btn) {
                    void animate(btn, {
                      scale: [1, 0.93, 1.04, 1],
                      duration: 480,
                      ease: 'outCubic',
                    })
                  }
                  void refreshMapBootstrapLocation()
                }}
                title="Centrar en mi GPS"
                aria-label="Centrar mapa en mi GPS"
                className="pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-gdh-card/95 text-gdh-brand-highlight shadow-lg hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40"
                style={{ willChange: 'transform, opacity' }}
              >
                <Crosshair size={20} aria-hidden strokeWidth={2} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setMapMaximized((m) => !m)}
              aria-pressed={mapMaximized}
              aria-label={
                mapMaximized
                  ? 'Reducir mapa'
                  : 'Maximizar mapa para ver más detalle'
              }
              title={mapMaximized ? 'Reducir mapa' : 'Maximizar mapa'}
              className="pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-gdh-card/95 text-gdh-brand-highlight shadow-lg hover:bg-white/10"
            >
              {mapMaximized ? (
                <Minimize2 size={20} aria-hidden strokeWidth={2} />
              ) : (
                <Maximize2 size={20} aria-hidden strokeWidth={2} />
              )}
            </button>
          </div>
        </div>

        {isRecording && user && (
          <RecordingStatsPanel
            points={points}
            elapsedTime={elapsedTime}
            currentSpeed={currentSpeed}
            maxSessionSpeedMps={maxSessionSpeedMps}
            currentAccuracy={currentAccuracy}
            user={user}
            mapAvatarUrl={mapAvatarUrl}
            isPaused={isPaused}
            awaitingStartGate={awaitingStartGate}
          />
        )}

        {/* Controles de grabación */}
        <RecordingControlsBar
          hidden={recordingUiModalOpen}
          isRecording={isRecording}
          isPaused={isPaused}
          armCountdown={armCountdown}
          startingArm={startingArm}
          selectedRouteId={selectedRouteId}
          checkingPosition={checkingPosition}
          distanceToStartM={distanceToStartM}
          proximityStartM={PROXIMITY_START_M}
          onStart={() => {
            void handleStart()
          }}
          onPauseResume={handlePauseResume}
          onStop={handleStop}
        />

      <EntryChoiceModal
        open={entryChoiceModalOpen}
        onClose={() => setEntryChoiceModalOpen(false)}
        onNuevaRutaLibre={() => { setEntryChoiceModalOpen(false); void handleNuevaRutaLibre() }}
        onNewRoute={() => { setEntryChoiceModalOpen(false); setNewRouteDraftName(routeName); setNewRouteDraftDescription(routeDescription); setCreateRouteModalOpen(true) }}
        onSelectExisting={() => { setEntryChoiceModalOpen(false); setRouteSetupExistingOnly(true); setRouteSetupOpen(true) }}
      />

      <RouteSetupPanel
        open={routeSetupOpen}
        existingOnly={routeSetupExistingOnly}
        onClose={() => { setRouteSetupOpen(false); setRouteSetupExistingOnly(false) }}
        recordingPickQuery={recordingPickQuery}
        onRecordingPickQueryChange={setRecordingPickQuery}
        routesLoading={routesLoading}
        recordingPickList={recordingPickList}
        onPickRoute={(r) => { void pickRecordingRoute(r) }}
        recordingSearchBusy={recordingSearchBusy}
        selectedRouteForPreview={selectedRouteForPreview}
        distanceToStartM={distanceToStartM}
        checkingPosition={checkingPosition}
        onRefreshDistance={() => { void refreshDistanceToSelectedRoute() }}
        onNuevaRutaLibre={() => void handleNuevaRutaLibre()}
        onCreateRoute={() => { setNewRouteDraftName(routeName); setNewRouteDraftDescription(routeDescription); setCreateRouteModalOpen(true) }}
        onLoadOsmWays={() => void loadOsmWaysForMapArea()}
        osmMapLoading={osmMapLoading}
        osmMapError={osmMapError}
        mapBootstrapPos={mapBootstrapPos}
        onDownloadOfflineTiles={() => void downloadOfflineTilesForCurrentArea()}
        tileDownloadBusy={tileDownloadBusy}
        tileDownloadProgress={tileDownloadProgress}
        offlineTileRegionsCount={offlineTileRegionsCount}
      />

      <CreateRouteModal
        open={createRouteModalOpen}
        onClose={() => setCreateRouteModalOpen(false)}
        name={newRouteDraftName}
        onNameChange={setNewRouteDraftName}
        description={newRouteDraftDescription}
        onDescriptionChange={setNewRouteDraftDescription}
        onCreate={() => { void handleCreateNewRouteDraft() }}
      />

      <RouteSetupPanel
        open={routeSetupOpen}
        existingOnly={routeSetupExistingOnly}
        onClose={() => { setRouteSetupOpen(false); setRouteSetupExistingOnly(false) }}
        recordingPickQuery={recordingPickQuery}
        onRecordingPickQueryChange={setRecordingPickQuery}
        routesLoading={routesLoading}
        recordingPickList={recordingPickList}
        onPickRoute={(r) => { void pickRecordingRoute(r) }}
        recordingSearchBusy={recordingSearchBusy}
        selectedRouteForPreview={selectedRouteForPreview}
        distanceToStartM={distanceToStartM}
        checkingPosition={checkingPosition}
        onRefreshDistance={() => { void refreshDistanceToSelectedRoute() }}
        onNuevaRutaLibre={() => void handleNuevaRutaLibre()}
        onCreateRoute={() => { setNewRouteDraftName(routeName); setNewRouteDraftDescription(routeDescription); setCreateRouteModalOpen(true) }}
        onLoadOsmWays={() => void loadOsmWaysForMapArea()}
        osmMapLoading={osmMapLoading}
        osmMapError={osmMapError}
        mapBootstrapPos={mapBootstrapPos}
        onDownloadOfflineTiles={() => void downloadOfflineTilesForCurrentArea()}
        tileDownloadBusy={tileDownloadBusy}
        tileDownloadProgress={tileDownloadProgress}
        offlineTileRegionsCount={offlineTileRegionsCount}
      />

      <RecordSaveModal
        show={showSaveModal}
        saveContext={saveContext}
        distanceM={distanceM}
        elapsedTime={elapsedTime}
        points={points}
        trackType={trackType}
        onTrackTypeChange={setTrackType}
        routeName={routeName}
        onRouteNameChange={setRouteName}
        routeDescription={routeDescription}
        onRouteDescriptionChange={setRouteDescription}
        useOsmRoadSnap={useOsmRoadSnap}
        onUseOsmRoadSnapChange={setUseOsmRoadSnap}
        useOsmTrailSnap={useOsmTrailSnap}
        onUseOsmTrailSnapChange={setUseOsmTrailSnap}
        saveError={saveError}
        isSaving={isSaving}
        onCancel={handleCancel}
        onSave={() => {
          void handleSave()
        }}
      />
    </div>
  )
}
