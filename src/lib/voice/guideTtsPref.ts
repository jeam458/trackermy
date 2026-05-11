export const GUIDE_TTS_STORAGE_KEY = 'gdh_guide_tts_v1'

export const GDH_GUIDE_TTS_PREF_EVENT = 'gdh:guide_tts_pref' as const

export function getGuideTtsEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(GUIDE_TTS_STORAGE_KEY) === '1'
}

export function setGuideTtsEnabled(on: boolean): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(GUIDE_TTS_STORAGE_KEY, on ? '1' : '0')
  window.dispatchEvent(new CustomEvent(GDH_GUIDE_TTS_PREF_EVENT))
}
