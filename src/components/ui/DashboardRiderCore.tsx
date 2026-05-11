'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname, useSearchParams } from 'next/navigation'
import { GuardDhPet } from '@/components/pet/GuardDhPet'
import type { PetAiMindState } from '@/components/pet/GuardDhPetAtlas'
import {
  clearGuidePetMood,
  inferPetMoodFromAttemptSummary,
  inferPetMoodFromCurrentRoute,
  inferPetMoodFromReplayAction,
  inferPetMoodFromReplayLive,
  publishGuidePetMood,
  publishGuidePetThinking,
  useGuidePetStore,
} from '@/lib/pet/guidePetBridge'
import { resolveDashboardPetAtlasEmotion } from '@/lib/pet/resolveDashboardPetAtlasEmotion'
import {
  GUARDDH_GUIDE_REPLAY_EVENT,
  GUARDDH_PET_REPLAY_TICK,
  type GuideReplayTelemetryDetail,
  type PetReplayTickDetail,
} from '@/lib/guide-ai/guideUiTelemetry'
import { inferScreenKind } from '@/lib/guide-ai/guideInteractionCatalog'
import { buildNavigationWarmup } from '@/lib/guide-ai/guideNavigationWarmup'
import { GuidePetMoodEyesOverlay } from '@/components/pet/GuidePetMoodEyesOverlay'
import { createClient } from '@/core/infrastructure/supabase/client'
import { BrandSpinner } from '@/components/ui/BrandLogoLoader'
import {
  bindRiderGuideChannel,
  type RiderGuideMood,
  type RiderGuidePayload,
  type RiderGuideToastType,
} from '@/lib/riderGuide'
import { animate } from '@/lib/animeUi'
import type { JSAnimation } from 'animejs'
import { decideRiderEmotion } from '@/lib/emotion/EmotionOrchestrator'
import { SupabaseGuideDataProvider } from '@/lib/guide-ai/providers/SupabaseGuideDataProvider'
import { McpSupabaseGuideProvider } from '@/lib/guide-ai/providers/McpSupabaseGuideProvider'
import {
  executeDashboardReactiveGuideTurn,
  mapReactionMoodToToastType,
} from '@/lib/guide-ai/guideDashboardReactiveTurn'
import { generateGuideReactionWithLightLlm, warmupGuideLlmEngine } from '@/lib/guide-ai/lightweightGuideLlm'
import type { GuideContext, GuideGpsHint, GuideSessionReplaySignal, GuideUiEvent } from '@/lib/guide-ai/types'
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
import { Menu, Mic, MicOff, Volume2, Sparkles, BookmarkPlus, Hand } from 'lucide-react'
import {
  buildAffectivePromptAugment,
  classifyGuidePointerTarget,
  GuideWorldStateController,
  inferNavTriggerFromPathname,
} from '@/lib/affective'
import {
  GUIDE_MAIN_SCROLL_BUCKET_PX,
  GUIDE_MAIN_SCROLL_DEBOUNCE_MS,
  GUIDE_MAP_CANVAS_COACH_THROTTLE_MS,
} from '@/lib/affective/config/guideUiTiming'

const SIDEBAR_PET_SLOT_ID = 'gdh-sidebar-pet-slot'

function buildAffectiveAugmentForLlm(world: GuideWorldStateController, ctx: GuideContext) {
  world.ingestFromGuideContext(ctx)
  return buildAffectivePromptAugment(world.getSnapshot())
}

/** Visible feedback: sin WebGPU la función LLM termina casi al instante; damos tiempo mínimo al foco "pensando". */
const MIN_GUIDE_THINKING_MS = 420

type RiderMood = RiderGuideMood

type RiderSignal = {
  recentTriumph: boolean
  fatigue: boolean
  topRouteName?: string | null
  topRouteKm?: number | null
  weeklyKm?: number | null
  approxLat?: number | null
  approxLng?: number | null
}

type RiderVisualTokens = {
  glow: string
  ring: string
  text: string
  bubbleClass: string
  caretClass: string
  subtitleClass: string
}

function toastPresentation(flavor: RiderGuideToastType): RiderVisualTokens {
  switch (flavor) {
    case 'success':
      return {
        glow: 'from-emerald-400/55 via-teal-400/35 to-cyan-400/35',
        ring: 'border-emerald-400/70',
        text: 'text-emerald-100',
        bubbleClass:
          'relative rounded-xl border border-emerald-400/35 bg-[#0a1614]/95 px-3 py-2 text-center shadow-[0_10px_28px_rgba(16,185,129,0.18)] backdrop-blur',
        caretClass:
          'absolute top-[-6px] h-3 w-3 rotate-45 border-l border-t border-emerald-400/35 bg-[#0a1614]/95',
        subtitleClass: 'text-emerald-200/88',
      }
    case 'error':
      return {
        glow: 'from-rose-500/50 via-red-500/35 to-fuchsia-500/28',
        ring: 'border-rose-400/70',
        text: 'text-rose-100',
        bubbleClass:
          'relative rounded-xl border border-rose-400/40 bg-[#160d11]/95 px-3 py-2 text-center shadow-[0_10px_28px_rgba(244,63,94,0.2)] backdrop-blur',
        caretClass:
          'absolute top-[-6px] h-3 w-3 rotate-45 border-l border-t border-rose-400/40 bg-[#160d11]/95',
        subtitleClass: 'text-rose-200/85',
      }
    case 'warning':
      return {
        glow: 'from-amber-500/50 via-yellow-400/35 to-orange-400/28',
        ring: 'border-amber-400/65',
        text: 'text-amber-100',
        bubbleClass:
          'relative rounded-xl border border-amber-400/38 bg-[#16120b]/95 px-3 py-2 text-center shadow-[0_10px_28px_rgba(245,158,11,0.18)] backdrop-blur',
        caretClass:
          'absolute top-[-6px] h-3 w-3 rotate-45 border-l border-t border-amber-400/38 bg-[#16120b]/95',
        subtitleClass: 'text-amber-200/85',
      }
    default:
      return {
        glow: 'from-sky-500/45 via-cyan-500/28 to-indigo-500/28',
        ring: 'border-sky-400/65',
        text: 'text-sky-100',
        bubbleClass:
          'relative rounded-xl border border-sky-400/38 bg-[#0c141f]/95 px-3 py-2 text-center shadow-[0_10px_28px_rgba(56,189,248,0.15)] backdrop-blur',
        caretClass:
          'absolute top-[-6px] h-3 w-3 rotate-45 border-l border-t border-sky-400/38 bg-[#0c141f]/95',
        subtitleClass: 'text-sky-200/85',
      }
  }
}

/** Caret que apunta hacia el orbe (burbuja encima del pet en modo dock inferior). */
function toastCaretAboveOrb(flavor: RiderGuideToastType, anchor: 'left' | 'right'): string {
  const x = anchor === 'left' ? 'left-[22px]' : 'right-[22px]'
  const base =
    `absolute bottom-[-6px] h-3 w-3 rotate-45 border-r border-b ${x}`
  switch (flavor) {
    case 'success':
      return `${base} border-emerald-400/35 bg-[#0a1614]/95`
    case 'error':
      return `${base} border-rose-400/40 bg-[#160d11]/95`
    case 'warning':
      return `${base} border-amber-400/38 bg-[#16120b]/95`
    default:
      return `${base} border-sky-400/38 bg-[#0c141f]/95`
  }
}

function moodConfig(mood: RiderMood) {
  if (mood === 'loading') {
    return {
      title: 'Sincronizando',
      subtitle: 'Leyendo terreno y ritmo.',
      glow: 'from-sky-400/45 via-cyan-400/25 to-teal-400/35',
      ring: 'border-cyan-300/50',
      text: 'text-cyan-100',
    }
  }
  if (mood === 'triumph') {
    return {
      title: 'Eso fue elite',
      subtitle: 'Cierre con actitud de campeon.',
      glow: 'from-amber-400/45 via-orange-400/25 to-yellow-300/30',
      ring: 'border-amber-300/60',
      text: 'text-amber-100',
    }
  }
  if (mood === 'fatigue') {
    return {
      title: 'Baja pulsaciones',
      subtitle: 'Recupera control y vuelve fuerte.',
      glow: 'from-fuchsia-500/35 via-violet-500/25 to-cyan-400/28',
      ring: 'border-violet-300/55',
      text: 'text-violet-100',
    }
  }
  if (mood === 'focus') {
    return {
      title: 'Modo precision',
      subtitle: 'Linea limpia y mirada adelante.',
      glow: 'from-teal-400/45 via-cyan-400/25 to-sky-400/30',
      ring: 'border-teal-300/60',
      text: 'text-teal-100',
    }
  }
  if (mood === 'warning') {
    return {
      title: 'Atento rider',
      subtitle: 'Hay una alerta que revisar.',
      glow: 'from-amber-500/45 via-yellow-400/30 to-orange-400/30',
      ring: 'border-amber-300/60',
      text: 'text-amber-100',
    }
  }
  if (mood === 'error') {
    return {
      title: 'Algo salio mal',
      subtitle: 'Corrijamos esto y seguimos.',
      glow: 'from-rose-500/45 via-red-500/30 to-fuchsia-500/25',
      ring: 'border-rose-300/60',
      text: 'text-rose-100',
    }
  }
  return {
    title: 'Estoy contigo rider',
    subtitle: 'Te guio en cada decision.',
    glow: 'from-cyan-400/35 via-indigo-500/20 to-teal-400/30',
    ring: 'border-cyan-200/45',
    text: 'text-cyan-100',
  }
}

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
  const [coachToolsOpen, setCoachToolsOpen] = useState(false)
  const coachToolsWrapRef = useRef<HTMLDivElement>(null)

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
    if (!coachToolsOpen) return
    const onDown = (e: MouseEvent) => {
      const el = coachToolsWrapRef.current
      if (el && !el.contains(e.target as Node)) setCoachToolsOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [coachToolsOpen])

  useEffect(() => {
    setCoachToolsOpen(false)
  }, [pathname])

  const petMood = useGuidePetStore((s) => s.petMood)
  /** Snapshot de pantalla para turnos extra sin nuevo getContext / MCP. */
  const pageGuideContextRef = useRef<GuideContext | null>(null)

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
  const glowRef = useRef<HTMLDivElement>(null)
  const orbRef = useRef<HTMLDivElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const iconRef = useRef<HTMLDivElement>(null)
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
  const currentViewKeyRef = useRef<string>('')
  const spokenTitlesRef = useRef<string[]>([])
  const lastSpokenAtRef = useRef<number>(0)
  const sessionReplaySignalsRef = useRef<GuideSessionReplaySignal[]>([])
  const replayStructuralAtRef = useRef(0)
  const lastReplayLlmAtRef = useRef(0)
  /** Turnos WebLLM “coach” mientras corre el replay GPS (además de play/pause/seek). */
  const lastReplayCoachLlmAtRef = useRef(0)
  const replayCoachInFlightRef = useRef(false)
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
    sessionReplaySignalsRef.current = []
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
          if (last && last.key === clickKey && Date.now() - last.at < 4000) return
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
    const onReplay = (ev: Event) => {
      const raw = (ev as CustomEvent<GuideReplayTelemetryDetail>).detail
      if (!raw || typeof raw.action !== 'string') return
      if (!(pathname || '').includes('/dashboard/routes/attempt-replay')) return
      if (!userId) return

      const entry: GuideSessionReplaySignal = {
        kind: 'replay_signal',
        action: raw.action,
        elapsed_sec: raw.elapsed_sec,
        speed_kmh: raw.speed_kmh,
        altitude_m: raw.altitude_m,
        at: Date.now(),
      }
      sessionReplaySignalsRef.current = [...sessionReplaySignalsRef.current, entry].slice(-12)
      affectiveWorldRef.current.ingestReplayStructuralTail(sessionReplaySignalsRef.current)
      if (raw.action === 'play' || raw.action === 'pause' || raw.action === 'seek') {
        affectiveWorldRef.current.ingestAppTrigger(`replay.user.${raw.action}`, {
          elapsed_sec: raw.elapsed_sec,
        })
      }
      replayStructuralAtRef.current = Date.now()

      publishGuidePetMood({
        petMood: inferPetMoodFromReplayAction(
          raw.action,
          raw.speed_kmh,
          raw.altitude_m,
          raw.playing
        ),
      })

      if (Date.now() - lastReplayLlmAtRef.current < 850) return
      lastReplayLlmAtRef.current = Date.now()

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
            pageGuideContextRef.current = ctx
          }
          const trace = [...sessionReplaySignalsRef.current]
          const replayEvent: GuideUiEvent = {
            type: 'click',
            pathname,
            label: `replay:${raw.action}`,
            timestamp: Date.now(),
          }
          affectiveWorldRef.current.ingestAppTrigger('coach.replay_context_llm', {
            replay_action: raw.action,
          })
          const reaction = await runLlmReaction(() =>
            generateGuideReactionWithLightLlm({
              context: ctx,
              event: replayEvent,
              executeMcpTools: false,
              sessionReplaySignals: trace,
              affectiveAugment: buildAffectiveAugmentForLlm(affectiveWorldRef.current, ctx),
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
          setMessageVisible(true)
        } catch {
          // noop
        }
      })()
    }

    window.addEventListener(GUARDDH_GUIDE_REPLAY_EVENT, onReplay as EventListener)
    return () => window.removeEventListener(GUARDDH_GUIDE_REPLAY_EVENT, onReplay as EventListener)
  }, [
    pathname,
    userId,
    provider,
    approxGeo,
    contextualRouteId,
    contextualAttemptId,
    petClientHints,
    runLlmReaction,
  ])

  useEffect(() => {
    const onPetReplayTick = (ev: Event) => {
      const raw = (ev as CustomEvent<PetReplayTickDetail>).detail
      if (!raw) return
      if (!(pathname || '').includes('/dashboard/routes/attempt-replay')) return
      if (!userId) return
      publishGuidePetMood({
        petMood: inferPetMoodFromReplayLive(raw.playing, raw.speed_kmh, raw.altitude_m, {
          vertical_mode: raw.vertical_mode ?? null,
          uphill_pedaling_likely: raw.uphill_pedaling_likely,
        }),
      })

      if (
        raw.playing &&
        typeof raw.elapsed_sec === 'number' &&
        Number.isFinite(raw.elapsed_sec)
      ) {
        const entry: GuideSessionReplaySignal = {
          kind: 'replay_signal',
          action: 'tick',
          elapsed_sec: raw.elapsed_sec,
          speed_kmh: raw.speed_kmh,
          altitude_m: raw.altitude_m,
          at: Date.now(),
          grade_pct_est: raw.grade_pct_est ?? null,
          vertical_mode: raw.vertical_mode ?? null,
          uphill_pedaling_likely: raw.uphill_pedaling_likely ?? null,
        }
        const sigs = sessionReplaySignalsRef.current
        const lastSig = sigs[sigs.length - 1]
        sessionReplaySignalsRef.current =
          lastSig?.action === 'tick'
            ? [...sigs.slice(0, -1), entry].slice(-12)
            : [...sigs, entry].slice(-12)
      }
      if (typeof raw.elapsed_sec === 'number' && Number.isFinite(raw.elapsed_sec)) {
        affectiveWorldRef.current.ingestReplayTick(raw)
      }

      if (!raw.playing) return
      if (typeof raw.elapsed_sec !== 'number' || !Number.isFinite(raw.elapsed_sec) || raw.elapsed_sec < 5) return
      const tickNow = Date.now()
      if (tickNow - lastReplayCoachLlmAtRef.current < 11_000) return
      if (typeof document !== 'undefined' && document.hidden) return
      if (replayCoachInFlightRef.current) return

      void (async () => {
        replayCoachInFlightRef.current = true
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
            pageGuideContextRef.current = ctx
          }

          const trace = [...sessionReplaySignalsRef.current]
          const coachEvent: GuideUiEvent = {
            type: 'data-refresh',
            pathname,
            label: 'interactive:replay_coach_tick',
            timestamp: Date.now(),
          }
          affectiveWorldRef.current.ingestAppTrigger('coach.replay_coach_tick', {
            elapsed_sec: raw.elapsed_sec,
          })
          const reaction = await runLlmReaction(() =>
            generateGuideReactionWithLightLlm({
              context: ctx,
              event: coachEvent,
              executeMcpTools: false,
              sessionReplaySignals: trace.length ? trace : undefined,
              affectiveAugment: buildAffectiveAugmentForLlm(affectiveWorldRef.current, ctx),
            })
          )
          lastReplayCoachLlmAtRef.current = Date.now()
          const elapsedCoach =
            typeof raw.elapsed_sec === 'number' && Number.isFinite(raw.elapsed_sec) ? raw.elapsed_sec : 0
          const timeBucket = Math.floor(elapsedCoach / 14)
          const subKey =
            reaction.subtitle.trim().toLowerCase().slice(0, 64) ||
            reaction.title.trim().toLowerCase().slice(0, 48)
          const key = `replay_coach:${timeBucket}:${subKey}`
          if (!subKey || spokenTitlesRef.current.includes(key)) return
          spokenTitlesRef.current = [...spokenTitlesRef.current.slice(-9), key]
          lastSpokenAtRef.current = Date.now()
          setExternalEvent({
            mood: reaction.mood,
            title: reaction.title,
            subtitle: reaction.subtitle,
            duration: Math.min(9000, Math.max(5200, reaction.duration)),
            source: 'navigation',
            toastType: mapReactionMoodToToastType(reaction.mood),
          })
          setMessageVisible(true)
        } catch {
          lastReplayCoachLlmAtRef.current = Date.now()
          /* coach opcional: sin motor o error, no molestamos */
        } finally {
          replayCoachInFlightRef.current = false
        }
      })()
    }
    window.addEventListener(GUARDDH_PET_REPLAY_TICK, onPetReplayTick as EventListener)
    return () => window.removeEventListener(GUARDDH_PET_REPLAY_TICK, onPetReplayTick as EventListener)
  }, [
    pathname,
    userId,
    provider,
    runLlmReaction,
    petClientHints,
    contextualRouteId,
    contextualAttemptId,
    approxGeo,
  ])

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

  const cfg = moodConfig(mood)
  const toastSkin =
    externalEvent?.source === 'toast' && externalEvent.toastType
      ? toastPresentation(externalEvent.toastType)
      : null
  const orchestration = decideRiderEmotion({
    pathname,
    loading: isLoadingPulse,
    recentTriumph: signal.recentTriumph,
    fatigue: signal.fatigue,
    topRouteName: signal.topRouteName,
    topRouteKm: signal.topRouteKm,
    weeklyKm: signal.weeklyKm,
  })
  const activeTitle = externalEvent?.title || orchestration.title || cfg.title
  const activeSubtitle = externalEvent?.subtitle || orchestration.subtitle || cfg.subtitle
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

  const anchor = useMemo(() => {
    if (recordBottomDock) return 'left'
    if (pathname === '/dashboard') return 'left'
    if (pathname.includes('/dashboard/routes/view')) return 'left'
    return 'left'
  }, [pathname, recordBottomDock])

  useEffect(() => {
    const animations: JSAnimation[] = []
    if (glowRef.current) {
      animations.push(
        animate(glowRef.current, {
          opacity: [0.45, 0.9, 0.45],
          scale: [0.94, 1.06, 0.94],
          duration: 2100,
          ease: 'inOutSine',
          loop: true,
        })
      )
    }

    const toastFlavor =
      externalEvent?.source === 'toast' ? externalEvent.toastType : undefined

    if (orbRef.current) {
      const triumphBob =
        mood === 'triumph' || toastFlavor === 'success'
      animations.push(
        animate(orbRef.current, {
          y: triumphBob ? [0, -2, 0] : [0, -0.6, 0],
          duration: triumphBob ? 820 : 1600,
          ease: 'inOutSine',
          loop: true,
        })
      )
      if (mood === 'loading') {
        animations.push(
          animate(orbRef.current, {
            rotate: ['0deg', '4deg', '-4deg', '0deg'],
            duration: 900,
            ease: 'inOutSine',
            loop: true,
          })
        )
      } else if (mood === 'warning' || toastFlavor === 'warning') {
        animations.push(
          animate(orbRef.current, {
            x: [0, -1.5, 1.5, 0],
            duration: 520,
            ease: 'inOutSine',
            loop: true,
          })
        )
      } else if (mood === 'error' || toastFlavor === 'error') {
        animations.push(
          animate(orbRef.current, {
            x: [0, -2.2, 2.2, 0],
            rotate: ['0deg', '-2.5deg', '2.5deg', '0deg'],
            duration: 380,
            ease: 'inOutSine',
            loop: true,
          })
        )
      } else if (mood === 'focus' || toastFlavor === 'info') {
        animations.push(
          animate(orbRef.current, {
            scale: [1, 1.035, 1],
            duration: 1200,
            ease: 'inOutSine',
            loop: true,
          })
        )
      }
    }

    if (iconRef.current) {
      animations.push(
        animate(iconRef.current, {
          opacity: [0, 1],
          scale: [0.76, 1],
          y: [4, 0],
          duration: 240,
          ease: 'outCubic',
        })
      )
    }

    if (bubbleRef.current) {
      animations.push(
        animate(bubbleRef.current, {
          opacity: [0, 1],
          y: [-6, 0],
          scale: [0.95, 1],
          duration: 230,
          ease: 'outCubic',
        })
      )
    }

    return () => {
      animations.forEach((a) => a.revert())
    }
  }, [
    mood,
    activeTitle,
    activeSubtitle,
    messageVisible,
    externalEvent?.source,
    externalEvent?.toastType,
    sidebarOpen,
  ])

  useEffect(() => {
    if (!toastGlanceKey || !orbRef.current) return
    void animate(orbRef.current, {
      scale: [1, 1.07, 1],
      duration: 420,
      ease: 'outQuad',
    })
  }, [toastGlanceKey])

  const glanceDir =
    recordBottomDock || routeViewCoachDock ? ('above' as const) : ('below' as const)

  const outerLayoutClass = recordBottomDock
    ? 'pointer-events-none fixed z-[26] bottom-[max(7.25rem,calc(env(safe-area-inset-bottom)+6.25rem))] left-3 sm:left-4'
    : routeViewCoachDock
      ? 'pointer-events-none fixed z-[26] bottom-[max(10.75rem,calc(env(safe-area-inset-bottom)+9.5rem))] left-3 sm:left-4'
      : `pointer-events-none fixed z-[26] top-2 mt-[max(0.1rem,env(safe-area-inset-top))] ${
          anchor === 'left' ? 'left-3' : 'right-3'
        }`

  const defaultCaretClass =
    'absolute top-[-6px] h-3 w-3 rotate-45 border-l border-t border-white/10 bg-[#121b27]/90'
  const defaultCaretAboveOrbClass = `absolute bottom-[-6px] h-3 w-3 rotate-45 border-r border-b border-white/10 bg-[#121b27]/90 ${
    anchor === 'left' ? 'left-[22px]' : 'right-[22px]'
  }`

  const bubbleCaretClass = (() => {
    if (recordBottomDock) {
      if (toastSkin && externalEvent?.toastType) {
        return toastCaretAboveOrb(externalEvent.toastType, anchor === 'right' ? 'right' : 'left')
      }
      return defaultCaretAboveOrbClass
    }
    if (routeViewCoachDock) {
      if (toastSkin && externalEvent?.toastType) {
        return toastCaretAboveOrb(externalEvent.toastType, anchor === 'right' ? 'right' : 'left')
      }
      return defaultCaretAboveOrbClass
    }
    return `${toastSkin?.caretClass ?? defaultCaretClass} ${
      anchor === 'left' ? 'left-[22px]' : 'right-[22px]'
    }`
  })()

  const hideCoachBubbleForVoice =
    guideTtsEnabled &&
    !!externalEvent &&
    externalEvent.source !== 'toast' &&
    messageVisible &&
    !isLoadingPulse
  const showRouteViewMenu = pathname.includes('/dashboard/routes/view')

  const bubbleInner = (
    <>
      <div className={bubbleCaretClass} />
      <p className={`text-[11px] font-semibold ${toastSkin?.text ?? cfg.text}`}>{activeTitle}</p>
      <p className={`mt-0.5 text-[10px] ${toastSkin?.subtitleClass ?? 'text-slate-300'}`}>{activeSubtitle}</p>
    </>
  )

  if (recordBottomDock) {
    return (
      <div className={outerLayoutClass}>
        <div className="relative flex flex-col items-start overflow-visible gap-2">
          {recordBottomDock && showMessageBubble && !hideCoachBubbleForVoice ? (
            <div
              ref={bubbleRef}
              key={`${mood}-${activeTitle}-${toastSkin?.text ?? ''}-dock`}
              className={`relative shrink-0 ${anchor === 'left' ? '' : 'self-end'}`}
              style={{ width: '224px', maxWidth: 'calc(100vw - 1rem)' }}
            >
              <div
                className={
                  toastSkin?.bubbleClass ??
                  'relative rounded-xl border border-white/10 bg-[#121b27]/90 px-3 py-2 text-center shadow-[0_10px_20px_rgba(0,0,0,0.35)] backdrop-blur'
                }
              >
                {bubbleInner}
              </div>
            </div>
          ) : null}
          {hideCoachBubbleForVoice ? (
            <span className="sr-only">
              {activeTitle}. {activeSubtitle}
            </span>
          ) : null}

          <div className="relative shrink-0">
            <div
              ref={glowRef}
              className={`absolute -inset-2 rounded-full bg-gradient-to-br ${toastSkin?.glow ?? cfg.glow} blur-lg`}
            />

            <div
              ref={orbRef}
              className={`relative overflow-visible rounded-full border ${toastSkin?.ring ?? cfg.ring} bg-[#101722]/93 shadow-[0_10px_28px_rgba(0,0,0,0.42)] flex items-center justify-center`}
              style={{ width: 62, height: 62 }}
            >
              <div
                ref={iconRef}
                key={`${mood}-${externalEvent?.source === 'toast' ? externalEvent.toastType ?? 't' : 'nav'}`}
                className="relative flex items-center justify-center overflow-visible"
              >
                <GuardDhPet
                  emotion={petEmotion}
                  size={52}
                  toastGlanceSignal={toastGlanceKey}
                  toastGlanceDirection={glanceDir}
                  aiMindState={petAiMindState}
                />
                {externalEvent?.source !== 'toast' && guideLlmThinking ? (
                  <GuidePetMoodEyesOverlay mood={petMood} isThinking size={52} />
                ) : null}
                {mood === 'loading' ? (
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35 rounded-full">
                    <BrandSpinner size={22} />
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /** Fila completa (menú + voz + pet) solo en ficha de ruta con dock inferior. */
  const coachClusterRow = (
    <div className="pointer-events-auto flex flex-row items-start justify-start gap-1.5">
      {showRouteViewMenu && !sidebarOpen ? (
        <button
          type="button"
          onClick={() => openSidebar()}
          className="mt-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#121821]/90 text-slate-300 shadow-md hover:bg-white/10 hover:text-white"
          aria-label="Menú"
        >
          <Menu size={18} />
        </button>
      ) : null}

      {!voiceCoach.hidden ? (
        <div className="flex w-10 shrink-0 flex-col items-center gap-1.5 pt-1">
          <button
            type="button"
            onClick={() => voiceCoach.toggleListen()}
            disabled={!voiceCoach.supported}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600/90 text-white shadow-md hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
            aria-pressed={voiceCoach.listening}
            title={voiceCoach.listening ? voiceCoach.voice.stop : voiceCoach.voice.listen}
          >
            {voiceCoach.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
          <label className="flex cursor-pointer flex-col items-center gap-0.5 text-[9px] uppercase tracking-wide text-slate-500">
            <input
              type="checkbox"
              checked={voiceCoach.learnMode}
              onChange={(e) => voiceCoach.setLearnMode(e.target.checked)}
              className="sr-only"
            />
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-xl border ${
                voiceCoach.learnMode
                  ? 'border-amber-400/50 bg-amber-500/20 text-amber-200'
                  : 'border-white/10 bg-white/5 text-slate-500'
              }`}
              title={voiceCoach.voice.learnMode}
            >
              <Sparkles className="h-4 w-4" aria-hidden />
            </span>
          </label>
          {voiceCoach.pendingLearn ? (
            <button
              type="button"
              onClick={() => void voiceCoach.savePendingShortcut()}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-600 bg-slate-800/90 text-amber-300 hover:bg-slate-700"
              title={voiceCoach.voice.saveShortcut}
            >
              <BookmarkPlus className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="relative flex flex-col items-start overflow-visible">
        {showMessageBubble && !hideCoachBubbleForVoice ? (
          <div
            ref={bubbleRef}
            key={`${mood}-${activeTitle}-${toastSkin?.text ?? ''}`}
            className="absolute bottom-full left-0 mb-1.5 w-[224px] max-w-[calc(100vw-1rem)]"
          >
            <div
              className={
                toastSkin?.bubbleClass ??
                'relative rounded-xl border border-white/10 bg-[#121b27]/90 px-3 py-2 text-center shadow-[0_10px_20px_rgba(0,0,0,0.35)] backdrop-blur'
              }
            >
              {bubbleInner}
            </div>
          </div>
        ) : null}
        {hideCoachBubbleForVoice ? (
          <span className="sr-only">
            {activeTitle}. {activeSubtitle}
          </span>
        ) : null}

        <div className="relative shrink-0">
          <div
            ref={glowRef}
            className={`absolute -inset-2 rounded-full bg-gradient-to-br ${toastSkin?.glow ?? cfg.glow} blur-lg`}
          />

          <div
            ref={orbRef}
            className={`relative overflow-visible rounded-full border ${toastSkin?.ring ?? cfg.ring} bg-[#101722]/93 shadow-[0_10px_28px_rgba(0,0,0,0.42)] flex items-center justify-center`}
            style={{ width: 62, height: 62 }}
          >
            <div
              ref={iconRef}
              key={`${mood}-${externalEvent?.source === 'toast' ? externalEvent.toastType ?? 't' : 'nav'}`}
              className="relative flex items-center justify-center overflow-visible"
            >
              <GuardDhPet
                emotion={petEmotion}
                size={52}
                toastGlanceSignal={toastGlanceKey}
                toastGlanceDirection={glanceDir}
                aiMindState={petAiMindState}
              />
              {externalEvent?.source !== 'toast' && guideLlmThinking ? (
                <GuidePetMoodEyesOverlay mood={petMood} isThinking size={52} />
              ) : null}
              {mood === 'loading' ? (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35 rounded-full">
                  <BrandSpinner size={22} />
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {!voiceCoach.hidden ? (
        <div className="flex w-10 shrink-0 flex-col items-center gap-1.5 pt-1">
          <label
            className="flex cursor-pointer flex-col items-center gap-0.5 text-[9px] uppercase tracking-wide text-slate-500"
            title={voiceCoach.voice.coachVoiceReadHint}
          >
            <input
              type="checkbox"
              checked={voiceCoach.coachVoiceRead}
              onChange={(e) => voiceCoach.setCoachVoiceRead(e.target.checked)}
              className="sr-only"
            />
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-xl border ${
                voiceCoach.coachVoiceRead
                  ? 'border-sky-400/50 bg-sky-500/15 text-sky-200'
                  : 'border-white/10 bg-white/5 text-slate-500'
              }`}
            >
              <Volume2 className="h-4 w-4" aria-hidden />
            </span>
          </label>
        </div>
      ) : null}
    </div>
  )

  if (routeViewCoachDock) {
    return <div className={outerLayoutClass}>{coachClusterRow}</div>
  }

  const sidebarPetOrbPx = 68
  const sidebarPetFaceSize = 56

  const sidebarPetBlock = (
    <div className="pointer-events-auto flex w-full flex-col items-center px-1">
      <div className="relative flex w-full flex-col items-center overflow-visible">
        {showMessageBubble && !hideCoachBubbleForVoice ? (
          <div
            ref={bubbleRef}
            key={`sidebar-${mood}-${activeTitle}-${toastSkin?.text ?? ''}`}
            className="absolute bottom-full left-1/2 z-[1] mb-2 w-[min(17.5rem,calc(100vw-2rem))] max-w-[calc(100vw-1rem)] -translate-x-1/2"
          >
            <div
              className={
                toastSkin?.bubbleClass ??
                'relative rounded-xl border border-white/10 bg-[#121b27]/90 px-3 py-2 text-center shadow-[0_10px_20px_rgba(0,0,0,0.35)] backdrop-blur'
              }
            >
              {bubbleInner}
            </div>
          </div>
        ) : null}
        {hideCoachBubbleForVoice ? (
          <span className="sr-only">
            {activeTitle}. {activeSubtitle}
          </span>
        ) : null}

        <div className="relative shrink-0">
          <div
            ref={glowRef}
            className={`absolute -inset-2 rounded-full bg-gradient-to-br ${toastSkin?.glow ?? cfg.glow} blur-lg`}
          />

          <div
            ref={orbRef}
            className={`relative overflow-visible rounded-full border ${toastSkin?.ring ?? cfg.ring} bg-[#101722]/93 shadow-[0_10px_28px_rgba(0,0,0,0.42)] flex items-center justify-center`}
            style={{ width: sidebarPetOrbPx, height: sidebarPetOrbPx }}
          >
            <div
              ref={iconRef}
              key={`sidebar-orb-${mood}-${externalEvent?.source === 'toast' ? externalEvent.toastType ?? 't' : 'nav'}`}
              className="relative flex items-center justify-center overflow-visible"
            >
              <GuardDhPet
                emotion={petEmotion}
                size={sidebarPetFaceSize}
                toastGlanceSignal={toastGlanceKey}
                toastGlanceDirection={glanceDir}
                aiMindState={petAiMindState}
              />
              {externalEvent?.source !== 'toast' && guideLlmThinking ? (
                <GuidePetMoodEyesOverlay mood={petMood} isThinking size={sidebarPetFaceSize} />
              ) : null}
              {mood === 'loading' ? (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35 rounded-full">
                  <BrandSpinner size={24} />
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const coachHandToolsPanel = (
    <div className="flex w-56 flex-col gap-2.5 rounded-2xl border border-white/12 bg-[#121821]/97 p-3 shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur-md">
      <button
        type="button"
        onClick={() => voiceCoach.toggleListen()}
        disabled={!voiceCoach.supported}
        className="flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600/90 text-sm font-medium text-white shadow-md hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
        aria-pressed={voiceCoach.listening}
      >
        {voiceCoach.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        {voiceCoach.listening ? voiceCoach.voice.stop : voiceCoach.voice.listen}
      </button>
      <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
        <span className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-200/90" aria-hidden />
          {voiceCoach.voice.learnMode}
        </span>
        <input
          type="checkbox"
          checked={voiceCoach.learnMode}
          onChange={(e) => voiceCoach.setLearnMode(e.target.checked)}
          className="h-4 w-4 accent-amber-400"
        />
      </label>
      {voiceCoach.pendingLearn ? (
        <button
          type="button"
          onClick={() => void voiceCoach.savePendingShortcut()}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-800/90 text-sm font-medium text-amber-200 hover:bg-slate-700"
        >
          <BookmarkPlus className="h-4 w-4" />
          {voiceCoach.voice.saveShortcut}
        </button>
      ) : null}
      <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
        <span className="flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-sky-200/90" aria-hidden />
          {voiceCoach.voice.coachVoiceReadHint}
        </span>
        <input
          type="checkbox"
          checked={voiceCoach.coachVoiceRead}
          onChange={(e) => voiceCoach.setCoachVoiceRead(e.target.checked)}
          className="h-4 w-4 accent-sky-400"
        />
      </label>
    </div>
  )

  const coachHandFloating = !voiceCoach.hidden ? (
    <div
      ref={coachToolsWrapRef}
      className={`pointer-events-auto fixed z-[45] top-[max(5.5rem,calc(env(safe-area-inset-top)+5rem))] ${
        sidebarOpen ? 'right-3' : 'left-3'
      }`}
    >
      <button
        type="button"
        onClick={() => setCoachToolsOpen((o) => !o)}
        className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/12 bg-[#121821]/95 text-teal-200 shadow-lg hover:bg-white/10"
        aria-expanded={coachToolsOpen}
        aria-label="Herramientas de voz y aprendizaje del coach"
        title="Voz y aprendizaje"
      >
        <Hand className="h-5 w-5" aria-hidden />
      </button>
      {coachToolsOpen ? (
        <div className={`absolute top-[calc(100%+0.5rem)] ${sidebarOpen ? 'right-0' : 'left-0'}`}>{coachHandToolsPanel}</div>
      ) : null}
    </div>
  ) : null

  const petPortal =
    sidebarOpen && sidebarPetSlot ? createPortal(sidebarPetBlock, sidebarPetSlot) : null

  return (
    <>
      {petPortal}
      {coachHandFloating}
    </>
  )
}
