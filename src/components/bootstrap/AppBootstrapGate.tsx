'use client'

import { useEffect, useState } from 'react'
import { BrandLogoLoader } from '@/components/ui/BrandLogoLoader'
import {
  bootstrapRuntimeOnce,
  type RuntimeBootstrapStatus,
} from '@/lib/runtimeBootstrap'

const initialStatus: RuntimeBootstrapStatus = {
  running: false,
  done: false,
  stage: 'idle',
  message: 'Iniciando…',
}

export function AppBootstrapGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<RuntimeBootstrapStatus>(initialStatus)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    void bootstrapRuntimeOnce((next) => {
      if (!cancelled) setStatus(next)
    }).then((finalStatus) => {
      if (!cancelled && finalStatus.done) {
        setReady(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!ready) {
    const progress =
      typeof status.progressPct === 'number'
        ? Math.max(2, Math.min(100, status.progressPct))
        : null

    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-900">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(14,116,144,0.18),transparent_58%)]" />
        <div className="relative z-10 flex w-full max-w-xl flex-col items-center px-6 text-center">
          <BrandLogoLoader label={status.message || 'Preparando recursos...'} compact showRing />
          <p className="mt-4 text-lg font-semibold text-cyan-100">Preparando IA local y datos offline</p>
          {progress != null ? (
            <div className="mt-4 h-2 w-full max-w-sm overflow-hidden rounded-full bg-cyan-950/70">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-400 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          ) : null}
          {status.modelId ? (
            <p className="mt-2 text-center text-xs text-cyan-200/80">Modelo local: {status.modelId}</p>
          ) : null}
          {status.modelLoadNote ? (
            <p className="mt-2 max-h-24 overflow-y-auto text-center text-[11px] leading-snug text-amber-200/90">
              {status.modelLoadNote}
            </p>
          ) : null}
          {status.stage === 'error' ? (
            <p className="mt-2 text-center text-xs text-rose-300">Error: {status.error || 'falló bootstrap inicial'}</p>
          ) : null}
        </div>
      </div>
    )
  }

  return <>{children}</>
}

