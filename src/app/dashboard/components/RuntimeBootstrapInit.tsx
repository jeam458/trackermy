'use client'

import { useEffect, useState } from 'react'
import { BrandSpinner } from '@/components/ui/BrandLogoLoader'
import {
  bootstrapRuntimeOnce,
  type RuntimeBootstrapStatus,
} from '@/lib/runtimeBootstrap'

const initialStatus: RuntimeBootstrapStatus = {
  running: false,
  done: false,
  stage: 'idle',
  message: '',
}

/**
 * Primera ejecución: descarga recursos de WebLLM + cache base local de Supabase.
 * Se muestra solo mientras corre o si hay error.
 */
export function RuntimeBootstrapInit() {
  const [status, setStatus] = useState<RuntimeBootstrapStatus>(initialStatus)

  useEffect(() => {
    let cancelled = false
    void bootstrapRuntimeOnce((next) => {
      if (!cancelled) setStatus(next)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const shouldShow = status.running || status.stage === 'error'
  if (!shouldShow) return null

  return (
    <div className="fixed left-3 right-3 top-3 z-[2147483010] pointer-events-none">
      <div className="mx-auto max-w-lg rounded-xl border border-cyan-400/30 bg-[#111b26]/92 px-3 py-2.5 shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-2">
          <BrandSpinner size={18} />
          <p className="text-sm font-semibold text-cyan-100">Preparando IA local y datos offline</p>
        </div>
        <p className="mt-1 text-xs text-cyan-200/85">{status.message}</p>
        {typeof status.progressPct === 'number' ? (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-cyan-950/70">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-400 transition-all duration-300"
              style={{ width: `${Math.max(3, Math.min(100, status.progressPct))}%` }}
            />
          </div>
        ) : null}
        {status.modelId ? (
          <p className="mt-1 text-[10px] text-cyan-300/75">Modelo: {status.modelId}</p>
        ) : null}
        {status.modelLoadNote ? (
          <p className="mt-1 text-[10px] text-amber-200/85 max-h-16 overflow-y-auto leading-snug">
            {status.modelLoadNote}
          </p>
        ) : null}
        {status.stage === 'error' ? (
          <p className="mt-1 text-[11px] text-rose-200">
            Falló bootstrap inicial: {status.error || 'error desconocido'}
          </p>
        ) : null}
      </div>
    </div>
  )
}

