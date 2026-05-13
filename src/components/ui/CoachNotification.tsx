import { useMemo } from 'react'
import { PetOrb } from '@/components/ui/PetOrb'
import type { PetAiMindState } from '@/components/pet/GuardDhPetAtlas'
import type { GuidePetMood } from '@/lib/pet/guidePetBridge'

interface CoachNotificationProps {
  mood: string
  externalEventSource?: string | null | undefined
  externalEventToastType?: string | null | undefined
  guideLlmThinking: boolean
  petMood: GuidePetMood
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
}

export function CoachNotification({
  mood,
  externalEventSource,
  externalEventToastType,
  guideLlmThinking,
  petMood,
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
}: CoachNotificationProps) {
  // Determine bubble skin based on toast type
  const bubbleSkinClass = useMemo(() => {
    if (externalEventSource === 'toast' && externalEventToastType) {
      switch (externalEventToastType) {
        case 'success':
          return 'relative rounded-xl border border-emerald-400/35 bg-[#0a1614]/95 px-3 py-2 text-center shadow-[0_10px_28px_rgba(16,185,129,0.18)] backdrop-blur'
        case 'error':
          return 'relative rounded-xl border border-rose-400/40 bg-[#160d11]/95 px-3 py-2 text-center shadow-[0_10px_28px_rgba(244,63,94,0.2)] backdrop-blur'
        case 'warning':
          return 'relative rounded-xl border border-amber-400/38 bg-[#16120b]/95 px-3 py-2 text-center shadow-[0_10px_28px_rgba(245,158,11,0.18)] backdrop-blur'
        default:
          return 'relative rounded-xl border border-sky-400/38 bg-[#0c141f]/95 px-3 py-2 text-center shadow-[0_10px_28px_rgba(56,189,248,0.15)] backdrop-blur'
      }
    }
    return 'relative rounded-xl border border-white/10 bg-[#121b27]/90 px-3 py-2 text-center shadow-[0_10px_20px_rgba(0,0,0,0.35)] backdrop-blur'
  }, [externalEventSource, externalEventToastType])

  const textClass = useMemo(() => {
    if (externalEventSource === 'toast' && externalEventToastType) {
      switch (externalEventToastType) {
        case 'success': return 'text-emerald-100'
        case 'error': return 'text-rose-100'
        case 'warning': return 'text-amber-100'
        default: return 'text-sky-100'
      }
    }
    return 'text-slate-100'
  }, [externalEventSource, externalEventToastType])

  const subtitleClass = useMemo(() => {
    if (externalEventSource === 'toast' && externalEventToastType) {
      switch (externalEventToastType) {
        case 'success': return 'text-emerald-200/88'
        case 'error': return 'text-rose-200/85'
        case 'warning': return 'text-amber-200/85'
        default: return 'text-sky-200/85'
      }
    }
    return 'text-slate-300'
  }, [externalEventSource, externalEventToastType])

  // Si no se debe mostrar la burbuja y no hay voz, no renderizar nada (o sr-only)
  if (!showMessageBubble && !hideForVoice) {
    return null
  }

  // Si está oculto por voz y no es toast, retornar span sr-only para accesibilidad
  if (hideForVoice && externalEventSource !== 'toast') {
    return (
      <span className="sr-only">
        {activeTitle}. {activeSubtitle}
      </span>
    )
  }

  return (
    <>
      {/* Message Bubble */}
      {showMessageBubble && !hideForVoice ? (
        <div
          key={`bubble-${mood}-${activeTitle}-${externalEventToastType ?? ''}`}
          className="absolute bottom-full left-0 mb-1.5 w-[224px] max-w-[calc(100vw-1rem)]"
        >
          <div className={bubbleSkinClass}>
            <div className="relative flex flex-col items-center text-center">
              {/* Caret triangular */}
              <div
                className={`absolute ${
                  glanceDir === 'above'
                    ? 'bottom-[-6px] left-1/2 -translate-x-1/2'
                    : 'top-[-6px] left-[22px]'
                } h-3 w-3 rotate-45 border-l border-t ${
                  externalEventSource === 'toast' && externalEventToastType
                    ? externalEventToastType === 'success'
                      ? 'border-emerald-400/35 bg-[#0a1614]/95'
                      : externalEventToastType === 'error'
                      ? 'border-rose-400/40 bg-[#160d11]/95'
                      : externalEventToastType === 'warning'
                      ? 'border-amber-400/38 bg-[#16120b]/95'
                      : 'border-sky-400/38 bg-[#0c141f]/95'
                    : 'border-white/10 bg-[#121b27]/90'
                }`}
              />
              <p className={`text-[11px] font-semibold ${textClass}`}>{activeTitle}</p>
              <p className={`mt-0.5 text-[10px] ${subtitleClass}`}>{activeSubtitle}</p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Pet Orb */}
      <PetOrb
        mood={mood}
        externalEventSource={externalEventSource}
        externalEventToastType={externalEventToastType}
        guideLlmThinking={guideLlmThinking}
        petMood={petMood}
        petVisible={petVisible}
        petEmotion={petEmotion}
        petAiMindState={petAiMindState}
        toastGlanceKey={toastGlanceKey}
        toastGlanceDirection={glanceDir}
        size={isSidebar ? 68 : 62}
        isSidebar={isSidebar}
      />
    </>
  )
}