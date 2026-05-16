import type { MetadataRoute } from 'next'

export const dynamic = 'force-static'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PATT',
    short_name: 'PATT',
    description: 'Tu compañero de descenso: rutas, actividad y ranking.',
    start_url: '/',
    display: 'standalone',
    background_color: '#09090b',
    theme_color: '#c55a2f',
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
