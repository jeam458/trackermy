'use client'

import { useState, useEffect, useLayoutEffect, useRef, useId, useMemo, useCallback, Suspense } from 'react'
import { animate } from 'animejs'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
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
import {
  PlusCircle,
  MapPin,
  Clock,
  TrendingUp,
  Navigation,
  AlertCircle,
  X,
  Gauge,
  Search,
  MapPinned,
  ChevronRight,
  Maximize2,
  Minimize2,
  Crosshair,
} from 'lucide-react'
import { BrandSpinner } from '@/components/ui/BrandLogoLoader'
import { DASHBOARD_BOTTOM_NAV_Z_INDEX } from '@/app/dashboard/components/DashboardBottomNav'
import { downloadTileRegion, listOfflineTileRegions } from '@/lib/tileOfflineCache'

const SelectedRoutePreviewMap = dynamic(
  () =>
    import('@/components/routes/SelectedRoutePreviewMap').then((m) => ({
      default: m.SelectedRoutePreviewMap,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-32 rounded-xl border border-white/10 bg-[#1a1f24] flex items-center justify-center text-sm text-slate-500">
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
  const [preflightError, setPreflightError] = useState<string | null>(null)
  const [preflightNeedSettings, setPreflightNeedSettings] = useState(false)
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
      setPreflightError(null)
      setPreflightNeedSettings(false)

      // Desde ficha (?routeId=): la ruta y el mapa deben mostrarse aunque el GPS falle al entrar;
      // el listado exige ubicación antes de elegir (comportamiento anterior).
      if (source === 'list') {
        const loc = await ensureLocationForRecording()
        if (!loc.ok) {
          setPreflightError(loc.message)
          setPreflightNeedSettings(!!loc.openSettings)
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
      setPreflightError(null)

      if (source === 'url') {
        const loc = await ensureLocationForRecording()
        if (!loc.ok) {
          setPreflightError(loc.message)
          setPreflightNeedSettings(!!loc.openSettings)
          toast.warning('Activa tu GPS', loc.message, { duration: 6500 })
          if (loc.openSettings) void openAppLocationSettings()
        }
      }

      try {
        const pos = await getQuickPosition()
        if (source === 'url') {
          setPreflightError(null)
          setPreflightNeedSettings(false)
        }
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
    setPreflightError(null)
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
    setPreflightError(null)
    setPreflightNeedSettings(false)
    try {
      const pos = await getQuickPosition()
      setMapBootstrapPos([pos.latitude, pos.longitude])
      setMapShowsRiderAvatar(true)
      setMapFlyBump((n) => n + 1)
      return true
    } catch {
      setPreflightError(
        'No se pudo obtener tu ubicación. Concede permiso de ubicación a la app y vuelve a intentar.'
      )
      setPreflightNeedSettings(true)
      return false
    }
  }, [])

  /** Tramo libre: limpia selección, muestra icono rider y avisa cómo iniciar grabación. */
  const handleNuevaRutaLibre = useCallback(async () => {
    setPreflightError(null)
    setPreflightNeedSettings(false)
    const loc = await ensureLocationForRecording()
    if (!loc.ok) {
      setPreflightError(loc.message)
      setPreflightNeedSettings(!!loc.openSettings)
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

  const refreshDistanceToSelectedRoute = async () => {
    if (!selectedRouteId) {
      setDistanceToStartM(null)
      return
    }
    const route = routes.find((r) => r.id === selectedRouteId)
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
      setPreflightError(
        'No se pudo leer tu posición. Permite ubicación para compararte con el inicio de la ruta.'
      )
    } finally {
      setCheckingPosition(false)
    }
  }

  useEffect(() => {
    if (!selectedRouteId || routes.length === 0) {
      setDistanceToStartM(null)
      return
    }
    void refreshDistanceToSelectedRoute()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cambiar selección o lista
  }, [selectedRouteId, routes])

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
    setPreflightError(null)
    setPreflightNeedSettings(false)
    setStartingArm(true)
    try {
      if (selectedRouteId) {
        if (
          distanceToStartM === null ||
          distanceToStartM > PROXIMITY_START_M
        ) {
          setPreflightError(
            `Para grabar sobre una ruta existente debes estar a menos de ${PROXIMITY_START_M} m de su inicio (ahora: ${distanceToStartM != null ? Math.round(distanceToStartM) : 'sin lectura'} m). Cambia a “Nueva ruta” o acércate al punto de partida.`
          )
          return
        }
        recordingTargetRef.current = { routeId: selectedRouteId }
      } else {
        recordingTargetRef.current = 'new'
      }

      const loc = await ensureLocationForRecording()
      if (!loc.ok) {
        setPreflightError(loc.message)
        setPreflightNeedSettings(!!loc.openSettings)
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
    <div className="min-h-screen bg-[#121417] text-slate-100 relative flex flex-col">
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
        <div className="fixed inset-0 z-[10050] pointer-events-auto">
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-x-0 top-0 h-[58vh] bg-gradient-to-b from-[#131a22]/95 to-[#131a22]/90 backdrop-blur-sm border-b border-white/10 flex flex-col items-center justify-center px-6">
            <p className="text-center text-2xl font-black tracking-tight text-white mb-5">¡Prepárate para la bajada!</p>
            <p className="mb-8 max-w-md text-center text-sm leading-relaxed text-slate-300">
              Iniciando validación de velocidad en el punto de partida...
            </p>
            <div className="relative w-52 h-52">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100" aria-hidden>
                <circle cx="50" cy="50" r="42" stroke="#334155" strokeWidth="5.5" fill="none" />
                <circle
                  ref={countdownRingRef}
                  cx="50"
                  cy="50"
                  r="42"
                  stroke={`url(#${countdownGradientId})`}
                  strokeWidth="5.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={COUNTDOWN_STROKE_LEN}
                  strokeDashoffset={COUNTDOWN_STROKE_LEN}
                />
                <defs>
                  <linearGradient id={countdownGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#2dd4bf" />
                    <stop offset="100%" stopColor="#5eead4" />
                  </linearGradient>
                </defs>
              </svg>
              <span
                ref={countdownLabelRef}
                className="absolute inset-0 flex items-center justify-center text-7xl font-black text-white tabular-nums z-10 [text-shadow:0_1px_0_rgba(0,0,0,0.35)] [transform-origin:center]"
              >
                {armCountdown}
              </span>
            </div>
            <p className="mt-8 text-center text-sm text-slate-300">
              Iniciando validación de velocidad en el punto de partida...
            </p>
          </div>
        </div>
      )}

      <header className="bg-[#121417]/90 backdrop-blur-sm border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 px-4 py-4">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <button
              onClick={() => router.back()}
              className="shrink-0 p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold text-white">Grabar Bajada</h1>
              <p className="text-sm text-gray-400 hidden sm:block">GPS en primer plano (mejor en app nativa)</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {!isRecording && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    void handleNuevaRutaLibre()
                  }}
                  className="flex items-center gap-2 rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/15 sm:px-4 sm:text-sm"
                >
                  <Navigation size={18} className="shrink-0 text-cyan-300" aria-hidden />
                  <span className="max-w-[9rem] truncate sm:max-w-none">Ruta libre</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewRouteDraftName(routeName)
                    setNewRouteDraftDescription(routeDescription)
                    setCreateRouteModalOpen(true)
                  }}
                  className="flex items-center gap-2 rounded-xl border border-teal-500/35 bg-teal-500/10 px-3 py-2 text-xs font-semibold text-teal-100 transition hover:bg-teal-500/15 sm:px-4 sm:text-sm"
                >
                  <PlusCircle size={18} className="shrink-0 text-teal-400" aria-hidden />
                  <span className="max-w-[9rem] truncate sm:max-w-none">
                    <span className="sm:hidden">Nueva</span>
                    <span className="hidden sm:inline">Nueva ruta</span>
                  </span>
                </button>
              </>
            )}
            {isRecording && (
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
                <span className="text-sm text-red-400">
                  {isPaused ? 'Pausado' : 'Grabando'}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

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

        {preflightError && !isRecording && (
          <div className="absolute left-3 right-3 top-16 z-[1095] space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 shadow-xl backdrop-blur-md sm:left-auto sm:right-3 sm:top-24 sm:max-w-md">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 shrink-0 text-amber-400" size={20} />
              <p className="text-sm text-amber-100">{preflightError}</p>
            </div>
            {preflightNeedSettings && (
              <button
                type="button"
                onClick={() => void openAppLocationSettings()}
                className="w-full rounded-lg bg-amber-500/20 px-3 py-2 text-sm font-medium text-amber-200 hover:bg-amber-500/30"
              >
                Abrir ajustes de la app (ubicación)
              </button>
            )}
          </div>
        )}

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
                className="pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-[#1a1f24]/95 text-teal-400 shadow-lg hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40"
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
              className="pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-[#1a1f24]/95 text-teal-400 shadow-lg hover:bg-white/10"
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
          <div className="fixed left-3 right-3 bottom-[5.1rem] z-[1055] mx-auto flex w-[min(92vw,420px)] items-center gap-3 rounded-2xl border border-white/10 bg-[#1a1f24]/95 px-3 py-2.5 shadow-xl">
            <div className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden border border-white/10 shrink-0">
              {mapAvatarUrl || user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mapAvatarUrl || user.avatarUrl || ''}
                  alt=""
                  className={MAP_AVATAR_THUMB_IMG_CLASS}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-400">
                  {user.fullName.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-teal-300 truncate">
                {isPaused ? 'Pausado' : awaitingStartGate ? 'Validando...' : 'Grabando recorrido'}
              </p>
              <p className="text-[10px] text-slate-400">
                {awaitingStartGate ? 'Validación de velocidad en salida' : 'GPS activo · seguimiento en vivo'}
              </p>
            </div>
            <Gauge className="text-violet-300 shrink-0" size={24} />
          </div>
        )}

        {/* Estadísticas en tiempo real (sobre el mapa) */}
        {isRecording && (
          <div className="pointer-events-none fixed bottom-[4.35rem] left-2 right-2 z-[1060] max-h-[38vh] overflow-y-auto sm:bottom-[4.25rem]">
            <div className="pointer-events-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 rounded-xl border border-white/10 bg-[#0d1114]/92 p-2 shadow-xl backdrop-blur-md">
            {/* Tiempo */}
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
              <div className="flex items-center gap-2 text-blue-400 mb-2">
                <Clock size={18} />
                <span className="text-sm">Tiempo</span>
              </div>
              <p className="text-2xl font-bold text-white font-mono">
                {formatTime(elapsedTime)}
              </p>
            </div>

            {/* Distancia */}
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
              <div className="flex items-center gap-2 text-amber-400 mb-2">
                <TrendingUp size={18} />
                <span className="text-sm">Distancia</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {formatDistance(distanceM)}
              </p>
            </div>

            {/* Velocidad actual */}
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
              <div className="flex items-center gap-2 text-green-400 mb-2">
                <Navigation size={18} />
                <span className="text-sm">Ahora</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {currentSpeed != null ? formatSpeed(currentSpeed) : '--'}
              </p>
              {avgSpeed > 0 && (
                <p className="text-xs text-slate-500 mt-1" title="Distancia recorrida ÷ tiempo transcurrido">
                  Media trayecto: {formatSpeed(avgSpeed)}
                </p>
              )}
            </div>

            {/* Velocidad máxima (pico de la sesión, no acumulado) */}
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
              <div className="flex items-center gap-2 text-emerald-400 mb-2">
                <Gauge size={18} />
                <span className="text-sm">Máx. pico</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {maxSessionSpeedMps != null && maxSessionSpeedMps > 0
                  ? formatSpeed(maxSessionSpeedMps)
                  : '--'}
              </p>
              <p className="text-[10px] text-slate-500 mt-1">GPS + tramo</p>
            </div>

            {/* Puntos */}
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
              <div className="flex items-center gap-2 text-purple-400 mb-2">
                <MapPin size={18} />
                <span className="text-sm">Puntos</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {points.length}
              </p>
              {currentAccuracy && (
                <p className="text-xs text-gray-400 mt-1">
                  ±{currentAccuracy.toFixed(1)}m
                </p>
              )}
            </div>
            </div>
          </div>
        )}

        {/* Error de GPS */}
        {gpsError && (
          <div className="fixed bottom-[11rem] left-3 right-3 top-auto z-[1065] max-h-[40vh] overflow-y-auto rounded-xl border border-red-500/20 bg-red-500/10 p-3 shadow-xl backdrop-blur-sm sm:bottom-auto sm:left-auto sm:right-3 sm:top-[5.5rem] sm:max-w-md">
            <AlertCircle className="text-red-400 shrink-0" size={24} />
            <div>
              <p className="text-sm text-red-200">
                {gpsError.startsWith('Error de GPS') ? gpsError : `Error de GPS: ${gpsError}`}
              </p>
              <button
                type="button"
                onClick={() => void openAppLocationSettings()}
                className="mt-2 text-xs font-medium text-red-300 underline underline-offset-2"
              >
                Abrir ajustes de ubicación
              </button>
            </div>
          </div>
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

      {/* Modal de entrada al módulo: elegir modo de grabación */}
      {entryChoiceModalOpen && (
        <div
          className="fixed inset-0 z-[10045] flex items-end justify-center bg-black/65 p-3 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="record-entry-choice-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEntryChoiceModalOpen(false)
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#161a20] p-4 shadow-2xl">
            <h3 id="record-entry-choice-title" className="text-base font-semibold text-white">
              ¿Cómo quieres empezar la bajada?
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Elige un modo y luego pulsa <span className="text-slate-300">Iniciar ruta</span> cuando estés listo.
            </p>
            <div className="mt-4 space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  setEntryChoiceModalOpen(false)
                  void handleNuevaRutaLibre()
                }}
                className="flex w-full items-center justify-between rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-3 py-3 text-left hover:bg-cyan-500/15"
              >
                <span>
                  <span className="block text-sm font-semibold text-cyan-100">Ruta libre</span>
                  <span className="block text-xs text-cyan-200/75">Sin nombre obligatorio, guardado automático.</span>
                </span>
                <ChevronRight size={18} className="text-cyan-300" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setEntryChoiceModalOpen(false)
                  setNewRouteDraftName(routeName)
                  setNewRouteDraftDescription(routeDescription)
                  setCreateRouteModalOpen(true)
                }}
                className="flex w-full items-center justify-between rounded-xl border border-teal-500/35 bg-teal-500/10 px-3 py-3 text-left hover:bg-teal-500/15"
              >
                <span>
                  <span className="block text-sm font-semibold text-teal-100">Nueva ruta</span>
                  <span className="block text-xs text-teal-200/75">Define nombre y descripción desde cero.</span>
                </span>
                <ChevronRight size={18} className="text-teal-300" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setEntryChoiceModalOpen(false)
                  setRouteSetupExistingOnly(true)
                  setRouteSetupOpen(true)
                }}
                className="flex w-full items-center justify-between rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-left hover:bg-white/10"
              >
                <span>
                  <span className="block text-sm font-semibold text-slate-100">Seleccionar ruta existente</span>
                  <span className="block text-xs text-slate-400">Buscar una ruta y registrar intento.</span>
                </span>
                <ChevronRight size={18} className="text-slate-400" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setEntryChoiceModalOpen(false)}
              className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 hover:bg-white/10"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Panel: elegir ruta */}
      {routeSetupOpen && (
        <div
          className="fixed inset-0 z-[10030] flex flex-col justify-end bg-black/60 backdrop-blur-sm sm:justify-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="route-setup-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setRouteSetupOpen(false)
              setRouteSetupExistingOnly(false)
            }
          }}
        >
          <div className="mx-auto mb-0 flex max-h-[min(88vh,780px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-white/15 bg-[#161a20] shadow-2xl sm:mb-0 sm:rounded-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <h2 id="route-setup-title" className="text-base font-semibold text-white">
                {routeSetupExistingOnly ? 'Seleccionar ruta existente' : '¿Qué ruta deseas recorrer?'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setRouteSetupOpen(false)
                  setRouteSetupExistingOnly(false)
                }}
                className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {!routeSetupExistingOnly ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setNewRouteDraftName(routeName)
                      setNewRouteDraftDescription(routeDescription)
                      setCreateRouteModalOpen(true)
                    }}
                    className="flex w-full items-center justify-between gap-2 rounded-xl border border-teal-500/30 bg-teal-500/10 px-4 py-3 text-left transition hover:bg-teal-500/15"
                  >
                    <span className="font-medium text-teal-100">Nueva ruta libre</span>
                    <ChevronRight className="shrink-0 text-teal-400" size={20} />
                  </button>

                  <div className="rounded-xl border border-white/10 bg-[#12161c] p-3">
                    <p className="mb-2 text-xs text-slate-400">
                      Opcional: descargar vías OSM para “nueva ruta” en la zona donde está centrado el mapa (usa primero{' '}
                      <span className="text-teal-300">Centrar mapa en mi GPS</span>).
                    </p>
                    <button
                      type="button"
                      disabled={osmMapLoading || !mapBootstrapPos}
                      onClick={() => void loadOsmWaysForMapArea()}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15 disabled:opacity-45"
                    >
                      {osmMapLoading ? <BrandSpinner size={20} /> : <MapPinned className="size-5 shrink-0" />}
                      Descargar vías en el área
                    </button>
                    {osmMapError && <p className="mt-2 text-xs text-amber-200">{osmMapError}</p>}
                    {selectedRouteId == null &&
                      osmMapPath &&
                      osmMapPath.length >= 2 &&
                      !osmMapError && (
                      <p className="mt-2 text-xs text-teal-200/90">
                        Trazado OSM listo ({osmMapPath.length} puntos). Al iniciar, se usará como referencia de encaje.
                      </p>
                    )}
                  </div>

                  <div className="rounded-xl border border-white/10 bg-[#12161c] p-3">
                    <p className="mb-2 text-xs text-slate-400">
                      Modo sin señal: descarga tiles del mapa para esta zona/ruta. Si luego falla la red, Leaflet usará
                      cache local; con red, se actualizan automáticamente.
                    </p>
                    <button
                      type="button"
                      disabled={tileDownloadBusy || (!mapBootstrapPos && !selectedRouteForPreview)}
                      onClick={() => void downloadOfflineTilesForCurrentArea()}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600/85 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-45"
                    >
                      {tileDownloadBusy ? <BrandSpinner size={18} /> : <MapPinned className="size-5 shrink-0" />}
                      {tileDownloadBusy ? 'Descargando tiles…' : 'Descargar mapa offline'}
                    </button>
                    {tileDownloadProgress && (
                      <p className="mt-2 text-xs text-teal-200/90">
                        Progreso: {tileDownloadProgress.done}/{tileDownloadProgress.total}
                      </p>
                    )}
                    <p className="mt-1 text-[11px] text-slate-500">Zonas offline guardadas: {offlineTileRegionsCount}</p>
                  </div>
                </>
              ) : null}

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Buscar ruta publicada o tuya</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="search"
                    value={recordingPickQuery}
                    onChange={(e) => setRecordingPickQuery(e.target.value)}
                    onFocus={() => setRecordingPickFocused(true)}
                    placeholder="Nombre de la ruta…"
                    className="w-full rounded-xl border border-white/10 bg-[#0d1114] py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-teal-500/50 focus:outline-none"
                  />
                </div>
                <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-xl border border-white/5 bg-[#0d1114] p-1">
                  {routesLoading ? (
                    <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
                      <BrandSpinner size={20} /> Cargando rutas…
                    </div>
                  ) : recordingPickList.length === 0 ? (
                    <p className="py-4 text-center text-sm text-slate-500">
                      {recordingPickQuery.trim() ? 'Sin resultados' : 'No hay rutas disponibles'}
                    </p>
                  ) : (
                    recordingPickList.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => pickRecordingRoute(r)}
                        className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-slate-200 hover:bg-white/10"
                      >
                        <span className="min-w-0 truncate font-medium">{r.name}</span>
                        <ChevronRight className="shrink-0 text-slate-500" size={18} />
                      </button>
                    ))
                  )}
                  {recordingSearchBusy && (
                    <div className="flex items-center justify-center gap-2 py-2 text-xs text-slate-500">
                      <BrandSpinner size={16} /> Buscando…
                    </div>
                  )}
                </div>
              </div>

              {!routeSetupExistingOnly && selectedRouteForPreview && (
                <div className="space-y-3 border-t border-white/10 pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-white">Ruta seleccionada</p>
                    <button
                      type="button"
                      onClick={() => void refreshDistanceToSelectedRoute()}
                      disabled={checkingPosition}
                      className="text-xs font-medium text-teal-300 underline-offset-2 hover:underline disabled:opacity-50"
                    >
                      {checkingPosition ? 'Midiendo…' : 'Actualizar distancia al inicio'}
                    </button>
                  </div>
                  <SelectedRoutePreviewMap route={selectedRouteForPreview} className="h-40 w-full overflow-hidden rounded-xl border border-white/10" />
                  <p className="text-xs text-slate-400">
                    Debes estar a ≤ {PROXIMITY_START_M} m del inicio para poder{' '}
                    <span className="text-slate-200">Iniciar ruta</span>.
                    {distanceToStartM != null && (
                      <>
                        {' '}
                        Ahora: <strong className="text-teal-200">{Math.round(distanceToStartM)} m</strong>
                      </>
                    )}
                    {distanceToStartM != null && distanceToStartM > PROXIMITY_START_M && (
                      <span className="block pt-1 text-amber-200/90">Acércate al punto de salida o elige otra ruta.</span>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {createRouteModalOpen && (
        <div
          className="fixed inset-0 z-[10060] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-route-modal-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setCreateRouteModalOpen(false)
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#161a20] p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 id="new-route-modal-title" className="text-base font-semibold text-white">
                Crear nueva ruta
              </h3>
              <button
                type="button"
                onClick={() => setCreateRouteModalOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Nombre de la ruta *</label>
                <input
                  type="text"
                  value={newRouteDraftName}
                  onChange={(e) => setNewRouteDraftName(e.target.value)}
                  placeholder="Ej: Bajada Casa-laguna"
                  className="w-full rounded-xl border border-white/10 bg-[#0d1114] px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-teal-500/50 focus:outline-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Descripción (opcional)</label>
                <textarea
                  value={newRouteDraftDescription}
                  onChange={(e) => setNewRouteDraftDescription(e.target.value)}
                  placeholder="Describe la ruta, terreno o recomendaciones."
                  rows={3}
                  className="w-full resize-y rounded-xl border border-white/10 bg-[#0d1114] px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-teal-500/50 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => void handleCreateNewRouteDraft()}
                disabled={!newRouteDraftName.trim()}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-900/30 hover:from-teal-500 hover:to-cyan-500 disabled:opacity-50"
              >
                <PlusCircle size={18} />
                Crear
              </button>
            </div>
          </div>
        </div>
      )}

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
