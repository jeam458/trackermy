'use client'

type OptimizedMediaResult = {
  file: File
  optimized: boolean
  reason?: string
  blocked?: boolean
}

const MAX_IMAGE_DIMENSION_PX = 1920
const IMAGE_MIN_QUALITY = 0.68
const IMAGE_MAX_QUALITY = 0.9
/** Por debajo de esto no recodificamos en el navegador: se sube el vídeo completo (sin cortar duración). */
const MAX_VIDEO_BYTES_SKIP_TRANSCODE = 42 * 1024 * 1024
/** Límite del bucket `attempt-media` (ver migraciones Supabase). */
const MAX_VIDEO_STORAGE_BYTES = 100 * 1024 * 1024

function replaceFileExtension(name: string, ext: string): string {
  const base = name.replace(/\.[a-zA-Z0-9]+$/, '')
  return `${base}.${ext}`
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality)
  })
}

async function loadImageBitmap(file: File): Promise<ImageBitmap> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file)
  }
  const url = URL.createObjectURL(file)
  try {
    const img = document.createElement('img')
    img.decoding = 'async'
    img.src = url
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('No se pudo obtener contexto de canvas')
    ctx.drawImage(img, 0, 0)
    return createImageBitmap(canvas)
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function optimizeImage(file: File): Promise<OptimizedMediaResult> {
  const bitmap = await loadImageBitmap(file)
  try {
    const scale = Math.min(1, MAX_IMAGE_DIMENSION_PX / Math.max(bitmap.width, bitmap.height))
    const targetWidth = Math.max(1, Math.round(bitmap.width * scale))
    const targetHeight = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return { file, optimized: false, reason: 'No se pudo crear canvas para imagen' }

    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight)

    // Similar a apps sociales: calidad adaptativa + límite de tamaño objetivo.
    const targetMaxBytes = clamp(Math.round(file.size * 0.45), 350_000, 1_600_000)
    const outputMime = 'image/webp'
    let bestBlob: Blob | null = null
    let bestQuality = IMAGE_MAX_QUALITY

    for (let q = IMAGE_MAX_QUALITY; q >= IMAGE_MIN_QUALITY; q -= 0.04) {
      const blob = await canvasToBlob(canvas, outputMime, q)
      if (!blob) continue
      if (!bestBlob || blob.size < bestBlob.size) {
        bestBlob = blob
        bestQuality = q
      }
      if (blob.size <= targetMaxBytes) {
        bestBlob = blob
        bestQuality = q
        break
      }
    }

    if (!bestBlob) return { file, optimized: false, reason: 'No se pudo exportar imagen optimizada' }
    if (bestBlob.size >= file.size * 0.98) return { file, optimized: false, reason: 'Imagen ya optimizada' }

    const out = new File([bestBlob], replaceFileExtension(file.name, 'webp'), {
      type: outputMime,
      lastModified: file.lastModified,
    })
    return {
      file: out,
      optimized: true,
      reason: `Imagen optimizada (${Math.round(bestQuality * 100)}% calidad)`,
    }
  } finally {
    bitmap.close()
  }
}

function canTranscodeVideoInBrowser(): boolean {
  if (typeof window === 'undefined') return false
  if (typeof MediaRecorder === 'undefined') return false
  if (typeof document === 'undefined') return false
  return (
    MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ||
    MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') ||
    MediaRecorder.isTypeSupported('video/webm')
  )
}

function chooseMediaRecorderMimeType(): string {
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) return 'video/webm;codecs=vp9,opus'
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) return 'video/webm;codecs=vp8,opus'
  return 'video/webm'
}

async function optimizeVideo(file: File): Promise<OptimizedMediaResult> {
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.src = url
  video.preload = 'metadata'
  video.playsInline = true
  video.muted = true

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error('No se pudo leer metadatos del vídeo'))
    })

    const durationSec = Math.max(0.1, Number(video.duration) || 0)
    /** Nunca recortamos por tiempo en subida: el reel u otras vistas pueden usar trozos; aquí va el archivo completo. */
    if (file.size <= MAX_VIDEO_BYTES_SKIP_TRANSCODE) {
      return {
        file,
        optimized: false,
        reason: 'Vídeo dentro del tamaño máximo para subir sin recodificar: se sube el original completo (audio intacto).',
      }
    }
    if (!canTranscodeVideoInBrowser()) {
      if (file.size > MAX_VIDEO_STORAGE_BYTES) {
        return {
          file,
          optimized: false,
          blocked: true,
          reason:
            'El vídeo supera el límite de 100 MB del servidor y este navegador no puede comprimirlo. Reducí tamaño o duración con la app de Cámara / Fotos e intentá de nuevo.',
        }
      }
      return {
        file,
        optimized: false,
        reason: 'Transcodificación no disponible; se intenta subir el archivo original completo.',
      }
    }

    const trimEndSec = durationSec
    const sourceW = Math.max(1, video.videoWidth || 1)
    const sourceH = Math.max(1, video.videoHeight || 1)
    const maxSide = Math.max(sourceW, sourceH)
    const scale = Math.min(1, 1280 / maxSide)
    const outW = Math.max(2, Math.round(sourceW * scale))
    const outH = Math.max(2, Math.round(sourceH * scale))

    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')
    if (!ctx) return { file, optimized: false, reason: 'No se pudo crear canvas para vídeo' }

    const canvasStream = canvas.captureStream(30)
    const mimeType = chooseMediaRecorderMimeType()
    const inputBitrate = (file.size * 8) / durationSec
    const targetVideoBitsPerSecond = clamp(Math.round(inputBitrate * 0.62), 900_000, 4_000_000)

    const chunks: Blob[] = []

    let recordedWithAudio = false

    await new Promise<void>((resolve, reject) => {
      let rafId = 0
      let stopped = false
      let recorder: MediaRecorder
      let audioCtx: AudioContext | null = null

      const cleanupAudio = () => {
        void audioCtx?.close().catch(() => {})
        audioCtx = null
      }

      const stopRecorder = () => {
        if (stopped) return
        stopped = true
        if (recorder && recorder.state !== 'inactive') recorder.stop()
      }
      const drawFrame = () => {
        ctx.drawImage(video, 0, 0, outW, outH)
        const atEnd = video.ended || video.currentTime >= trimEndSec - 0.06
        if (atEnd) {
          video.pause()
          stopRecorder()
          return
        }
        if (!video.paused && !video.ended) rafId = requestAnimationFrame(drawFrame)
      }

      video.onended = () => {
        stopRecorder()
      }

      video.currentTime = 0
      /** Con `createMediaElementSource` el audio no sale por los altavoces si no conectamos a `destination`. */
      video.muted = false

      void video
        .play()
        .then(async () => {
          let recordStream: MediaStream = canvasStream
          const AC =
            typeof window !== 'undefined'
              ? window.AudioContext ||
                (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
              : undefined
          if (AC) {
            try {
              audioCtx = new AC()
              const mes = audioCtx.createMediaElementSource(video)
              const audioDest = audioCtx.createMediaStreamDestination()
              mes.connect(audioDest)
              await audioCtx.resume().catch(() => {})
              const ats = audioDest.stream.getAudioTracks()
              if (ats.length > 0) {
                recordStream = new MediaStream([...canvasStream.getVideoTracks(), ...ats])
              }
            } catch {
              cleanupAudio()
              recordStream = canvasStream
            }
          }

          const recOpts: MediaRecorderOptions = {
            mimeType,
            videoBitsPerSecond: targetVideoBitsPerSecond,
          }
          if (recordStream.getAudioTracks().length > 0) {
            recOpts.audioBitsPerSecond = 128_000
            recordedWithAudio = true
          }
          recorder = new MediaRecorder(recordStream, recOpts)
          recorder.ondataavailable = (ev) => {
            if (ev.data && ev.data.size > 0) chunks.push(ev.data)
          }
          recorder.onerror = () => reject(new Error('Error al recodificar vídeo'))
          recorder.onstop = () => {
            cancelAnimationFrame(rafId)
            cleanupAudio()
            resolve()
          }
          recorder.start(250)
          drawFrame()
        })
        .catch((err) => {
          cleanupAudio()
          reject(err)
        })
    })

    if (chunks.length === 0) return { file, optimized: false, reason: 'No se pudo generar vídeo optimizado' }

    if (!recordedWithAudio) {
      return {
        file,
        optimized: false,
        reason:
          'La recodificación no capturó audio (vídeo sin pista o limitación del navegador). Se sube el archivo original completo.',
      }
    }

    const outBlob = new Blob(chunks, { type: mimeType })
    if (outBlob.size >= file.size * 0.97) return { file, optimized: false, reason: 'Vídeo ya optimizado' }

    const out = new File([outBlob], replaceFileExtension(file.name, 'webm'), {
      type: outBlob.type || 'video/webm',
      lastModified: file.lastModified,
    })
    return {
      file: out,
      optimized: true,
      reason: 'Vídeo completo recodificado (misma duración) para reducir tamaño antes de subir',
    }
  } catch (error) {
    console.warn('[mediaUploadOptimizer] fallback vídeo original', error)
    return { file, optimized: false, reason: 'No se pudo optimizar vídeo; se sube original' }
  } finally {
    URL.revokeObjectURL(url)
    video.remove()
  }
}

export async function optimizeMediaBeforeUpload(file: File): Promise<OptimizedMediaResult> {
  if (file.type.startsWith('image/')) return optimizeImage(file)
  if (file.type.startsWith('video/')) return optimizeVideo(file)
  return { file, optimized: false, reason: 'Tipo de archivo no optimizable' }
}
