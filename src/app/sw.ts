/// <reference lib="webworker" />
import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { Serwist, CacheFirst, ExpirationPlugin } from 'serwist'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ url }) => {
        return url.hostname.includes('server.arcgisonline.com') ||
               url.hostname.includes('stamen-tiles.a.ssl.fastly.net') ||
               url.hostname.includes('tile.openstreetmap.org')
      },
      handler: new CacheFirst({
        cacheName: 'offline-map-tiles',
        plugins: [
          new ExpirationPlugin({
            maxEntries: 5000,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Días
          }),
        ],
      }),
    },
    ...defaultCache,
  ],
})

serwist.addEventListeners()
