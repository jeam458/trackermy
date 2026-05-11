'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Globe, BarChart2, MapPinned, User, Trophy, X } from 'lucide-react'
import { useLocale } from '@/lib/i18n/LocaleProvider'
import { useDashboardSidebar } from '@/lib/dashboard/DashboardSidebarContext'

const SIDEBAR_Z = 2147483640

export function DashboardSidebar() {
  const pathname = usePathname() || ''
  const { messages } = useLocale()
  const { open, closeSidebar } = useDashboardSidebar()
  const n = messages.nav

  const links = [
    { href: '/dashboard', label: n.discover, icon: Globe, match: (p: string) => p === '/dashboard' },
    { href: '/dashboard/activity', label: n.activity, icon: BarChart2, match: (p: string) => p.startsWith('/dashboard/activity') },
    { href: '/dashboard/routes', label: n.routes, icon: MapPinned, match: (p: string) => p.startsWith('/dashboard/routes') && !p.includes('/record') },
    { href: '/dashboard/ranking', label: n.ranking, icon: Trophy, match: (p: string) => p.startsWith('/dashboard/ranking') },
    { href: '/dashboard/profile', label: n.profile, icon: User, match: (p: string) => p.startsWith('/dashboard/profile') },
  ] as const

  if (pathname.startsWith('/dashboard/routes/record')) return null

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            key="backdrop"
            aria-label="Cerrar menú"
            className="fixed inset-0 bg-black/55 backdrop-blur-[2px]"
            style={{ zIndex: SIDEBAR_Z }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeSidebar}
          />
          <motion.aside
            key="panel"
            className="fixed left-0 top-0 bottom-0 flex w-[min(20rem,calc(100vw-2.5rem))] flex-col border-r border-white/10 bg-[#0e141c]/95 py-safe shadow-2xl backdrop-blur-md"
            style={{ zIndex: SIDEBAR_Z + 1, paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
            initial={{ x: '-102%' }}
            animate={{ x: 0 }}
            exit={{ x: '-102%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          >
            <div className="flex items-center justify-between px-3 pb-2">
              <p className="text-xs font-bold uppercase tracking-widest text-teal-300/90">guardDh</p>
              <button
                type="button"
                onClick={closeSidebar}
                className="rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white"
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="flex shrink-0 flex-col gap-1 px-2 pt-2">
              {links.map(({ href, label, icon: Icon, match }) => {
                const active = match(pathname)
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={closeSidebar}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                      active ? 'bg-teal-500/15 text-teal-300' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Icon size={20} strokeWidth={active ? 2.25 : 1.75} />
                    {label}
                  </Link>
                )
              })}
            </nav>

            <div
              id="gdh-sidebar-pet-slot"
              className="flex min-h-[10rem] flex-1 flex-col items-center justify-center px-3 py-6"
            />
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  )
}
