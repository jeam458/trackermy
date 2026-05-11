'use client'

import dynamic from 'next/dynamic'
import { BrandSpinner } from '@/components/ui/BrandLogoLoader'

const DynamicMap = dynamic(() => import('./DashboardMapVector'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[200px] bg-[#0f172a] animate-pulse rounded-2xl border border-white/10">
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <BrandSpinner className="mx-auto mb-4" size={48} />
          <p className="text-gray-400">Cargando mapa...</p>
        </div>
      </div>
    </div>
  ),
})

export default function MapPlaceholderWrapper() {
  return (
    <div className="h-full w-full min-h-0 [&_.maplibregl-map]:min-h-0 [&_.maplibregl-map]:h-full">
      <DynamicMap />
    </div>
  )
}
