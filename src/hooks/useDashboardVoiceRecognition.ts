'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppLocale } from '@/messages/types'

type RecognitionCtor = new () => SpeechRecognition

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor
    webkitSpeechRecognition?: RecognitionCtor
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

function langForLocale(locale: AppLocale): string {
  return locale === 'en' ? 'en-US' : 'es-PE'
}

export type VoiceRecognitionState = {
  supported: boolean
  listening: boolean
  interim: string
  error: string | null
}

/**
 * Web Speech API (solo cliente). La transcripción final no se envía a servidores para STT.
 */
export function useDashboardVoiceRecognition(locale: AppLocale) {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recRef = useRef<SpeechRecognition | null>(null)
  const onFinalRef = useRef<(text: string) => void>(() => {})

  useEffect(() => {
    setSupported(getRecognitionCtor() != null)
  }, [])

  const stop = useCallback(() => {
    try {
      recRef.current?.stop()
    } catch {
      // noop
    }
    recRef.current = null
    setListening(false)
    setInterim('')
  }, [])

  const setOnFinal = useCallback((fn: (text: string) => void) => {
    onFinalRef.current = fn
  }, [])

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor()
    if (!Ctor) {
      setError('unsupported')
      return
    }
    setError(null)
    setInterim('')
    try {
      recRef.current?.stop()
    } catch {
      // noop
    }

    const rec = new Ctor()
    rec.lang = langForLocale(locale)
    rec.interimResults = true
    rec.continuous = false
    rec.maxAlternatives = 1

    rec.onerror = (ev) => {
      const code = (ev as SpeechRecognitionErrorEvent).error
      if (code === 'aborted' || code === 'no-speech') {
        setError(code === 'no-speech' ? 'no_speech' : null)
      } else if (code === 'not-allowed') {
        setError('not_allowed')
      } else {
        setError(code || 'error')
      }
      setListening(false)
      setInterim('')
    }

    rec.onend = () => {
      setListening(false)
      recRef.current = null
    }

    rec.onresult = (ev: SpeechRecognitionEvent) => {
      let finalChunk = ''
      let interimChunk = ''
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i]!
        const t = r[0]?.transcript ?? ''
        if (r.isFinal) finalChunk += t
        else interimChunk += t
      }
      if (interimChunk) setInterim(interimChunk.trim())
      if (finalChunk) {
        const text = finalChunk.trim()
        setInterim('')
        if (text) onFinalRef.current(text)
      }
    }

    recRef.current = rec
    setListening(true)
    try {
      rec.start()
    } catch {
      setError('start_failed')
      setListening(false)
    }
  }, [locale])

  useEffect(() => {
    return () => {
      try {
        recRef.current?.stop()
      } catch {
        // noop
      }
    }
  }, [])

  return {
    supported,
    listening,
    interim,
    error,
    start,
    stop,
    setOnFinal,
  }
}
