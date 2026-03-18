'use client'

import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { createClient } from '@/core/infrastructure/supabase/client'
import { useEffect, useState } from 'react'

export default function LoginForm() {
  const [supabase] = useState(() => createClient())

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || !supabase) return <div className="animate-pulse h-32 bg-slate-700 rounded-xl"></div>

  return (
    <div className="mt-8">
      <Auth
        supabaseClient={supabase}
        providers={['google']}
        appearance={{
          theme: ThemeSupa,
          variables: {
            default: {
              colors: {
                brand: '#0ea5e9', // Sky 500
                brandAccent: '#0284c7', // Sky 600
                inputText: 'white',
                inputBackground: '#1e293b', // Slate 800
                inputBorder: '#334155', // Slate 700
                defaultButtonBackground: '#1e293b',
                defaultButtonBackgroundHover: '#334155',
                defaultButtonBorder: '#334155',
                defaultButtonText: 'white',
              },
              radii: {
                borderRadiusButton: '0.75rem',
                buttonBorderRadius: '0.75rem',
                inputBorderRadius: '0.75rem',
              },
            },
          },
          className: {
            button: 'font-semibold transition-colors duration-200',
            container: 'space-y-4',
            input: 'bg-slate-800 border-slate-700 text-white focus:ring-sky-500 focus:border-sky-500',
            label: 'text-slate-300 font-medium',
          }
        }}
        theme="dark"
        onlyThirdPartyProviders
        redirectTo={`${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`}
      />
    </div>
  )
}
