import { BrandLogoLoader } from '@/components/ui/BrandLogoLoader'

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gdh-canvas-2 flex items-center justify-center px-6 pb-24">
      <BrandLogoLoader label="Cargando página…" showRing />
    </div>
  )
}
