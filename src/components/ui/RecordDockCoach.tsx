'use client'

import { CoachNotification } from '@/components/ui/CoachNotification'
import type { PetAiMindState } from '@/components/pet/GuardDhPetAtlas'

interface RecordDockCoachProps {
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
}

export function RecordDockCoach({
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
}: RecordDockCoachProps) {
  return (
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
      showMessageBubble={showMessageBubble && !hideForVoice}
      hideForVoice={hideForVoice}
      onSetMessageVisible={onSetMessageVisible}
      isSidebar={false}
    />
  )
}
