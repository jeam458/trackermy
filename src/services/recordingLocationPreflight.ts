import { Capacitor } from '@capacitor/core'
import { backgroundGeolocation } from '@/services/backgroundGeolocationPlugin'

export type LocationPreflightResult =
  | { ok: true }
  | { ok: false; message: string; openSettings?: boolean }

/** Una lectura rápida para comprobar distancia al inicio de una ruta (WebView / navegador). */
export function getQuickPosition(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocalización no disponible'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      reject,
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    )
  })
}

export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Comprueba permisos y obtiene un fix antes de grabar. En nativo usa el mismo plugin
 * que la grabación en segundo plano para alinear permisos y notificación.
 */
export async function ensureLocationForRecording(): Promise<LocationPreflightResult> {
  if (!Capacitor.isNativePlatform()) {
    try {
      await getQuickPosition()
      return { ok: true }
    } catch {
      return {
        ok: false,
        message:
          'No se pudo obtener tu posición. Permite el acceso a ubicación y comprueba que el GPS esté activo.',
      }
    }
  }

  return new Promise((resolve) => {
    let finished = false
    let watcherId: string | null = null

    const finish = async (result: LocationPreflightResult) => {
      if (finished) return
      finished = true
      if (watcherId) {
        try {
          await backgroundGeolocation.removeWatcher({ id: watcherId })
        } catch {
          /* noop */
        }
      }
      resolve(result)
    }

    const timer = window.setTimeout(() => {
      void finish({
        ok: false,
        message:
          'Sin señal GPS a tiempo. Sal a cielo abierto, activa ubicación de alta precisión y vuelve a intentar.',
        openSettings: true,
      })
    }, 22000)

    void backgroundGeolocation.addWatcher(
      {
        requestPermissions: true,
        stale: false,
        backgroundMessage:
          'Downhill Tracker registra la bajada incluso con la pantalla apagada.',
        backgroundTitle: 'GPS activo — Downhill Tracker',
        distanceFilter: 0,
      },
      (location, error) => {
        if (finished) return
        if (error) {
          if (error.code === 'NOT_AUTHORIZED') {
            window.clearTimeout(timer)
            void finish({
              ok: false,
              message:
                'Permiso de ubicación denegado. Concede ubicación a la app (y “siempre” / en segundo plano si Android lo pide).',
              openSettings: true,
            })
          }
          return
        }
        if (location) {
          window.clearTimeout(timer)
          void finish({ ok: true })
        }
      }
    ).then((id) => {
      watcherId = id
    })
  })
}

export async function openAppLocationSettings(): Promise<void> {
  await backgroundGeolocation.openSettings()
}
