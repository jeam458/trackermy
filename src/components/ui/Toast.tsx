'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react'
import { usePathname } from 'next/navigation'
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import {
  bindToastChannel,
  type ToastPayload,
  type ToastType,
  toast as toastApi,
} from '@/lib/toast'

export type { ToastType, ToastPayload } from '@/lib/toast'
export { toast } from '@/lib/toast'

type ToastRecord = ToastPayload & { id: string }

const ToastReadyContext = createContext(false)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([])
  const timeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const pathnameRef = useRef<string>('')

  const pathname = usePathname()
  pathnameRef.current = pathname ?? ''

  const removeToast = useCallback((id: string) => {
    const t = timeouts.current.get(id)
    if (t) {
      clearTimeout(t)
      timeouts.current.delete(id)
    }
    setToasts((prev) => prev.filter((x) => x.id !== id))
  }, [])

  useEffect(() => {
    function onIncoming(payload: ToastPayload) {
      /** En dashboard el pet (`DashboardRiderCore`) muestra el mismo mensaje con estilo por tipo. */
      if (pathnameRef.current.startsWith('/dashboard')) {
        return
      }

      const id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `t-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

      const duration = payload.duration ?? 5000

      setToasts((prev) => [...prev, { ...payload, id, duration }])

      const tid = setTimeout(() => removeToast(id), duration)
      timeouts.current.set(id, tid)
    }

    bindToastChannel(onIncoming)
    return () => {
      bindToastChannel(null)
      timeouts.current.forEach((tid) => clearTimeout(tid))
      timeouts.current.clear()
    }
  }, [removeToast])

  return (
    <ToastReadyContext.Provider value={true}>
      {children}
      <Toaster toasts={toasts} onDismiss={removeToast} />
    </ToastReadyContext.Provider>
  )
}

/**
 * Lista de avisos; normalmente montada por `ToastProvider`.
 * También puede usarse con estado propio en pruebas o layouts especiales.
 */
export function Toaster({
  toasts,
  onDismiss,
}: {
  toasts: ToastRecord[]
  onDismiss: (id: string) => void
}) {
  const pathname = usePathname()
  const hideVisualToast = pathname?.startsWith('/dashboard')

  if (hideVisualToast) {
    return null
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-4 z-[2147483020] flex flex-col items-center gap-2 px-4"
      aria-live="polite"
      aria-relevant="additions text"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto w-full max-w-md">
          <ToastItem toast={t} onClose={() => onDismiss(t.id)} />
        </div>
      ))}
    </div>
  )
}

function ToastItem({
  toast,
  onClose,
}: {
  toast: ToastRecord
  onClose: () => void
}) {
  const icons = {
    success: {
      icon: CheckCircle2,
      color: 'text-green-500',
      bg: 'bg-green-500/10',
      border: 'border-green-500/30',
    },
    error: {
      icon: AlertCircle,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
    },
    warning: {
      icon: AlertTriangle,
      color: 'text-yellow-500',
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/30',
    },
    info: {
      icon: Info,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
    },
  }

  const { icon: Icon, color, bg, border } = icons[toast.type]

  return (
    <div
      role="status"
      className={`${bg} ${border} w-full animate-in fade-in slide-in-from-top-2 border rounded-lg p-4 shadow-lg backdrop-blur-sm duration-300`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`${color} mt-0.5 shrink-0`} size={20} aria-hidden />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white">{toast.message}</p>
          {toast.description ? (
            <p className="mt-1 text-xs text-gray-400">{toast.description}</p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-gray-400 transition-colors hover:text-white"
          aria-label="Cerrar notificación"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

/** Misma API que `import { toast } from '@/lib/toast'`; lanza si no hay `ToastProvider`. */
export function useToast(): typeof toastApi {
  const ready = useContext(ToastReadyContext)
  if (!ready) {
    throw new Error('useToast debe usarse dentro de ToastProvider')
  }
  return toastApi
}
