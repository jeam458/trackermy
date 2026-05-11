export type RiderGuideMood = 'loading' | 'focus' | 'fatigue' | 'triumph' | 'guide' | 'warning' | 'error'

/** Solo cuando `source === 'toast'`: color/animación alineados al tipo de aviso. */
export type RiderGuideToastType = 'success' | 'error' | 'warning' | 'info'

export type RiderGuidePayload = {
  mood?: RiderGuideMood
  title: string
  subtitle?: string
  duration?: number
  source?: 'toast' | 'navigation' | 'data' | 'manual'
  toastType?: RiderGuideToastType
}

type Listener = (payload: RiderGuidePayload) => void

let listener: Listener | null = null
const pendingQueue: RiderGuidePayload[] = []

export function emitRiderGuide(payload: RiderGuidePayload) {
  if (listener) {
    listener(payload)
    return
  }
  pendingQueue.push(payload)
}

export function bindRiderGuideChannel(next: Listener | null) {
  listener = next
  if (next && pendingQueue.length > 0) {
    const batch = pendingQueue.splice(0, pendingQueue.length)
    batch.forEach(next)
  }
}
