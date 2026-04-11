import {
  MapIcon,
  TimerIcon,
  TrophyIcon,
  UserIcon,
  BellIcon,
} from 'lucide-react'
import Link from 'next/link'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full bg-slate-800/90 backdrop-blur-md border-t border-slate-700/50 px-4 py-3 pb-safe flex justify-between items-center z-50">
        <Link href="/dashboard" className="flex flex-col items-center gap-1 text-sky-500 hover:text-sky-400 transition-colors">
          <MapIcon size={22} />
          <span className="text-[10px] font-medium">Rutas</span>
        </Link>
        <Link href="/dashboard/record" className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors">
          <TimerIcon size={22} />
          <span className="text-[10px] font-medium">Grabar</span>
        </Link>
        <Link href="/dashboard/ranking" className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors">
          <TrophyIcon size={22} />
          <span className="text-[10px] font-medium">Ranking</span>
        </Link>
        <Link href="/dashboard/notifications" className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors relative">
          <BellIcon size={22} />
          <span className="text-[10px] font-medium">Alertas</span>
        </Link>
        <Link href="/dashboard/profile" className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors">
          <UserIcon size={22} />
          <span className="text-[10px] font-medium">Perfil</span>
        </Link>
      </nav>
    </div>
  )
}
