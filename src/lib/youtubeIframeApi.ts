'use client'

type YTPlayerInstance = {
  destroy: () => void
  loadVideoById: (videoId: string) => void
  playVideo: () => void
  pauseVideo: () => void
  stopVideo: () => void
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void
  setVolume: (v: number) => void
}

type YTPlayerCtor = new (
  container: string | HTMLElement,
  opts: {
    videoId?: string
    width?: string | number
    height?: string | number
    playerVars?: Record<string, number | string>
    events?: {
      onReady?: (e: { target: YTPlayerInstance }) => void
      onError?: (e: { data: number }) => void
    }
  }
) => YTPlayerInstance

declare global {
  interface Window {
    YT?: { Player: YTPlayerCtor }
    onYouTubeIframeAPIReady?: () => void
  }
}

let iframeApiPromise: Promise<void> | null = null

/** Carga https://www.youtube.com/iframe_api una sola vez. */
export function ensureYoutubeIframeApiLoaded(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.YT?.Player) return Promise.resolve()
  if (iframeApiPromise) return iframeApiPromise

  iframeApiPromise = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      try {
        if (typeof prev === 'function') prev()
      } finally {
        resolve()
      }
    }
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    tag.async = true
    tag.onerror = () => reject(new Error('No se pudo cargar la API de YouTube (iframe_api)'))
    document.head.appendChild(tag)
  })
  return iframeApiPromise
}

export type { YTPlayerInstance }
