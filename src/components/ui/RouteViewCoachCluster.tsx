'use client'

import React from 'react'
import {
  VoiceControlPanel,
  COACH_DOCK_CLUSTER_CLASS,
  COACH_HEADER_CLUSTER_CLASS,
} from '@/components/ui/VoiceControlPanel'
import { CoachNotification } from '@/components/ui/CoachNotification'
import { Menu } from 'lucide-react'
import type { PetAiMindState } from '@/components/pet/GuardDhPetAtlas'
import type { GuidePetMood } from '@/lib/pet/guidePetBridge'
import type { VoiceCoachUi } from '@/components/ui/VoiceControlPanel'

interface RouteViewCoachClusterProps {
  /** `header`: mismo bloque compacto que Descubrir (cabecera). `docked`: dock inferior ancho. */
  layout?: 'docked' | 'header'
  showRouteViewMenu: boolean
  sidebarOpen: boolean
  openSidebar: () => void
  voiceCoach: VoiceCoachUi
  mood: string
  externalEventSource: string | null | undefined
  externalEventToastType: string | null | undefined
  guideLlmThinking: boolean
  petMood: GuidePetMood
  petVisible: boolean
  petEmotion: unknown
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
  layout = 'docked',
  showRouteViewMenu,
  sidebarOpen,
  openSidebar,
  voiceCoach,
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
  const header = layout === 'header'
  const clusterClass = header ? COACH_HEADER_CLUSTER_CLASS : COACH_DOCK_CLUSTER_CLASS
  const menuBtnClass =
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#121821]/90 text-slate-300 shadow-md hover:bg-white/10 hover:text-white'

  return (
    <div className="pointer-events-auto flex flex-row items-center justify-start gap-1.5">
      {/* En cabecera solo pet + parlante; el menú lateral sigue en el dock inferior. */}
      {showRouteViewMenu && !sidebarOpen && !header ? (
        <button
          type="button"
          onClick={openSidebar}
          className={menuBtnClass}
          aria-label="Menú"
        >
          <Menu size={18} />
        </button>
      ) : null}

      <div className={clusterClass}>
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
          glanceDir={header ? 'below' : 'above'}
          activeTitle={activeTitle}
          activeSubtitle={activeSubtitle}
          isLoadingPulse={isLoadingPulse}
          showMessageBubble={showMessageBubble}
          hideForVoice={hideForVoice}
          onSetMessageVisible={onSetMessageVisible}
          isSidebar={false}
          density={header ? 'header' : 'default'}
          bubbleLayout={header ? 'underOrb' : 'overOrb'}
        />

        <VoiceControlPanel voiceCoach={voiceCoach} density={header ? 'header' : 'default'} />
      </div>
    </div>
  )
}
