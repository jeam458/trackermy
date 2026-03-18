import type { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Downhill Tracker',
    short_name: 'DH Tracker',
    description: 'Track your downhill trails, speed, and time.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f172a', // Slate 900
    theme_color: '#0f172a',
    icons: [
      {
        src: '/icon512_maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      },
      {
        src: '/icon512_rounded.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      }
    ],
  }
}
