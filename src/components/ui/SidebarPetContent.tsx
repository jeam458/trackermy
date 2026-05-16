'use client'

import { CoachNotification, type CoachEngagementHandlers } from '@/components/ui/CoachNotification'
import type { PetAiMindState } from '@/components/pet/GuardDhPetAtlas'

interface SidebarPetContentProps {
  mood: string
  externalEventSource: string | null | undefined
  externalEventToastType: string | null | undefined
  guideLlmThinking: boolean
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
  coachEngagement?: CoachEngagementHandlers | null
}

export function SidebarPetContent({
  mood,
  externalEventSource,
  externalEventToastType,
  guideLlmThinking,
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
  coachEngagement = null,
}: SidebarPetContentProps) {
  return (
    <div className="pointer-events-auto flex w-full flex-col items-center px-1">
      <CoachNotification
        mood={mood}
        externalEventSource={externalEventSource}
        externalEventToastType={externalEventToastType}
        guideLlmThinking={guideLlmThinking}
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
        coachEngagement={coachEngagement ?? undefined}
      />
    </div>
  )
}
