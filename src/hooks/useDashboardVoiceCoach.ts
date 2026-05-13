'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useLocale } from '@/lib/i18n/LocaleProvider'
import { useDashboardVoiceRecognition } from '@/hooks/useDashboardVoiceRecognition'
import { resolveVoiceNavigation, type VoiceShortcutRow } from '@/lib/voice/voiceIntentCatalog'
import { normalizeVoicePhrase, sanitizeTranscriptForDisplay } from '@/lib/voice/voicePrivacy'
import { toast } from '@/lib/toast'
import { GDH_VOICE_NAVIGATE_EVENT } from '@/lib/voice/voiceCoachEvents'
import {
  getGuideTtsEnabled,
  setGuideTtsEnabled,
  GDH_GUIDE_TTS_PREF_EVENT,
  GUIDE_TTS_STORAGE_KEY,
} from '@/lib/voice/guideTtsPref'

async function fetchShortcuts(): Promise<VoiceShortcutRow[]> {
  const r = await fetch('/api/dashboard/voice-shortcuts', { credentials: 'include' })
  if (!r.ok) return []
  const j = (await r.json()) as { shortcuts?: VoiceShortcutRow[] }
  return Array.isArray(j.shortcuts) ? j.shortcuts : []
}

export function useDashboardVoiceCoach() {
  const pathname = usePathname() || ''
  const router = useRouter()
  const { locale, messages } = useLocale()
  const v = messages.voice

  /** Panel TTS oculto solo en grabación (dock propio). En replay el panel sigue para parlante. */
  const hidden = pathname.startsWith('/dashboard/routes/record')
  /** Atajos por voz y mic desactivados en grabación y replay (mapa / vídeo). */
  const commandsDisabled =
    pathname.startsWith('/dashboard/routes/record') || pathname.startsWith('/dashboard/routes/attempt-replay')

  const { supported, listening, interim, error, start, stop, setOnFinal } = useDashboardVoiceRecognition(locale)
  const [shortcuts, setShortcuts] = useState<VoiceShortcutRow[]>([])
  const [learnMode, setLearnMode] = useState(true)
  const [coachVoiceRead, setCoachVoiceRead] = useState(false)
  const [lastHeard, setLastHeard] = useState('')
  const [pendingLearn, setPendingLearn] = useState<{ transcript: string; path: string } | null>(null)

  const reloadShortcuts = useCallback(() => {
    void fetchShortcuts().then(setShortcuts)
  }, [])

  useEffect(() => {
    if (commandsDisabled) return
    reloadShortcuts()
  }, [commandsDisabled, reloadShortcuts])

  useEffect(() => {
    setCoachVoiceRead(getGuideTtsEnabled())
    const sync = () => setCoachVoiceRead(getGuideTtsEnabled())
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

  const onFinal = useCallback(
    (transcript: string) => {
      if (commandsDisabled) return
      const clean = sanitizeTranscriptForDisplay(transcript)
      setLastHeard(clean)
      const hit = resolveVoiceNavigation(clean, locale, shortcuts)
      if (!hit) {
        toast.warning(v.title, v.unknownCommand)
        setPendingLearn(null)
        return
      }

      const cur = pathname.replace(/\/$/, '') || '/dashboard'
      const next = hit.path.replace(/\/$/, '') || '/dashboard'
      if (cur !== next) {
        router.push(hit.path)
        toast.success(v.navigated, hit.path)
      }

      window.dispatchEvent(
        new CustomEvent(GDH_VOICE_NAVIGATE_EVENT, {
          detail: { path: hit.path, source: hit.source },
        })
      )

      if (hit.shortcutId) {
        void fetch(`/api/dashboard/voice-shortcuts/${hit.shortcutId}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ increment_use: true }),
        })
      }

      if (learnMode && hit.source === 'builtin') {
        setPendingLearn({ transcript: clean, path: hit.path })
      } else {
        setPendingLearn(null)
      }
    },
    [commandsDisabled, locale, pathname, router, shortcuts, learnMode, v]
  )

  useEffect(() => {
    if (commandsDisabled) return
    setOnFinal(onFinal)
  }, [commandsDisabled, setOnFinal, onFinal])

  const savePendingShortcut = useCallback(async () => {
    if (!pendingLearn) return
    const r = await fetch('/api/dashboard/voice-shortcuts', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phrase_display: pendingLearn.transcript,
        path: pendingLearn.path,
        locale,
      }),
    })
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      toast.error(v.shortcutError, j.error || '')
      return
    }
    toast.success(v.shortcutSaved, normalizeVoicePhrase(pendingLearn.transcript).slice(0, 80))
    setPendingLearn(null)
    reloadShortcuts()
  }, [pendingLearn, locale, reloadShortcuts, v])

  const toggleListen = useCallback(() => {
    if (commandsDisabled || !supported) return
    if (listening) stop()
    else void start()
  }, [commandsDisabled, supported, listening, stop, start])

  return {
    hidden,
    supported,
    listening,
    interim,
    error,
    lastHeard,
    learnMode,
    setLearnMode,
    coachVoiceRead,
    setCoachVoiceRead: setGuideTtsEnabled,
    pendingLearn,
    savePendingShortcut,
    toggleListen,
    voice: v,
  }
}
