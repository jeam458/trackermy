import { useMemo, useState } from 'react'
import { MessageCircle, ThumbsDown, ThumbsUp } from 'lucide-react'
import { PetOrb } from '@/components/ui/PetOrb'
import type { PetAiMindState } from '@/components/pet/GuardDhPetAtlas'

export type CoachEngagementHandlers = {
  onAsk: (text: string) => void
  onFeedback: (sentiment: -1 | 1) => void
  busy: boolean
  feedbackLocked: boolean
}

interface CoachNotificationProps {
  mood: string
  externalEventSource?: string | null | undefined
  externalEventToastType?: string | null | undefined
  guideLlmThinking: boolean
  petVisible: boolean
  petEmotion: any
  petAiMindState: PetAiMindState | 'off' | 'thinking'
  toastGlanceKey: number
  glanceDir: 'above' | 'below'
  activeTitle: string
  activeSubtitle: string
  isLoadingPulse: boolean
  showMessageBubble: boolean
  hideForVoice: boolean
  onSetMessageVisible: (visible: boolean) => void
  isSidebar?: boolean
  /** Orbe más pequeño (cabecera Descubrir). */
  density?: 'default' | 'header'
  /**
   * `overOrb`: burbuja encima del orbe (dock inferior).
   * `underOrb`: burbuja debajo del orbe (cabecera; no tapa el título).
   */
  bubbleLayout?: 'overOrb' | 'underOrb'
  /** Pregunta al coach + feedback (opcional). */
  coachEngagement?: CoachEngagementHandlers | null
}

export function CoachNotification({
  mood,
  externalEventSource,
  externalEventToastType,
  guideLlmThinking,
  petVisible,
  petEmotion,
  petAiMindState,
  toastGlanceKey,
  glanceDir,
  activeTitle,
  activeSubtitle,
  isLoadingPulse,
  showMessageBubble,
  hideForVoice,
  onSetMessageVisible,
  isSidebar = false,
  density = 'default',
  bubbleLayout = 'overOrb',
  coachEngagement = null,
}: CoachNotificationProps) {
  const [askOpen, setAskOpen] = useState(false)
  const [draftAsk, setDraftAsk] = useState('')

  // Determine bubble skin based on toast type
  const bubbleSkinClass = useMemo(() => {
    if (externalEventSource === 'toast' && externalEventToastType) {
      switch (externalEventToastType) {
        case 'success':
          return 'relative rounded-xl border border-gdh-brand/40 bg-[#1a1410]/95 px-3 py-2 text-center shadow-[0_10px_28px_rgba(197,90,47,0.22)] backdrop-blur'
        case 'error':
          return 'relative rounded-xl border border-rose-400/40 bg-[#160d11]/95 px-3 py-2 text-center shadow-[0_10px_28px_rgba(244,63,94,0.2)] backdrop-blur'
        case 'warning':
          return 'relative rounded-xl border border-amber-400/38 bg-[#16120b]/95 px-3 py-2 text-center shadow-[0_10px_28px_rgba(245,158,11,0.18)] backdrop-blur'
        default:
          return 'relative rounded-xl border border-gdh-trail/35 bg-gdh-card/95 px-3 py-2 text-center shadow-[0_10px_28px_rgba(0,0,0,0.35)] backdrop-blur'
      }
    }
    return 'relative rounded-xl border border-white/10 bg-gdh-card/90 px-3 py-2 text-center shadow-[0_10px_20px_rgba(0,0,0,0.35)] backdrop-blur'
  }, [externalEventSource, externalEventToastType])

  const textClass = useMemo(() => {
    if (externalEventSource === 'toast' && externalEventToastType) {
      switch (externalEventToastType) {
        case 'success':
          return 'text-gdh-brand-highlight'
        case 'error':
          return 'text-rose-100'
        case 'warning':
          return 'text-amber-100'
        default:
          return 'text-slate-100'
      }
    }
    return 'text-slate-100'
  }, [externalEventSource, externalEventToastType])

  const subtitleClass = useMemo(() => {
    if (externalEventSource === 'toast' && externalEventToastType) {
      switch (externalEventToastType) {
        case 'success':
          return 'text-gdh-brand-highlight/90'
        case 'error':
          return 'text-rose-200/85'
        case 'warning':
          return 'text-amber-200/85'
        default:
          return 'text-slate-300'
      }
    }
    return 'text-slate-300'
  }, [externalEventSource, externalEventToastType])

  const showBubble = showMessageBubble && !hideForVoice

  const upwardCaretClass = useMemo(() => {
    if (externalEventSource === 'toast' && externalEventToastType) {
      switch (externalEventToastType) {
        case 'success':
          return 'border-gdh-brand/40 bg-[#1a1410]/95'
        case 'error':
          return 'border-rose-400/40 bg-[#160d11]/95'
        case 'warning':
          return 'border-amber-400/38 bg-[#16120b]/95'
        default:
          return 'border-gdh-trail/35 bg-gdh-card/95'
      }
    }
    return 'border-white/10 bg-gdh-card/90'
  }, [externalEventSource, externalEventToastType])

  const bubbleOuterClass =
    bubbleLayout === 'underOrb'
      ? 'absolute top-full right-0 left-auto z-[45] mt-1.5 w-[min(220px,calc(100vw-1.25rem))] max-w-[min(220px,calc(100vw-1.25rem))]'
      : 'absolute bottom-full left-0 mb-1.5 w-[224px] max-w-[calc(100vw-1rem)]'

  const orbSize = isSidebar ? 68 : density === 'header' ? 40 : 62

  const showEngagement =
    coachEngagement &&
    showBubble &&
    !isLoadingPulse &&
    externalEventSource &&
    externalEventSource !== 'toast'

  const thumbClass =
    'flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-black/25 text-slate-300 hover:border-white/25 hover:text-white disabled:pointer-events-none disabled:opacity-35'

  const submitAsk = () => {
    const t = draftAsk.trim()
    if (t.length < 2 || coachEngagement?.busy) return
    coachEngagement?.onAsk(t)
    setDraftAsk('')
    setAskOpen(false)
    onSetMessageVisible(true)
  }

  return (
    <div className="relative shrink-0">
      {hideForVoice && externalEventSource !== 'toast' ? (
        <span className="sr-only">
          {activeTitle}. {activeSubtitle}
        </span>
      ) : null}

      {/* Burbuja: solo cuando hay mensaje visible (el pet/orbe sigue mostrándose siempre) */}
      {showBubble ? (
        <div
          key={`bubble-${mood}-${activeTitle}-${externalEventToastType ?? ''}`}
          className={bubbleOuterClass}
        >
          <div className={bubbleSkinClass}>
            {bubbleLayout === 'underOrb' ? (
              <div
                className={`absolute -top-[6px] left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-r border-b ${upwardCaretClass}`}
              />
            ) : (
              <div
                className={`absolute ${
                  glanceDir === 'above'
                    ? 'bottom-[-6px] left-1/2 -translate-x-1/2'
                    : 'top-[-6px] left-[22px]'
                } h-3 w-3 rotate-45 border-l border-t ${
                  externalEventSource === 'toast' && externalEventToastType
                    ? externalEventToastType === 'success'
                      ? 'border-gdh-brand/40 bg-[#1a1410]/95'
                      : externalEventToastType === 'error'
                        ? 'border-rose-400/40 bg-[#160d11]/95'
                        : externalEventToastType === 'warning'
                          ? 'border-amber-400/38 bg-[#16120b]/95'
                          : 'border-gdh-trail/35 bg-gdh-card/95'
                    : 'border-white/10 bg-gdh-card/90'
                }`}
              />
            )}
            <div className="relative max-h-[min(280px,44vh)] overflow-y-auto overscroll-contain px-0.5 pt-1">
              <div className="flex flex-col items-center text-center">
                <p className={`text-[11px] font-semibold ${textClass}`}>{activeTitle}</p>
                <p className={`mt-0.5 text-[10px] ${subtitleClass}`}>{activeSubtitle}</p>
              </div>
              {showEngagement ? (
                <div className="mt-2 border-t border-white/10 pt-2">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      className={thumbClass}
                      disabled={coachEngagement.feedbackLocked || coachEngagement.busy}
                      aria-label="Útil"
                      onClick={() => coachEngagement.onFeedback(1)}
                    >
                      <ThumbsUp size={14} strokeWidth={2.25} />
                    </button>
                    <button
                      type="button"
                      className={thumbClass}
                      disabled={coachEngagement.feedbackLocked || coachEngagement.busy}
                      aria-label="Poco útil"
                      onClick={() => coachEngagement.onFeedback(-1)}
                    >
                      <ThumbsDown size={14} strokeWidth={2.25} />
                    </button>
                  </div>
                  {!askOpen ? (
                    <button
                      type="button"
                      className="mx-auto mt-1.5 flex items-center justify-center gap-1 rounded-md px-1 py-0.5 text-[9px] text-slate-400 hover:text-slate-200 disabled:opacity-40"
                      disabled={coachEngagement.busy}
                      onClick={() => setAskOpen(true)}
                    >
                      <MessageCircle size={12} />
                      Preguntar al coach
                    </button>
                  ) : (
                    <form
                      className="mt-1.5 flex flex-col gap-1"
                      onSubmit={(e) => {
                        e.preventDefault()
                        submitAsk()
                      }}
                    >
                      <textarea
                        value={draftAsk}
                        onChange={(e) => setDraftAsk(e.target.value)}
                        rows={2}
                        maxLength={360}
                        placeholder="Escribí una duda corta…"
                        className="w-full resize-none rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[10px] text-slate-100 placeholder:text-slate-500 focus:border-gdh-brand/50 focus:outline-none"
                        disabled={coachEngagement.busy}
                      />
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className="rounded-md px-2 py-0.5 text-[9px] text-slate-400 hover:text-slate-200"
                          onClick={() => {
                            setAskOpen(false)
                            setDraftAsk('')
                          }}
                        >
                          Cerrar
                        </button>
                        <button
                          type="submit"
                          disabled={coachEngagement.busy || draftAsk.trim().length < 2}
                          className="rounded-md bg-gdh-brand/85 px-2 py-0.5 text-[9px] font-medium text-black hover:bg-gdh-brand disabled:opacity-40"
                        >
                          Enviar
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <PetOrb
        mood={mood}
        externalEventSource={externalEventSource}
        externalEventToastType={externalEventToastType}
        petVisible={petVisible}
        petEmotion={petEmotion}
        petAiMindState={petAiMindState}
        toastGlanceKey={toastGlanceKey}
        toastGlanceDirection={glanceDir}
        size={orbSize}
        isSidebar={isSidebar}
      />
    </div>
  )
}
