import { BrandLogoLoader } from '@/components/ui/BrandLogoLoader'

export default function AppLoading() {
  return (
    <div className="min-h-screen bg-gdh-canvas-2 flex items-center justify-center px-6">
      <BrandLogoLoader label="Cargando…" showRing />
    </div>
  )
}
