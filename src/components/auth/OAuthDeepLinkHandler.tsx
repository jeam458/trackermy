'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { createClient } from '@/core/infrastructure/supabase/client'

function extractCodeFromUrl(url: string): string | null {
  try {
    const i = url.indexOf('?')
    if (i === -1) return null
    return new URLSearchParams(url.slice(i)).get('code')
  } catch {
    return null
  }
}

/**
 * En Android/iOS el OAuth abre el navegador; Supabase redirige al deep link con ?code=.
 * Intercambiamos el código aquí porque /auth/callback no se carga en el WebView.
 */
export function OAuthDeepLinkHandler() {
  const router = useRouter()
  const busy = useRef(false)

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const handle = async (url: string) => {
      if (!url.includes('login-callback') && !url.includes('code=')) return
      const code = extractCodeFromUrl(url)
      if (!code || busy.current) return
      busy.current = true
      try {
        await Browser.close().catch(() => {})
      } catch {
        /* noop */
      }
      try {
        const supabase = createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
          router.replace('/dashboard')
        }
      } finally {
        busy.current = false
      }
    }

    let listener: { remove: () => Promise<void> } | undefined

    void (async () => {
      listener = await App.addListener('appUrlOpen', ({ url }) => {
        void handle(url)
      })
      const launch = await App.getLaunchUrl()
      if (launch?.url) await handle(launch.url)
    })()

    return () => {
      void listener?.remove()
    }
  }, [router])

  return null
}
