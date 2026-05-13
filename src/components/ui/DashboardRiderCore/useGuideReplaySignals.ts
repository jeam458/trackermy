'use client'

import { useEffect, useRef } from 'react'
import type { Dispatch, SetStateAction, MutableRefObject } from 'react'
import {
  GUARDDH_GUIDE_REPLAY_EVENT,
  GUARDDH_PET_REPLAY_TICK,
  type GuideReplayTelemetryDetail,
  type PetReplayTickDetail,
} from '@/lib/guide-ai/guideUiTelemetry'
import {
  inferPetMoodFromReplayAction,
  inferPetMoodFromReplayLive,
  publishGuidePetMood,
} from '@/lib/pet/guidePetBridge'
import type { GuideContext, GuideGpsHint, GuideSessionReplaySignal, GuideUiEvent } from '@/lib/guide-ai/types'
import { generateGuideReactionWithLightLlm } from '@/lib/guide-ai/lightweightGuideLlm'
import { buildAffectiveAugmentForLlm } from './helpers'
import type { GuideWorldStateController } from '@/lib/affective'
import { mapReactionMoodToToastType } from '@/lib/guide-ai/guideDashboardReactiveTurn'
import type { RiderGuidePayload } from '@/lib/riderGuide'
import type { SupabaseGuideDataProvider } from '@/lib/guide-ai/providers/SupabaseGuideDataProvider'
import type { McpSupabaseGuideProvider } from '@/lib/guide-ai/providers/McpSupabaseGuideProvider'

type Provider = SupabaseGuideDataProvider | McpSupabaseGuideProvider

interface UseGuideReplaySignalsParams {
  pathname: string
  userId: string | null
  provider: Provider
  approxGeo: { lat: number; lng: number } | null
  contextualRouteId: string | null
  contextualAttemptId: string | null
  petClientHints: { gpsHint: GuideGpsHint; networkOnline: boolean | null }
  runLlmReaction: <T>(fn: () => Promise<T>) => Promise<T>
  setExternalEvent: Dispatch<SetStateAction<RiderGuidePayload | null>>
  setMessageVisible: Dispatch<SetStateAction<boolean>>
  pageGuideContextRef: MutableRefObject<GuideContext | null>
  affectiveWorldRef: MutableRefObject<GuideWorldStateController>
  lastSpokenAtRef: MutableRefObject<number>
  spokenTitlesRef: MutableRefObject<string[]>
}

export function useGuideReplaySignals(params: UseGuideReplaySignalsParams) {
  const {
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
  } = params

  const sessionReplaySignalsRef = useRef<GuideSessionReplaySignal[]>([])
  const replayStructuralAtRef = useRef(0)
  const lastReplayLlmAtRef = useRef(0)
  const lastReplayCoachLlmAtRef = useRef(0)
  const replayCoachInFlightRef = useRef(false)

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
          raw.playing,
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
            } as GuideContext
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
            }),
          )
          setExternalEvent({
            mood: reaction.mood,
            title: reaction.title,
            subtitle: reaction.subtitle,
            duration: reaction.duration,
            source: 'manual',
          })
          lastSpokenAtRef.current = Date.now()
          spokenTitlesRef.current = [
            ...spokenTitlesRef.current.slice(-5),
            reaction.title.trim().toLowerCase(),
          ]
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
      if (
        typeof raw.elapsed_sec !== 'number' ||
        !Number.isFinite(raw.elapsed_sec) ||
        raw.elapsed_sec < 5
      )
        return
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
            } as GuideContext
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
            }),
          )
          lastReplayCoachLlmAtRef.current = Date.now()
          const elapsedCoach =
            typeof raw.elapsed_sec === 'number' && Number.isFinite(raw.elapsed_sec)
              ? raw.elapsed_sec
              : 0
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

  return { sessionReplaySignalsRef, replayStructuralAtRef }
}
