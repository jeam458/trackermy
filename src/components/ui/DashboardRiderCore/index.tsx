'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname, useSearchParams } from 'next/navigation'
import { usePetVisibility } from '@/hooks/usePetVisibility'
import { VoiceControlPanel, COACH_DOCK_CLUSTER_CLASS, COACH_HEADER_CLUSTER_CLASS } from '@/components/ui/VoiceControlPanel'
import { RouteViewCoachCluster } from '@/components/ui/RouteViewCoachCluster'
import { CoachNotification } from '@/components/ui/CoachNotification'
import { SidebarPetContent } from '@/components/ui/SidebarPetContent'
import { RecordDockCoach } from '@/components/ui/RecordDockCoach'
import type { PetAiMindState } from '@/components/pet/GuardDhPetAtlas'
import {
  clearGuidePetMood,
  inferPetMoodFromAttemptSummary,
  inferPetMoodFromCurrentRoute,
  publishGuidePetMood,
  publishGuidePetThinking,
  useGuidePetStore,
} from '@/lib/pet/guidePetBridge'
import { resolveDashboardPetAtlasEmotion } from '@/lib/pet/resolveDashboardPetAtlasEmotion'
import { inferScreenKind } from '@/lib/guide-ai/guideInteractionCatalog'
import { buildNavigationWarmup } from '@/lib/guide-ai/guideNavigationWarmup'
import { createClient } from '@/core/infrastructure/supabase/client'
import {
  bindRiderGuideChannel,
  type RiderGuidePayload,
} from '@/lib/riderGuide'
import { decideRiderEmotion } from '@/lib/emotion/EmotionOrchestrator'
import { SupabaseGuideDataProvider } from '@/lib/guide-ai/providers/SupabaseGuideDataProvider'
import { McpSupabaseGuideProvider } from '@/lib/guide-ai/providers/McpSupabaseGuideProvider'
import {
  executeDashboardReactiveGuideTurn,
  mapReactionMoodToToastType,
} from '@/lib/guide-ai/guideDashboardReactiveTurn'
import { generateGuideReactionWithLightLlm, warmupGuideLlmEngine } from '@/lib/guide-ai/lightweightGuideLlm'
import { buildGuideInteractionSessionHint } from '@/lib/guide-ai/guideSessionHint'
import type { GuideContext, GuideGpsHint, GuideUiEvent } from '@/lib/guide-ai/types'
import { GDH_VOICE_NAVIGATE_EVENT } from '@/lib/voice/voiceCoachEvents'
import { cancelGuideCoachSpeech, speakGuideCoachMessage } from '@/lib/voice/guideCoachSpeech'
import {
  getGuideTtsEnabled,
  GDH_GUIDE_TTS_PREF_EVENT,
  GUIDE_TTS_STORAGE_KEY,
} from '@/lib/voice/guideTtsPref'
import { useDashboardVoiceCoach } from '@/hooks/useDashboardVoiceCoach'
import { useDashboardSidebar } from '@/lib/dashboard/DashboardSidebarContext'
import { submitAggregateCoachInsight } from '@/lib/guide-ai/submitAggregateCoachInsight'
import {
  classifyGuidePointerTarget,
  GuideWorldStateController,
  inferNavTriggerFromPathname,
} from '@/lib/affective'
import {
  GUIDE_MAIN_SCROLL_BUCKET_PX,
  GUIDE_MAIN_SCROLL_DEBOUNCE_MS,
  GUIDE_MAP_CANVAS_COACH_THROTTLE_MS,
} from '@/lib/affective/config/guideUiTiming'
import type { GuidePetMood } from '@/lib/pet/guidePetBridge'
import { SIDEBAR_PET_SLOT_ID, MIN_GUIDE_THINKING_MS, type RiderMood, type RiderSignal, DASHBOARD_COACH_HEADER_SLOT_ID } from './types'
import { buildAffectiveAugmentForLlm } from './helpers'
import { isDashboardCoachHeaderSlotRoute } from '@/lib/dashboard/discoverCoachPaths'
import { useGuideReplaySignals } from './useGuideReplaySignals'

export function DashboardRiderCore() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isLoadingPulse, setIsLoadingPulse] = useState(true)
  const [signal, setSignal] = useState<RiderSignal>({
    recentTriumph: false,
    fatigue: false,
    topRouteName: null,
    topRouteKm: null,
    weeklyKm: null,
    approxLat: null,
    approxLng: null,
  })
  const [messageVisible, setMessageVisible] = useState(true)
  const [externalEvent, setExternalEvent] = useState<RiderGuidePayload | null>(null)
  const [toastGlanceKey, setToastGlanceKey] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)
  const [approxGeo, setApproxGeo] = useState<{ lat: number; lng: number } | null>(null)
  const [geoState, setGeoState] = useState<'unknown' | 'ok' | 'denied' | 'unavailable'>('unknown')
  const [networkOnline, setNetworkOnline] = useState<boolean | null>(null)
  const [guideLlmThinking, setGuideLlmThinking] = useState(false)
  /** Lectura en voz alta de burbujas del coach (preferencia en localStorage). */
  const [guideTtsEnabled, setGuideTtsEnabled] = useState(false)
  const voiceCoach = useDashboardVoiceCoach()
  const { openSidebar, open: sidebarOpen } = useDashboardSidebar()
  const [sidebarPetSlot, setSidebarPetSlot] = useState<HTMLElement | null>(null)
  const wantsHeaderCoach = useMemo(() => isDashboardCoachHeaderSlotRoute(pathname), [pathname])
  const [headerCoachSlotEl, setHeaderCoachSlotEl] = useState<HTMLElement | null>(null)
  const coachSearchKey = searchParams?.toString() ?? ''
  const coachHeaderNavKey = useMemo(
    () => `${pathname ?? ''}?${coachSearchKey}`,
    [pathname, coachSearchKey],
  )

  useEffect(() => {
    if (!sidebarOpen) {
      setSidebarPetSlot(null)
      return
    }
    let cancelled = false
    let attempts = 0
    const trySync = () => {
      if (cancelled) return
      const el = document.getElementById(SIDEBAR_PET_SLOT_ID)
      if (el) {
        setSidebarPetSlot(el)
        return
      }
      attempts += 1
      if (attempts < 24) requestAnimationFrame(trySync)
    }
    requestAnimationFrame(() => requestAnimationFrame(trySync))
    return () => {
      cancelled = true
    }
  }, [sidebarOpen])

  useEffect(() => {
    if (!wantsHeaderCoach || sidebarOpen || voiceCoach.hidden) {
      setHeaderCoachSlotEl(null)
      return
    }

    let cancelled = false

    const tryAttach = (): boolean => {
      if (cancelled) return true
      const el = document.getElementById(DASHBOARD_COACH_HEADER_SLOT_ID)
      if (el?.isConnected) {
        setHeaderCoachSlotEl(el)
        return true
      }
      return false
    }

    if (tryAttach()) {
      return () => {
        cancelled = true
        setHeaderCoachSlotEl(null)
      }
    }

    const obs = new MutationObserver(() => {
      if (tryAttach()) obs.disconnect()
    })
    obs.observe(document.documentElement, { childList: true, subtree: true })

    let attempts = 0
    const rafLoop = () => {
      if (cancelled) return
      if (tryAttach()) {
        obs.disconnect()
        return
      }
      attempts += 1
      if (attempts < 64) requestAnimationFrame(rafLoop)
    }
    requestAnimationFrame(() => requestAnimationFrame(rafLoop))

    return () => {
      cancelled = true
      obs.disconnect()
      setHeaderCoachSlotEl(null)
    }
  }, [wantsHeaderCoach, sidebarOpen, voiceCoach.hidden, coachHeaderNavKey])

  const petMood = useGuidePetStore((s) => s.petMood)
   /** Snapshot de pantalla para turnos extra sin nuevo getContext / MCP. */
   const pageGuideContextRef = useRef<GuideContext | null>(null)
   
   // Pet visibility logic
   const { visible: petVisible } = usePetVisibility()

  const runLlmReaction = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    setGuideLlmThinking(true)
    publishGuidePetThinking(true)
    publishGuidePetMood({ petMood: 'analyzing' })
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
    try {
      return await fn()
    } finally {
      const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0
      const pad = Math.max(0, MIN_GUIDE_THINKING_MS - elapsed)
      if (pad > 0) {
        await new Promise<void>((r) => setTimeout(r, pad))
      }
      setGuideLlmThinking(false)
      publishGuidePetThinking(false)
    }
  }, [])

  /**
   * Indicador “foco IA” solo mientras el modelo genera.
   * Dejar `off` el resto del tiempo: el rostro (atlas + `resolveDashboardPetAtlasEmotion`) es el gesto principal;
   * tener siempre ready/heuristic tapaba visualmente las emociones del pet.
   */
  const petAiMindState = useMemo((): PetAiMindState => {
    if (guideLlmThinking) return 'thinking'
    return 'off'
  }, [guideLlmThinking])

  useEffect(() => {
    void warmupGuideLlmEngine()
  }, [])

  useEffect(() => {
    if (typeof navigator === 'undefined') return
    const sync = () => setNetworkOnline(navigator.onLine)
    sync()
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => {
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
    }
  }, [])
  const petClientHints = useMemo((): {
    gpsHint: GuideGpsHint
    networkOnline: boolean | null
  } => {
    const gpsHint: GuideGpsHint =
      geoState === 'ok'
        ? 'ok'
        : geoState === 'denied'
          ? 'denied'
          : geoState === 'unavailable'
            ? 'unavailable'
            : 'unknown'
    return { gpsHint, networkOnline }
   }, [geoState, networkOnline])
   /** En cliente los timeouts son `number`; evita choque con tipos de Node. */
   const externalResetRef = useRef<number | null>(null)
  const lastClickReactionRef = useRef<{ key: string; at: number } | null>(null)
  const lastGpsNoticeRef = useRef<number>(0)
  /** Aviso GPS sin sesión (solo texto fijo); no comparte el mismo throttle que el turno WebLLM con userId. */
  const lastGpsNoAuthNoticeRef = useRef<number>(0)
  const prevNetworkOnlineRef = useRef<boolean | null>(null)
  const lastNetworkLlmNoticeRef = useRef(0)
  const lastNetworkNoAuthNoticeRef = useRef(0)
  const followupTimersRef = useRef<number[]>([])
  const viewEnteredAtRef = useRef<number>(Date.now())
  const currentViewKeyRef = useRef<string>('')
  const spokenTitlesRef = useRef<string[]>([])
  const lastSpokenAtRef = useRef<number>(0)
  /** Throttle turnos guía tras navegación por voz (sin transcripción en contexto). */
  const lastVoiceNavigateGuideAtRef = useRef(0)
  const lastCoachTtsKeyRef = useRef('')
  const lastCoachTtsAtRef = useRef(0)
  const lastCoachInsightSigRef = useRef('')
  /** Estado unificado para capa afectiva (prompt); se resetea al cambiar ruta/intento en replay. */
  const affectiveWorldRef = useRef(new GuideWorldStateController())
  const lastMapCanvasCoachAtRef = useRef(0)
  const didPulseGeoFixRef = useRef(false)

  const provider = useMemo(() => {
    if (process.env.NEXT_PUBLIC_GUIDE_DATA_SOURCE === 'mcp') {
      return new McpSupabaseGuideProvider()
    }
    return new SupabaseGuideDataProvider(createClient())
  }, [])
  const contextualRouteId = (searchParams.get('id') || searchParams.get('routeId') || '').trim() || null
  const contextualAttemptId = (searchParams.get('attemptId') || '').trim() || null
  const viewKey = `${pathname}|${contextualRouteId ?? ''}|${contextualAttemptId ?? ''}`
  currentViewKeyRef.current = viewKey

  const { sessionReplaySignalsRef, replayStructuralAtRef } = useGuideReplaySignals({
    pathname,
    userId,
    provider,
    approxGeo,
    contextualRouteId,
    contextualAttemptId,
    petClientHints,
    runLlmReaction,
    setExternalEvent,
    setMessageVisible,
    pageGuideContextRef,
    affectiveWorldRef,
    lastSpokenAtRef,
    spokenTitlesRef,
    viewEnteredAtRef,
  })

  const clearFollowupTimers = () => {
    followupTimersRef.current.forEach((id) => window.clearTimeout(id))
    followupTimersRef.current = []
  }

  useEffect(() => {
    cancelGuideCoachSpeech()
    setIsLoadingPulse(true)
    setMessageVisible(true)
    clearGuidePetMood()
    const t = window.setTimeout(() => setIsLoadingPulse(false), 820)
    clearFollowupTimers()
    spokenTitlesRef.current = []
    viewEnteredAtRef.current = Date.now()
    affectiveWorldRef.current.reset()
    didPulseGeoFixRef.current = false
    lastMapCanvasCoachAtRef.current = 0
    return () => window.clearTimeout(t)
  }, [pathname, contextualRouteId, contextualAttemptId])

  useEffect(() => {
    if (!externalEvent) clearGuidePetMood()
  }, [externalEvent])

  useEffect(() => {
    setGuideTtsEnabled(getGuideTtsEnabled())
    const sync = () => setGuideTtsEnabled(getGuideTtsEnabled())
    const onStorage = (e: StorageEvent) => {
      if (e.key === GUIDE_TTS_STORAGE_KEY || e.key === null) sync()
    }
    window.addEventListener(GDH_GUIDE_TTS_PREF_EVENT, sync)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(GDH_GUIDE_TTS_PREF_EVENT, sync)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  useEffect(() => {
    return () => {
      cancelGuideCoachSpeech()
    }
  }, [])

  useEffect(() => {
    if (!guideTtsEnabled) {
      cancelGuideCoachSpeech()
      return
    }
    if (!messageVisible || !externalEvent || isLoadingPulse) {
      cancelGuideCoachSpeech()
      return
    }
    const title = (externalEvent.title ?? '').trim()
    const sub = (externalEvent.subtitle ?? '').trim()
    if (!title) {
      cancelGuideCoachSpeech()
      return
    }
    const key = `${title}\u0001${sub}`
    const now = Date.now()
    if (key === lastCoachTtsKeyRef.current && now - lastCoachTtsAtRef.current < 4500) return
    lastCoachTtsKeyRef.current = key
    lastCoachTtsAtRef.current = now
    const lang =
      typeof document !== 'undefined' && document.documentElement.lang
        ? document.documentElement.lang
        : 'es'
    speakGuideCoachMessage({ title, subtitle: sub || undefined, lang })
  }, [guideTtsEnabled, messageVisible, externalEvent, isLoadingPulse])

  useEffect(() => {
    if (!externalEvent) {
      lastCoachInsightSigRef.current = ''
      return
    }
    if (!externalEvent.title?.trim()) return
    if (externalEvent.source === 'toast') return
    const sk = inferScreenKind(pathname)
    const sig = `${sk}|${externalEvent.title}|${externalEvent.subtitle || ''}`
    if (sig === lastCoachInsightSigRef.current) return
    lastCoachInsightSigRef.current = sig
    const t = window.setTimeout(() => {
      submitAggregateCoachInsight({
        screenKind: sk,
        title: externalEvent.title,
        subtitle: externalEvent.subtitle,
      })
    }, 4200)
    return () => window.clearTimeout(t)
  }, [externalEvent, pathname])

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setApproxGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGeoState('ok')
      },
      (err) => {
        setGeoState(err.code === 1 ? 'denied' : 'unavailable')
      },
      { enableHighAccuracy: false, maximumAge: 120_000, timeout: 12_000 }
    )
  }, [])

  useEffect(() => {
    if (geoState !== 'ok' || !approxGeo) return
    if (didPulseGeoFixRef.current) return
    didPulseGeoFixRef.current = true
    affectiveWorldRef.current.ingestTrigger({
      kind: 'dynamic',
      domain: 'geo',
      action: 'approx_fix',
      detail: {
        lat_rounded: Math.round(approxGeo.lat * 100) / 100,
        lng_rounded: Math.round(approxGeo.lng * 100) / 100,
      },
    })
  }, [geoState, approxGeo])

  useEffect(() => {
    const main = typeof document !== 'undefined' ? document.querySelector('main') : null
    if (!main) return
    let timer: number | null = null
    let lastSentBucket = -1
    const flush = () => {
      timer = null
      const top = main.scrollTop
      const bucket = Math.round(top / GUIDE_MAIN_SCROLL_BUCKET_PX)
      if (bucket === lastSentBucket && top > 0) return
      lastSentBucket = bucket
      affectiveWorldRef.current.ingestTrigger({
        kind: 'dynamic',
        domain: 'ui',
        action: 'scroll_main',
        detail: { scroll_top_bucket: bucket },
      })
    }
    const onScroll = () => {
      if (timer != null) return
      timer = window.setTimeout(flush, GUIDE_MAIN_SCROLL_DEBOUNCE_MS)
    }
    main.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      main.removeEventListener('scroll', onScroll)
      if (timer != null) window.clearTimeout(timer)
    }
  }, [pathname])

  useEffect(() => {
    if (geoState !== 'denied' && geoState !== 'unavailable') return

    const staticGpsBubble = () => {
      setExternalEvent({
        mood: 'warning',
        title: geoState === 'denied' ? 'GPS desactivado' : 'Ubicación no disponible',
        subtitle:
          geoState === 'denied'
            ? 'Actívalo para ver rutas cercanas y seguimiento en mapa.'
            : 'Revisa permisos de ubicación para recomendaciones locales.',
        duration: 5600,
        source: 'navigation',
        toastType: 'warning',
      })
      publishGuidePetMood({ petMood: 'warning' })
      setMessageVisible(true)
    }

    if (!userId) {
      const t0 = Date.now()
      if (t0 - lastGpsNoAuthNoticeRef.current < 45_000) return
      lastGpsNoAuthNoticeRef.current = t0
      staticGpsBubble()
      return
    }

    const now = Date.now()
    if (now - lastGpsNoticeRef.current < 45_000) return
    lastGpsNoticeRef.current = now

    let cancelled = false
    void (async () => {
      try {
        const snap = pageGuideContextRef.current
        const sameSession =
          snap &&
          snap.pathname === pathname &&
          (snap.routeId ?? null) === (contextualRouteId ?? null) &&
          (snap.attemptId ?? null) === (contextualAttemptId ?? null)
        let ctx: GuideContext
        if (sameSession && snap) {
          ctx = {
            ...snap,
            gpsHint: petClientHints.gpsHint,
            networkOnline: petClientHints.networkOnline,
          }
          pageGuideContextRef.current = ctx
        } else {
          ctx = (await provider.getContext({
            pathname,
            userId,
            geo: approxGeo ?? undefined,
            routeId: contextualRouteId,
            attemptId: contextualAttemptId || undefined,
            clientHints: petClientHints,
          })) as GuideContext
          if (cancelled) return
          pageGuideContextRef.current = ctx
        }

        const label = geoState === 'denied' ? 'system:gps_denied' : 'system:gps_unavailable'
        affectiveWorldRef.current.ingestAppTrigger(
          geoState === 'denied' ? 'sys.gps_denied' : 'sys.gps_unavailable',
          { pathname }
        )
        const reaction = await runLlmReaction(() =>
          executeDashboardReactiveGuideTurn({
            context: ctx,
            pathname,
            label,
            executeMcpTools: false,
            affectiveAugment: buildAffectiveAugmentForLlm(affectiveWorldRef.current, ctx),
            sessionHint: buildGuideInteractionSessionHint({
              viewEnteredAtMs: viewEnteredAtRef.current,
              recentCoachTitlesLower: spokenTitlesRef.current,
              lastTriggerType: 'data-refresh',
            }),
          })
        )
        if (cancelled) return

        setExternalEvent({
          mood: reaction.mood,
          title: reaction.title,
          subtitle: reaction.subtitle,
          duration: Math.min(9000, Math.max(4200, reaction.duration)),
          source: 'navigation',
          toastType: mapReactionMoodToToastType(reaction.mood),
        })
        setMessageVisible(true)
      } catch {
        if (!cancelled) staticGpsBubble()
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    geoState,
    userId,
    pathname,
    provider,
    runLlmReaction,
    petClientHints,
    contextualRouteId,
    contextualAttemptId,
    approxGeo,
  ])

  useEffect(() => {
    const prev = prevNetworkOnlineRef.current
    prevNetworkOnlineRef.current = networkOnline
    if (prev === null) return

    const wentOffline = prev === true && networkOnline === false
    const wentOnline = prev === false && networkOnline === true
    if (!wentOffline && !wentOnline) return

    const label = wentOffline ? 'system:network_offline' : 'system:network_online'

    const staticNetBubble = () => {
      if (wentOffline) {
        setExternalEvent({
          mood: 'warning',
          title: 'Sin conexión',
          subtitle: 'Seguimos con datos en el dispositivo; al reconectar se actualizará la nube.',
          duration: 5200,
          source: 'navigation',
          toastType: 'warning',
        })
        publishGuidePetMood({ petMood: 'analyzing' })
      } else {
        setExternalEvent({
          mood: 'guide',
          title: 'Conexión restablecida',
          subtitle: 'Podemos sincronizar y traer datos frescos al abrir ranking o rutas.',
          duration: 4400,
          source: 'navigation',
          toastType: 'success',
        })
        publishGuidePetMood({ petMood: 'happy' })
      }
      setMessageVisible(true)
    }

    if (!userId) {
      const t0 = Date.now()
      if (t0 - lastNetworkNoAuthNoticeRef.current < 55_000) return
      lastNetworkNoAuthNoticeRef.current = t0
      staticNetBubble()
      return
    }

    const now = Date.now()
    if (now - lastNetworkLlmNoticeRef.current < 55_000) return
    lastNetworkLlmNoticeRef.current = now

    let cancelled = false
    void (async () => {
      try {
        const snap = pageGuideContextRef.current
        const sameSession =
          snap &&
          snap.pathname === pathname &&
          (snap.routeId ?? null) === (contextualRouteId ?? null) &&
          (snap.attemptId ?? null) === (contextualAttemptId ?? null)
        let ctx: GuideContext
        if (sameSession && snap) {
          ctx = {
            ...snap,
            gpsHint: petClientHints.gpsHint,
            networkOnline: petClientHints.networkOnline,
          }
          pageGuideContextRef.current = ctx
        } else {
          ctx = (await provider.getContext({
            pathname,
            userId,
            geo: approxGeo ?? undefined,
            routeId: contextualRouteId,
            attemptId: contextualAttemptId || undefined,
            clientHints: petClientHints,
          })) as GuideContext
          if (cancelled) return
          pageGuideContextRef.current = ctx
        }

        affectiveWorldRef.current.ingestAppTrigger(
          wentOffline ? 'sys.network_offline' : 'sys.network_online',
          { pathname }
        )
        const reaction = await runLlmReaction(() =>
          executeDashboardReactiveGuideTurn({
            context: ctx,
            pathname,
            label,
            executeMcpTools: false,
            affectiveAugment: buildAffectiveAugmentForLlm(affectiveWorldRef.current, ctx),
            sessionHint: buildGuideInteractionSessionHint({
              viewEnteredAtMs: viewEnteredAtRef.current,
              recentCoachTitlesLower: spokenTitlesRef.current,
              lastTriggerType: 'data-refresh',
            }),
          })
        )
        if (cancelled) return
        setExternalEvent({
          mood: reaction.mood,
          title: reaction.title,
          subtitle: reaction.subtitle,
          duration: Math.min(9000, Math.max(3800, reaction.duration)),
          source: 'navigation',
          toastType: mapReactionMoodToToastType(reaction.mood),
        })
        setMessageVisible(true)
      } catch {
        if (!cancelled) staticNetBubble()
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    networkOnline,
    userId,
    pathname,
    provider,
    runLlmReaction,
    petClientHints,
    contextualRouteId,
    contextualAttemptId,
    approxGeo,
  ])

  useEffect(() => {
    let cancelled = false
    clearFollowupTimers()

    ;(async () => {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return
        if (cancelled) return
        setUserId(user.id)

        const onRouteDetail = pathname.toLowerCase().includes('/dashboard/routes/view')
        const onAttemptStats = pathname.toLowerCase().includes('/dashboard/routes/attempt-stats')
        const ctx = (await provider.getContext({
          pathname,
          userId: user.id,
          geo: approxGeo ?? undefined,
          routeId: contextualRouteId,
          attemptId: contextualAttemptId || undefined,
          clientHints: petClientHints,
        })) as GuideContext
        if (cancelled) return

        pageGuideContextRef.current = ctx
        affectiveWorldRef.current.ingestAppTrigger(inferNavTriggerFromPathname(pathname), {
          pathname,
        })
        setSignal({
          recentTriumph: ctx.recentTriumph,
          fatigue: ctx.fatigue,
          topRouteName: ctx.topRouteName,
          topRouteKm: ctx.topRouteKm,
          weeklyKm: ctx.weeklyKm,
          approxLat: ctx.approxLat ?? null,
          approxLng: ctx.approxLng ?? null,
        })

        const warmup = buildNavigationWarmup(pathname, ctx)
        setExternalEvent({
          mood: warmup.mood,
          title: warmup.title,
          subtitle: warmup.subtitle,
          duration: onRouteDetail || onAttemptStats ? 6400 : 4400,
          source: 'navigation',
          toastType: warmup.toastType,
        })
        publishGuidePetMood({
          petMood:
            inferPetMoodFromAttemptSummary(ctx.attemptSummary) ??
            inferPetMoodFromCurrentRoute(ctx.currentRoute, ctx.routeTrackPointCount ?? null) ??
            'analyzing',
          message: warmup.subtitle,
        })
        setMessageVisible(true)

        const navEvent: GuideUiEvent = {
          type: 'navigation',
          pathname,
          label: contextualRouteId ? `${pathname}#${contextualRouteId}` : pathname,
          timestamp: Date.now(),
        }
        affectiveWorldRef.current.ingestAppTrigger('coach.navigation_open', {
          pathname,
          label: navEvent.label,
        })
        const reaction = await runLlmReaction(() =>
          generateGuideReactionWithLightLlm({
            context: ctx,
            event: navEvent,
            sessionReplaySignals:
              pathname.includes('/dashboard/routes/attempt-replay') && sessionReplaySignalsRef.current.length
                ? [...sessionReplaySignalsRef.current]
                : undefined,
            affectiveAugment: buildAffectiveAugmentForLlm(affectiveWorldRef.current, ctx),
            sessionHint: buildGuideInteractionSessionHint({
              viewEnteredAtMs: viewEnteredAtRef.current,
              recentCoachTitlesLower: spokenTitlesRef.current,
              lastTriggerType: 'navigation',
            }),
          })
        )
        if (cancelled) return
        const pLower = pathname.toLowerCase()
        const onActivity = pLower.includes('/dashboard/activity')
        const onRanking =
          pLower.includes('/dashboard/ranking') || pLower.includes('/dashboard/routes/route-ranking')
        const onNotifications = pLower.includes('/dashboard/notifications')
        const onDashboardHome = pLower === '/dashboard'
        const dwellMs =
          onRouteDetail || onAttemptStats
            ? Math.max(reaction.duration, 8600)
            : onActivity || onRanking
              ? Math.max(reaction.duration, 7200)
              : pLower.includes('attempt-replay')
                ? Math.max(reaction.duration, 7200)
                : reaction.duration
        setExternalEvent({
          mood: reaction.mood,
          title: reaction.title,
          subtitle: reaction.subtitle,
          duration: dwellMs,
          source: 'navigation',
        })
        lastSpokenAtRef.current = Date.now()
        spokenTitlesRef.current = [reaction.title.trim().toLowerCase()]

        const shouldProgressiveTalk =
          pLower.includes('/dashboard/routes/view') ||
          pLower.includes('/dashboard/routes/attempt-') ||
          onActivity ||
          onRanking ||
          onNotifications ||
          onDashboardHome
        if (shouldProgressiveTalk) {
          clearFollowupTimers()
          const delays = onRouteDetail
            ? [5600, 12800]
            : pLower.includes('/dashboard/routes/attempt-replay')
              ? [4000, 8000, 12000, 16800, 22000, 28000]
              : pLower.includes('/dashboard/routes/attempt-')
                ? [7000, 15000]
                : onActivity
                ? [4200, 9000, 15000, 21000]
                : onRanking
                  ? [4800, 11000, 17000]
                  : onNotifications
                    ? [4000, 9500]
                    : onDashboardHome
                      ? [5200, 12000, 18500]
                      : [7000, 15000]
          for (let i = 0; i < delays.length; i += 1) {
            const timerId = window.setTimeout(() => {
              void (async () => {
                if (currentViewKeyRef.current !== viewKey) return
                if (document.hidden) return
                if (
                  Date.now() - lastSpokenAtRef.current <
                  (pLower.includes('attempt-replay') ? 2800 : 4200)
                )
                  return
                try {
                  const snap = pageGuideContextRef.current
                  if (!snap) return
                  const followEvent: GuideUiEvent = {
                    type: 'data-refresh',
                    pathname,
                    label: pLower.includes('attempt-replay')
                      ? `interactive:replay_followup_${i + 1}`
                      : `followup_turn_${i + 1}`,
                    timestamp: Date.now(),
                  }
                  affectiveWorldRef.current.ingestAppTrigger('coach.scheduled_followup', {
                    label: followEvent.label,
                  })
                  const followMcp =
                    onActivity && (i === 1 || i === 3)
                  const nextReaction = await runLlmReaction(() =>
                    generateGuideReactionWithLightLlm({
                      context: snap,
                      event: followEvent,
                      executeMcpTools: followMcp,
                      sessionReplaySignals:
                        pathname.includes('/dashboard/routes/attempt-replay') &&
                        sessionReplaySignalsRef.current.length
                          ? [...sessionReplaySignalsRef.current]
                          : undefined,
                      affectiveAugment: buildAffectiveAugmentForLlm(affectiveWorldRef.current, snap),
                      sessionHint: buildGuideInteractionSessionHint({
                        viewEnteredAtMs: viewEnteredAtRef.current,
                        recentCoachTitlesLower: spokenTitlesRef.current,
                        lastTriggerType: 'data-refresh',
                      }),
                    })
                  )
                  const key = nextReaction.title.trim().toLowerCase()
                  if (!key || spokenTitlesRef.current.includes(key)) return
                  spokenTitlesRef.current = [...spokenTitlesRef.current.slice(-5), key]
                  lastSpokenAtRef.current = Date.now()
                  setExternalEvent({
                    mood: nextReaction.mood,
                    title: nextReaction.title,
                    subtitle: nextReaction.subtitle,
                    duration:
                      pLower.includes('attempt-replay') ? Math.max(nextReaction.duration, 6200) : nextReaction.duration,
                    source: 'navigation',
                    ...(pLower.includes('attempt-replay')
                      ? { toastType: mapReactionMoodToToastType(nextReaction.mood) }
                      : {}),
                  })
                  setMessageVisible(true)
                } catch {
                  // noop
                }
              })()
            }, delays[i])
            followupTimersRef.current.push(timerId)
          }
        }
      } catch {
        const emptyCtx = {
          pathname,
          riderDisplayName: null as string | null,
          currentRoute: null,
          recentTriumph: false,
          fatigue: false,
          routeTrackPointCount: null,
          attemptId: null,
          attemptSummary: null,
          screenKind: inferScreenKind(pathname),
        } as GuideContext
        if (cancelled) return
        pageGuideContextRef.current = emptyCtx
        setSignal({
          recentTriumph: false,
          fatigue: false,
          topRouteName: null,
          topRouteKm: null,
          weeklyKm: null,
          approxLat: null,
          approxLng: null,
        })
        const fb = buildNavigationWarmup(pathname, emptyCtx)
        if (cancelled) return
        setExternalEvent({
          mood: fb.mood,
          title: fb.title,
          subtitle: fb.subtitle,
          duration: 4600,
          source: 'navigation',
          toastType: fb.toastType,
        })
        publishGuidePetMood({ petMood: 'analyzing', message: fb.subtitle })
        setMessageVisible(true)
      }
    })()

    return () => {
      cancelled = true
      clearFollowupTimers()
    }
  }, [pathname, provider, approxGeo, contextualRouteId, viewKey, petClientHints])

  useEffect(() => {
    if (!userId) return
    const onClick = (ev: MouseEvent) => {
      const target = ev.target as HTMLElement | null
      const classified = classifyGuidePointerTarget(target)
      if (!classified) return

      if (
        classified.kind === 'dynamic' &&
        classified.domain === 'ui' &&
        classified.action === 'pointer_click'
      ) {
        const label = String((classified.detail as { label?: string } | undefined)?.label || '')
        if (
          pathname.includes('/dashboard/routes/attempt-replay') &&
          label &&
          /^(Reproducir|Pausa)$/i.test(label) &&
          Date.now() - replayStructuralAtRef.current < 1100
        ) {
          return
        }
      }

      affectiveWorldRef.current.ingestTrigger(classified)

      const clickLabel =
        classified.kind === 'dynamic'
          ? [
              `${classified.domain}.${classified.action}`,
              classified.subject,
              (classified.detail as { label?: string } | undefined)?.label,
            ]
              .filter(Boolean)
              .join(' · ')
              .slice(0, 120)
          : classified.id

      const clickEvent: GuideUiEvent = {
        type: 'click',
        pathname,
        label: clickLabel || 'interaction',
        timestamp: Date.now(),
      }

      const throttleMapCanvas =
        classified.kind === 'dynamic' &&
        classified.domain === 'map' &&
        classified.action === 'canvas_click'
      if (throttleMapCanvas) {
        const now = Date.now()
        if (now - lastMapCanvasCoachAtRef.current < GUIDE_MAP_CANVAS_COACH_THROTTLE_MS) return
        lastMapCanvasCoachAtRef.current = now
      }

      void (async () => {
        try {
          const clickKey = `${pathname}|${clickLabel}`
          const last = lastClickReactionRef.current
          if (last && last.key === clickKey && Date.now() - last.at < 6500) return
          lastClickReactionRef.current = { key: clickKey, at: Date.now() }

          const snap = pageGuideContextRef.current
          const sameSession =
            snap &&
            snap.pathname === pathname &&
            (snap.routeId ?? null) === (contextualRouteId ?? null) &&
            (snap.attemptId ?? null) === (contextualAttemptId ?? null)
          let ctx: GuideContext
          if (sameSession && snap) {
            ctx = {
              ...snap,
              gpsHint: petClientHints.gpsHint,
              networkOnline: petClientHints.networkOnline,
            }
            pageGuideContextRef.current = ctx
          } else {
            ctx = (await provider.getContext({
              pathname,
              userId,
              geo: approxGeo ?? undefined,
              routeId: contextualRouteId,
              attemptId: contextualAttemptId || undefined,
              clientHints: petClientHints,
            })) as GuideContext
            pageGuideContextRef.current = ctx
          }
          const reaction = await runLlmReaction(() =>
            generateGuideReactionWithLightLlm({
              context: ctx,
              event: clickEvent,
              sessionReplaySignals:
                pathname.includes('/dashboard/routes/attempt-replay') && sessionReplaySignalsRef.current.length
                  ? [...sessionReplaySignalsRef.current]
                  : undefined,
              affectiveAugment: buildAffectiveAugmentForLlm(affectiveWorldRef.current, ctx),
              sessionHint: buildGuideInteractionSessionHint({
                viewEnteredAtMs: viewEnteredAtRef.current,
                recentCoachTitlesLower: spokenTitlesRef.current,
                lastTriggerType: 'click',
              }),
            })
          )
          setExternalEvent({
            mood: reaction.mood,
            title: reaction.title,
            subtitle: reaction.subtitle,
            duration: reaction.duration,
            source: 'manual',
          })
          lastSpokenAtRef.current = Date.now()
          spokenTitlesRef.current = [...spokenTitlesRef.current.slice(-5), reaction.title.trim().toLowerCase()]
        } catch {
          setExternalEvent({
            mood: 'guide',
            title: 'Acción detectada',
            subtitle: `Veo tu acción: ${clickLabel}. Te sigo acompañando.`,
            duration: 3800,
            source: 'manual',
            toastType: 'info',
          })
          setMessageVisible(true)
        }
      })()
    }

    window.addEventListener('click', onClick, { passive: true })
    return () => window.removeEventListener('click', onClick)
  }, [pathname, userId, provider, approxGeo, contextualRouteId, contextualAttemptId, petClientHints])

  useEffect(() => {
    bindRiderGuideChannel((payload) => {
      setExternalEvent(payload)
      setMessageVisible(true)
      if (payload.source === 'toast') {
        setToastGlanceKey((k) => k + 1)
      }
      if (externalResetRef.current) clearTimeout(externalResetRef.current)
      externalResetRef.current = window.setTimeout(
        () => {
          setExternalEvent(null)
          setMessageVisible(false)
        },
        payload.duration ?? 4200
      )
    })
    return () => {
      bindRiderGuideChannel(null)
      if (externalResetRef.current) clearTimeout(externalResetRef.current)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const onVoiceNavigate = (ev: Event) => {
      if (!userId) return
      const ce = ev as CustomEvent<{ path?: string; source?: string }>
      const path = typeof ce.detail?.path === 'string' ? ce.detail.path.trim() : ''
      const srcRaw = ce.detail?.source
      const source = srcRaw === 'shortcut' || srcRaw === 'builtin' ? srcRaw : 'builtin'
      if (!path.startsWith('/dashboard')) return

      const now = Date.now()
      if (now - lastVoiceNavigateGuideAtRef.current < 3200) return
      lastVoiceNavigateGuideAtRef.current = now

      void (async () => {
        try {
          affectiveWorldRef.current.ingestAppTrigger('voice.navigate', { path, source })
          const ctx = (await provider.getContext({
            pathname: path,
            userId,
            geo: approxGeo ?? undefined,
            routeId: null,
            attemptId: undefined,
            clientHints: petClientHints,
          })) as GuideContext
          if (cancelled) return
          pageGuideContextRef.current = ctx

          const guideEvent: GuideUiEvent = {
            type: 'click',
            pathname: path,
            label: `voice:navigate:${source}`,
            timestamp: Date.now(),
          }
          const reaction = await runLlmReaction(() =>
            generateGuideReactionWithLightLlm({
              context: ctx,
              event: guideEvent,
              executeMcpTools: false,
              affectiveAugment: buildAffectiveAugmentForLlm(affectiveWorldRef.current, ctx),
              sessionHint: buildGuideInteractionSessionHint({
                viewEnteredAtMs: viewEnteredAtRef.current,
                recentCoachTitlesLower: spokenTitlesRef.current,
                lastTriggerType: 'click',
              }),
            })
          )
          if (cancelled) return

          setExternalEvent({
            mood: reaction.mood,
            title: reaction.title,
            subtitle: reaction.subtitle,
            duration: Math.min(8500, Math.max(3800, reaction.duration)),
            source: 'navigation',
            toastType: mapReactionMoodToToastType(reaction.mood),
          })
          setMessageVisible(true)
        } catch {
          /* turno opcional */
        }
      })()
    }

    window.addEventListener(GDH_VOICE_NAVIGATE_EVENT, onVoiceNavigate as EventListener)
    return () => {
      cancelled = true
      window.removeEventListener(GDH_VOICE_NAVIGATE_EVENT, onVoiceNavigate as EventListener)
    }
  }, [userId, provider, runLlmReaction, petClientHints, approxGeo])

  useEffect(() => {
    if (!externalEvent) return
    setMessageVisible(true)
    if (externalResetRef.current) clearTimeout(externalResetRef.current)
    externalResetRef.current = window.setTimeout(
      () => {
        setExternalEvent(null)
        setMessageVisible(false)
      },
      externalEvent.duration ?? 4200
    )
  }, [externalEvent])

  /** Durante un toast, la mirada del atlas se renueva unas pocas veces para acompañar todo el aviso. */
  useEffect(() => {
    if (externalEvent?.source !== 'toast') return
    const repeatMs = 2400
    const id = window.setInterval(() => setToastGlanceKey((k) => k + 1), repeatMs)
    return () => window.clearInterval(id)
  }, [
    externalEvent?.source,
    externalEvent?.title,
    externalEvent?.toastType,
    externalEvent?.duration,
  ])

  const mood: RiderMood = useMemo(() => {
    if (externalEvent?.mood) return externalEvent.mood
    return decideRiderEmotion({
      pathname,
      loading: isLoadingPulse,
      recentTriumph: signal.recentTriumph,
      fatigue: signal.fatigue,
      topRouteName: signal.topRouteName,
      topRouteKm: signal.topRouteKm,
      weeklyKm: signal.weeklyKm,
    }).mood
   }, [externalEvent, isLoadingPulse, signal, pathname])

   const orchestration = decideRiderEmotion({
     pathname,
     loading: isLoadingPulse,
     recentTriumph: signal.recentTriumph,
     fatigue: signal.fatigue,
     topRouteName: signal.topRouteName,
     topRouteKm: signal.topRouteKm,
     weeklyKm: signal.weeklyKm,
   })
   const activeTitle = externalEvent?.title || orchestration.title || ''
   const activeSubtitle = externalEvent?.subtitle || orchestration.subtitle || ''
   const showMessageBubble = messageVisible && (!!externalEvent || isLoadingPulse)

  const petEmotion = useMemo(
    () =>
      resolveDashboardPetAtlasEmotion({
        pathname,
        riderMood: mood,
        guideBubbleSource: externalEvent?.source ?? null,
        guidePetMood: petMood,
      }),
    [mood, pathname, externalEvent?.source, petMood]
  )

  /** Grabación: pet abajo a la izquierda para no cubrir botones/texto del header. */
  const recordBottomDock = pathname.includes('/dashboard/routes/record')
  /** Ficha de ruta: dock inferior izquierdo para no tapar título, edición ni mapa. */
  const routeViewCoachDock = pathname.includes('/dashboard/routes/view')
  /** Resto del dashboard: dock inferior (no compite con cabeceras sticky ni con el FAB del nav). */
  const floatingMainCoachDock = !recordBottomDock && !routeViewCoachDock

  /** Con ancla inferior la burbuja abre hacia arriba. */
  const glanceDir: 'above' | 'below' =
    recordBottomDock || routeViewCoachDock || floatingMainCoachDock ? 'above' : 'below'

  const recordCoachShellClass =
    'pointer-events-none fixed z-[44] bottom-[max(7.25rem,calc(env(safe-area-inset-bottom)+6.25rem))] left-3 sm:left-4'
  const routeViewCoachShellClass =
    'pointer-events-none fixed z-[44] bottom-[max(10.75rem,calc(env(safe-area-inset-bottom)+9.5rem))] left-3 sm:left-4'
  const floatingCoachShellClass =
    'pointer-events-none fixed z-[44] left-3 bottom-[max(6.5rem,calc(env(safe-area-inset-bottom)+5.25rem))] sm:left-4'

   const hideCoachBubbleForVoice =
      guideTtsEnabled &&
      !!externalEvent &&
      externalEvent.source !== 'toast' &&
      messageVisible &&
     !isLoadingPulse
     const showRouteViewMenu = pathname.includes('/dashboard/routes/view')

  const coachPetVisible = petVisible && !sidebarOpen

   const commonCoachNotificationProps = {
     mood,
     externalEventSource: externalEvent?.source,
     externalEventToastType: externalEvent?.toastType,
     guideLlmThinking,
     petMood: (petMood ?? 'neutral') as GuidePetMood,
     petVisible: coachPetVisible,
     petEmotion,
     petAiMindState,
     toastGlanceKey,
     activeTitle,
     activeSubtitle,
     isLoadingPulse,
     showMessageBubble: showMessageBubble && !hideCoachBubbleForVoice,
     hideForVoice: hideCoachBubbleForVoice,
     onSetMessageVisible: setMessageVisible,
   }

   if (recordBottomDock) {
     return (
       <div className={recordCoachShellClass}>
         <RecordDockCoach {...commonCoachNotificationProps} />
       </div>
     )
   }

  const coachInHeader =
    wantsHeaderCoach && !!headerCoachSlotEl && !voiceCoach.hidden && !sidebarOpen

  const routeViewBottomDockEl =
    routeViewCoachDock && !coachInHeader && !voiceCoach.hidden && !sidebarOpen ? (
      <div className={routeViewCoachShellClass}>
        <RouteViewCoachCluster
          {...commonCoachNotificationProps}
          layout="docked"
          showRouteViewMenu={showRouteViewMenu}
          sidebarOpen={sidebarOpen}
          openSidebar={openSidebar}
          voiceCoach={voiceCoach}
        />
      </div>
    ) : null

  const coachHandFloating =
    !coachInHeader && !recordBottomDock && !routeViewCoachDock && !voiceCoach.hidden && !sidebarOpen ? (
      <div className={floatingCoachShellClass}>
        <div className={`${COACH_DOCK_CLUSTER_CLASS} pointer-events-auto`}>
          <CoachNotification
            {...commonCoachNotificationProps}
            glanceDir={glanceDir}
            isSidebar={false}
          />
          <VoiceControlPanel voiceCoach={voiceCoach} />
        </div>
      </div>
    ) : null

  const headerCoachPortal =
    coachInHeader && headerCoachSlotEl
      ? createPortal(
          routeViewCoachDock ? (
            <RouteViewCoachCluster
              {...commonCoachNotificationProps}
              layout="header"
              showRouteViewMenu={showRouteViewMenu}
              sidebarOpen={sidebarOpen}
              openSidebar={openSidebar}
              voiceCoach={voiceCoach}
            />
          ) : (
            <div className={`${COACH_HEADER_CLUSTER_CLASS} pointer-events-auto`}>
              <CoachNotification
                {...commonCoachNotificationProps}
                glanceDir="below"
                density="header"
                bubbleLayout="underOrb"
                isSidebar={false}
              />
              <VoiceControlPanel voiceCoach={voiceCoach} density="header" />
            </div>
          ),
          headerCoachSlotEl,
        )
      : null

   const petPortal =
     sidebarOpen && sidebarPetSlot
       ? createPortal(
           <SidebarPetContent {...commonCoachNotificationProps} petVisible={petVisible} />,
           sidebarPetSlot,
         )
       : null

  return (
    <>
      {petPortal}
      {headerCoachPortal}
      {routeViewBottomDockEl}
      {coachHandFloating}
    </>
  )
}
