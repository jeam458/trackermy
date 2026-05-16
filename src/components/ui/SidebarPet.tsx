import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CoachNotification } from '@/components/ui/CoachNotification'
import type { PetAiMindState } from '@/components/pet/GuardDhPetAtlas'

interface SidebarPetProps {
  sidebarOpen: boolean
  petVisible: boolean
  petEmotion: any
  petAiMindState: PetAiMindState | 'off' | 'thinking'
  toastGlanceKey: number
  glanceDir: 'above' | 'below'
  activeTitle: string
  activeSubtitle: string
  mood: string
  externalEventSource?: string
  externalEventToastType?: string
  guideLlmThinking: boolean
  showMessageBubble: boolean
  hideForVoice: boolean
  onSetMessageVisible: (visible: boolean) => void
}

export function SidebarPet({
  sidebarOpen,
  petVisible,
  petEmotion,
  petAiMindState,
  toastGlanceKey,
  glanceDir,
  activeTitle,
  activeSubtitle,
  mood,
  externalEventSource,
  externalEventToastType,
  guideLlmThinking,
  showMessageBubble,
  hideForVoice,
  onSetMessageVisible,
}: SidebarPetProps) {
  const [sidebarPetSlot, setSidebarPetSlot] = useState<HTMLElement | null>(null)
  const SIDEBAR_PET_SLOT_ID = 'gdh-sidebar-pet-slot'

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

  const sidebarPetBlock = (
    <div className="pointer-events-auto flex w-full flex-col items-center px-1">
      <div className="relative flex w-full flex-col items-center overflow-visible">
        <CoachNotification
          mood={mood}
          externalEventSource={externalEventSource}
          externalEventToastType={externalEventToastType}
          guideLlmThinking={guideLlmThinking}
          petVisible={petVisible}
          petEmotion={petEmotion}
          petAiMindState={petAiMindState}
          toastGlanceKey={toastGlanceKey}
          glanceDir={glanceDir}
          activeTitle={activeTitle}
          activeSubtitle={activeSubtitle}
          isLoadingPulse={false}
          showMessageBubble={showMessageBubble}
          hideForVoice={hideForVoice}
          onSetMessageVisible={onSetMessageVisible}
        />
      </div>
    </div>
  )

  return sidebarOpen && sidebarPetSlot ? createPortal(sidebarPetBlock, sidebarPetSlot) : null
}