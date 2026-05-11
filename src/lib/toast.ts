/**
 * API global de notificaciones. Usa el mismo canal que `ToastProvider` / `<Toaster />`.
 *
 * @example
 * import { toast } from '@/lib/toast'
 * toast.success('Guardado', 'Los cambios se aplicaron')
 * toast.error('Error de red')
 * toast.show('info', 'Título', 'Descripción opcional', { duration: 8000 })
 */

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export type ToastOptions = {
  /** ms; por defecto 5000 */
  duration?: number
}

export type ToastPayload = {
  type: ToastType
  message: string
  description?: string
  duration?: number
}

import { emitRiderGuide, type RiderGuideMood, type RiderGuideToastType } from '@/lib/riderGuide'

type Listener = (payload: ToastPayload) => void

const DEFAULT_DURATION_MS = 5000

let listener: Listener | null = null
const pendingQueue: ToastPayload[] = []

function emit(payload: ToastPayload) {
  const moodByType: Record<ToastType, RiderGuideMood> = {
    success: 'triumph',
    info: 'guide',
    warning: 'warning',
    error: 'error',
  }
  // El guía replica cada toast para convertirlo en “voz” contextual dentro del dashboard.
  emitRiderGuide({
    mood: moodByType[payload.type],
    title: payload.message,
    subtitle: payload.description,
    duration: payload.duration,
    source: 'toast',
    toastType: payload.type as RiderGuideToastType,
  })

  if (listener) {
    listener(payload)
    return
  }
  pendingQueue.push(payload)
}

/** Solo lo usa `ToastProvider` al montar / desmontar. */
export function bindToastChannel(next: Listener | null) {
  listener = next
  if (next && pendingQueue.length > 0) {
    const batch = pendingQueue.splice(0, pendingQueue.length)
    batch.forEach(next)
  }
}

function show(
  type: ToastType,
  message: string,
  description?: string,
  options?: ToastOptions
) {
  emit({
    type,
    message,
    description,
    duration: options?.duration ?? DEFAULT_DURATION_MS,
  })
}

export const toast = {
  show: show,

  success: (message: string, description?: string, options?: ToastOptions) =>
    show('success', message, description, options),

  error: (message: string, description?: string, options?: ToastOptions) =>
    show('error', message, description, options),

  warning: (message: string, description?: string, options?: ToastOptions) =>
    show('warning', message, description, options),

  info: (message: string, description?: string, options?: ToastOptions) =>
    show('info', message, description, options),
}
