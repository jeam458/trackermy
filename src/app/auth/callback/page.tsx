'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/core/infrastructure/supabase/client'
import { BrandSpinner } from '@/components/ui/BrandLogoLoader'

function AuthCallbackInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [message, setMessage] = useState('Completando inicio de sesión…')

  useEffect(() => {
    const code = searchParams.get('code')
    const next = searchParams.get('next') ?? '/dashboard'

    if (!code) {
      router.replace('/login?error=auth')
      return
    }

    const supabase = createClient()
    void supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setMessage('Error de autenticación')
        router.replace('/login?error=auth')
        return
      }
      router.replace(next.startsWith('/') ? next : '/dashboard')
    })
  }, [router, searchParams])

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-300 gap-3">
      <BrandSpinner size={28} />
      <span>{message}</span>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <BrandSpinner size={28} />
        </div>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  )
}
