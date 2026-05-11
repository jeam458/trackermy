'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/core/infrastructure/supabase/client'
import { GuardDhSplashScreen } from '@/components/brand/GuardDhSplashScreen'

const SPLASH_MS = 1600

/**
 * Entrada `/`: splash de marca y luego dashboard si hay sesión, si no login.
 */
export function HomeEntryClient() {
  const router = useRouter()
  const [phase, setPhase] = useState<'splash' | 'routing'>('splash')

  useEffect(() => {
    const t = window.setTimeout(() => setPhase('routing'), SPLASH_MS)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    if (phase !== 'routing') return
    let cancelled = false
    void (async () => {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (cancelled) return
        if (user) router.replace('/dashboard')
        else router.replace('/login')
      } catch {
        if (!cancelled) router.replace('/login')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [phase, router])

  return <GuardDhSplashScreen />
}
