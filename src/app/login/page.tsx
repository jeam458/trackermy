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
      <div className={`min-h-screen flex items-center justify-center bg-slate-900 ${styles.loginPage}`}>
        <BrandLogoLoader label="Validando sesión…" />
      </div>
    )
  }

  return (
    <div className={`min-h-screen flex items-center justify-center bg-slate-900 ${styles.loginPage}`}>
      <div className={`w-full max-w-md p-8 space-y-8 bg-slate-800 rounded-3xl shadow-xl border border-slate-700 ${styles.loginCard}`}>
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            guard<span className="text-teal-400">Dh</span>
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Sign in to track your best times and routes.
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
