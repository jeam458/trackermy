'use client'

import dynamic from 'next/dynamic'
import { MapPoint } from './RouteMapEditor'

// Importar dinámicamente el editor de mapa para evitar problemas de SSR
export const RouteMapEditorDynamic = dynamic(
  () => import('./RouteMapEditor').then((mod) => mod.RouteMapEditor),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-slate-800 rounded-lg">
        <div className="text-center text-gray-400">
          <p>Cargando mapa...</p>
        </div>
      </div>
    ),
  }
)

export const RouteMapViewerDynamic = dynamic(
  () => import('./RouteMapEditor').then((mod) => mod.RouteMapViewer),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-slate-800 rounded-lg">
        <div className="text-center text-gray-400">
          <p>Cargando mapa...</p>
        </div>
      </div>
    ),
  }
)

export type { MapPoint }
