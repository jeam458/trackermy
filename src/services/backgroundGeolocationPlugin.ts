import { registerPlugin } from '@capacitor/core'
import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation'

/** Una sola instancia: `registerPlugin` dos veces dispara el warning en consola. */
export const backgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation')
