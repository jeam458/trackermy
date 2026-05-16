/** Voz del coach del pet vía Web Speech API (solo cliente, sin servidor). */

let utteranceSeq = 0
/** Invalida locuciones / encolados pendientes al cancelar o al pedir una voz nueva. */
let speakRequestId = 0
/**
 * True entre que decidimos hablar y `onend`/`onerror` del utterance. Evita dos llamadas seguidas
 * antes de que el motor marque `speaking`/`pending` (cortaba la primera locución).
 */
let coachSpeechSlotHeld = false

const speechEndWaiters: Array<() => void> = []

function flushSpeechEndWaiters(): void {
  const q = speechEndWaiters.splice(0)
  for (const fn of q) fn()
}

function releaseCoachSpeechSlot(): void {
  coachSpeechSlotHeld = false
}

/** True si hay locución del coach en curso (o encolada en el motor). */
export function isGuideCoachSpeechBusy(): boolean {
  if (typeof window === 'undefined' || !window.speechSynthesis) return false
  if (coachSpeechSlotHeld) return true
  return window.speechSynthesis.speaking || window.speechSynthesis.pending
}

/**
 * Resuelve cuando no hay locución activa. Si se llama a `cancelGuideCoachSpeech`, también resuelve
 * (interrupción cuenta como fin para no bloquear colas de trabajo).
 */
export function waitForGuideCoachSpeechEnd(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  const s = window.speechSynthesis
  if (!coachSpeechSlotHeld && !s?.speaking && !s?.pending) return Promise.resolve()
  return new Promise((resolve) => {
    speechEndWaiters.push(resolve)
  })
}

/** Detiene el motor y despierta a quienes esperan fin; no invalida la cola de `speakGuideCoachMessage`. */
function stopSpeechSynthesisAndFlushWaiters(): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  try {
    window.speechSynthesis.cancel()
  } catch {
    /* noop */
  }
  flushSpeechEndWaiters()
}

export function cancelGuideCoachSpeech(): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  speakRequestId++
  releaseCoachSpeechSlot()
  stopSpeechSynthesisAndFlushWaiters()
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
 * Lee título y subtítulo del mensaje del coach.
 * Si ya hay locución, **no la corta**: encola este texto y lo reproduce al terminar la actual.
 * La última petición gana si llegan varias mientras se habla (solo se reproduce la más reciente al desocupar).
 */
export function speakGuideCoachMessage(opts: {
  title: string
  subtitle?: string
  lang: string
}): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return

  const title = opts.title.replace(/\s+/g, ' ').trim().slice(0, 200)
  if (!title) return

  const sub = (opts.subtitle ?? '').replace(/\s+/g, ' ').trim().slice(0, 900)
  const text = sub && sub !== title ? `${title}. ${sub}` : title

  const lang = opts.lang.includes('-') ? opts.lang : `${opts.lang}-${opts.lang.toUpperCase()}`
  const myReq = ++speakRequestId

  const start = () => {
    if (myReq !== speakRequestId) return

    const mySeq = ++utteranceSeq

    const run = () => {
      if (mySeq !== utteranceSeq) return
      coachSpeechSlotHeld = true
      try {
        const s = window.speechSynthesis
        if (s.paused) s.resume()
      } catch {
        /* noop */
      }
      const u = new SpeechSynthesisUtterance(text)
      u.lang = lang
      u.rate = 1
      u.pitch = 1.08
      u.volume = 1
      const voice = pickVoice(lang)
      if (voice) u.voice = voice
      const done = () => {
        if (mySeq !== utteranceSeq) return
        releaseCoachSpeechSlot()
        flushSpeechEndWaiters()
      }
      u.onend = done
      u.onerror = done
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

  if (isGuideCoachSpeechBusy()) {
    void waitForGuideCoachSpeechEnd().then(() => {
      if (myReq !== speakRequestId) return
      start()
    })
    return
  }

  start()
}
