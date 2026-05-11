/** Voz del coach del pet vía Web Speech API (solo cliente, sin servidor). */

let utteranceSeq = 0

export function cancelGuideCoachSpeech(): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  try {
    window.speechSynthesis.cancel()
  } catch {
    /* noop */
  }
}

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  const voices = typeof window !== 'undefined' ? window.speechSynthesis?.getVoices() ?? [] : []
  if (!voices.length) return null
  const primary = lang.toLowerCase().split('-')[0] || 'es'
  return (
    voices.find((v) => v.lang?.toLowerCase().startsWith(primary) && v.localService) ??
    voices.find((v) => v.lang?.toLowerCase().startsWith(primary)) ??
    voices[0] ??
    null
  )
}

/**
 * Lee título y subtítulo del mensaje del coach. Cancela cualquier locución anterior.
 */
export function speakGuideCoachMessage(opts: {
  title: string
  subtitle?: string
  lang: string
}): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return

  const title = opts.title.replace(/\s+/g, ' ').trim().slice(0, 320)
  if (!title) return

  const sub = (opts.subtitle ?? '').replace(/\s+/g, ' ').trim().slice(0, 320)
  const text = sub && sub !== title ? `${title}. ${sub}` : title

  cancelGuideCoachSpeech()

  const mySeq = ++utteranceSeq
  const lang = opts.lang.includes('-') ? opts.lang : `${opts.lang}-${opts.lang.toUpperCase()}`

  const run = () => {
    if (mySeq !== utteranceSeq) return
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang
    u.rate = 1
    u.pitch = 1.08
    u.volume = 1
    const voice = pickVoice(lang)
    if (voice) u.voice = voice
    window.speechSynthesis.speak(u)
  }

  if (window.speechSynthesis.getVoices().length) {
    run()
    return
  }

  const onVoices = () => {
    window.speechSynthesis.removeEventListener('voiceschanged', onVoices)
    run()
  }
  window.speechSynthesis.addEventListener('voiceschanged', onVoices)
}
