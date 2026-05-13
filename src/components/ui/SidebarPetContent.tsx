'use client'

import { CoachNotification } from '@/components/ui/CoachNotification'
import type { PetAiMindState } from '@/components/pet/GuardDhPetAtlas'
import type { GuidePetMood } from '@/lib/pet/guidePetBridge'

interface SidebarPetContentProps {
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

export function SidebarPetContent({
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
}: SidebarPetContentProps) {
  return (
    <div className="pointer-events-auto flex w-full flex-col items-center px-1">
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
        isSidebar={true}
      />
    </div>
  )
}
