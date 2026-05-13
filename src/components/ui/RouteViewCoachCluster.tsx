'use client'

import React from 'react'
import { VoiceControlPanel } from '@/components/ui/VoiceControlPanel'
import { CoachNotification } from '@/components/ui/CoachNotification'
import { Menu, Volume2 } from 'lucide-react'
import type { PetAiMindState } from '@/components/pet/GuardDhPetAtlas'
import type { GuidePetMood } from '@/lib/pet/guidePetBridge'

interface RouteViewCoachClusterProps {
  showRouteViewMenu: boolean
  sidebarOpen: boolean
  openSidebar: () => void
  voiceCoach: {
    hidden: boolean
    voice: { coachVoiceReadHint: string }
    coachVoiceRead: boolean
    setCoachVoiceRead: (v: boolean) => void
  }
  setCoachToolsOpen: React.Dispatch<React.SetStateAction<boolean>>
  coachToolsOpen: boolean
  mood: string
  externalEventSource: string | null | undefined
  externalEventToastType: string | null | undefined
  guideLlmThinking: boolean
  petMood: GuidePetMood
  petVisible: boolean
  petEmotion: any
  petAiMindState: PetAiMindState | 'off' | 'thinking'
  toastGlanceKey: number
  activeTitle: string
  activeSubtitle: string
  isLoadingPulse: boolean
  showMessageBubble: boolean
  hideForVoice: boolean
  onSetMessageVisible: (visible: boolean) => void
}

export function RouteViewCoachCluster({
  showRouteViewMenu,
  sidebarOpen,
  openSidebar,
  voiceCoach,
  setCoachToolsOpen,
  coachToolsOpen,
  mood,
  externalEventSource,
  externalEventToastType,
  guideLlmThinking,
  petMood,
  petVisible,
  petEmotion,
  petAiMindState,
  toastGlanceKey,
  activeTitle,
  activeSubtitle,
  isLoadingPulse,
  showMessageBubble,
  hideForVoice,
  onSetMessageVisible,
}: RouteViewCoachClusterProps) {
  return (
    <div className="pointer-events-auto flex flex-row items-start justify-start gap-1.5">
      {showRouteViewMenu && !sidebarOpen ? (
        <button
          type="button"
          onClick={openSidebar}
          className="mt-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#121821]/90 text-slate-300 shadow-md hover:bg-white/10 hover:text-white"
          aria-label="Menú"
        >
          <Menu size={18} />
        </button>
      ) : null}

       <VoiceControlPanel
         voiceCoach={voiceCoach}
         onToggleTools={() => setCoachToolsOpen((o: boolean) => !o)}
         coachToolsOpen={coachToolsOpen}
       />

      <CoachNotification
        mood={mood}
        externalEventSource={externalEventSource}
        externalEventToastType={externalEventToastType}
        guideLlmThinking={guideLlmThinking}
        petMood={petMood}
        petVisible={petVisible}
        petEmotion={petEmotion}
        petAiMindState={petAiMindState}
        toastGlanceKey={toastGlanceKey}
        glanceDir="above"
        activeTitle={activeTitle}
        activeSubtitle={activeSubtitle}
        isLoadingPulse={isLoadingPulse}
        showMessageBubble={showMessageBubble}
        hideForVoice={hideForVoice}
        onSetMessageVisible={onSetMessageVisible}
        isSidebar={false}
      />

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
}
