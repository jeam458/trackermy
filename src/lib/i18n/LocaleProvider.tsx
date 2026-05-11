'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getMessages } from '@/messages/getMessages'
import type { AppLocale, AppMessages } from '@/messages/types'

const STORAGE_KEY = 'gdh-locale'

type LocaleContextValue = {
  locale: AppLocale
  setLocale: (l: AppLocale) => void
  messages: AppMessages
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

function readStoredLocale(): AppLocale {
  if (typeof window === 'undefined') return 'es'
  const s = localStorage.getItem(STORAGE_KEY)
  return s === 'en' || s === 'es' ? s : 'es'
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>('es')

  useEffect(() => {
    setLocaleState(readStoredLocale())
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(STORAGE_KEY, locale)
    document.documentElement.lang = locale === 'en' ? 'en' : 'es'
  }, [locale])

  const setLocale = useCallback((l: AppLocale) => {
    setLocaleState(l)
  }, [])

  const messages = useMemo(() => getMessages(locale), [locale])

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      messages,
    }),
    [locale, setLocale, messages]
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext)
  if (!ctx) {
    throw new Error('useLocale debe usarse dentro de LocaleProvider')
  }
  return ctx
}

export { STORAGE_KEY as LOCALE_STORAGE_KEY }
