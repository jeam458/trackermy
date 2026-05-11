import { PetEmotionRecipeProvider } from '@/components/pet/PetEmotionRecipeContext'
import { DashboardPageTransition } from '@/components/ui/DashboardPageTransition'
import { DashboardAmbientBackground } from '@/components/ui/DashboardAmbientBackground'
import { DashboardRiderCore } from '@/components/ui/DashboardRiderCore'
import { DashboardBottomNav } from './components/DashboardBottomNav'
import { DashboardMainScrollPadding } from './components/DashboardMainScrollPadding'
import { SyncManagerInit } from './components/SyncManagerInit'
import { DashboardLocaleProvider } from './components/DashboardLocaleProvider'
import { DashboardSidebarProvider } from '@/lib/dashboard/DashboardSidebarContext'
import { DashboardSidebar } from './components/DashboardSidebar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <PetEmotionRecipeProvider>
      <DashboardLocaleProvider>
        <DashboardSidebarProvider>
          <div className="min-h-screen bg-gdh-canvas-2 text-slate-100 flex flex-col relative overflow-hidden">
            <DashboardAmbientBackground />
            <DashboardRiderCore />
            <SyncManagerInit />
            <main className="flex-1 flex flex-col min-h-0 relative z-[1]">
              <DashboardPageTransition>
                <DashboardMainScrollPadding>{children}</DashboardMainScrollPadding>
              </DashboardPageTransition>
            </main>
            <DashboardBottomNav />
            <DashboardSidebar />
          </div>
        </DashboardSidebarProvider>
      </DashboardLocaleProvider>
    </PetEmotionRecipeProvider>
  )
}
