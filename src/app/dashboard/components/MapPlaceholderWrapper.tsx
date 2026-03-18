'use client'

import dynamic from 'next/dynamic'

const DynamicMap = dynamic(() => import('./DashboardMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] bg-slate-800 animate-pulse rounded-3xl border border-slate-700">
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4" />
          <p className="text-gray-400">Cargando mapa...</p>
        </div>
      </div>
    </div>
  ),
})

export default function MapPlaceholderWrapper() {
  return <DynamicMap />
}
