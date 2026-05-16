'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/core/infrastructure/supabase/client'
import LoginForm from './LoginForm'
import styles from './login.module.scss'
import { BrandLogoLoader } from '@/components/ui/BrandLogoLoader'

export default function LoginPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!cancelled && user) {
          router.replace('/dashboard')
          return
        }
      } catch {
        // Si falla lectura de sesión en arranque, evitamos quedar bloqueados en loader.
      }
      if (!cancelled) setChecking(false)
    })()
    return () => {
      cancelled = true
    }
  }, [router])

  if (checking) {
    return (
      <div className={`min-h-screen flex items-center justify-center gdh-immersive-page ${styles.loginPage}`}>
        <BrandLogoLoader label="Validando sesión…" showRing />
      </div>
    )
  }

  return (
    <div className={`min-h-screen flex items-center justify-center gdh-immersive-page px-4 py-10 ${styles.loginPage}`}>
      <div
        className={`w-full max-w-md space-y-8 rounded-3xl border border-white/10 bg-gdh-card/90 p-8 shadow-[0_24px_64px_rgba(0,0,0,0.45)] backdrop-blur-md ${styles.loginCard}`}
      >
        <div className="text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-gdh-brand-highlight">
            PATT
          </h2>
          <p className="mt-2 text-sm text-gdh-muted">
            Iniciá sesión para seguir tus tiempos y rutas.
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
