'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Globe, BarChart2, MapPinned, User } from 'lucide-react'
import { animate, gentlePulse } from '@/lib/animeUi'
import { useLocale } from '@/lib/i18n/LocaleProvider'

/** Z-index del nav fijo (portal). Los CTA fijos encima del nav deben usar un valor mayor. */
export const DASHBOARD_BOTTOM_NAV_Z_INDEX = 2147483000

/** `id` del `<nav>` en el DOM (portal). Permite medir altura real para overlays tipo mapa a pantalla completa. */
export const DASHBOARD_BOTTOM_NAV_DOM_ID = 'dashboard-bottom-nav'

export function DashboardBottomNav() {
  const { messages } = useLocale()
  const tabs = useMemo(
    () =>
      [
        { href: '/dashboard', label: messages.nav.discover, icon: Globe, match: (p: string) => p === '/dashboard' },
        {
          href: '/dashboard/activity',
          label: messages.nav.activity,
          icon: BarChart2,
          match: (p: string) => p.startsWith('/dashboard/activity'),
        },
        {
          href: '/dashboard/routes',
          label: messages.nav.routes,
          icon: MapPinned,
          match: (p: string) => p.startsWith('/dashboard/routes') && !p.includes('/record'),
        },
        {
          href: '/dashboard/profile',
          label: messages.nav.profile,
          icon: User,
          match: (p: string) => p.startsWith('/dashboard/profile'),
        },
      ] as const,
    [messages]
  )

  const pathname = usePathname() || ''
  const navRef = useRef<HTMLElement>(null)
  const indicatorRef = useRef<HTMLDivElement>(null)
  const iconPulseRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastActiveHref = useRef<string | null>(null)
  const indicatorFirstLayout = useRef(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useLayoutEffect(() => {
    if (pathname.startsWith('/dashboard/routes/record')) return
    const nav = navRef.current
    const ind = indicatorRef.current
    if (!nav || !ind) return

    const current = tabs.find((t) => t.match(pathname))
    if (!current) return

    const link = nav.querySelector<HTMLAnchorElement>(`a[href="${current.href}"]`)
    if (!link) return

    const n = nav.getBoundingClientRect()
    const r = link.getBoundingClientRect()
    const left = r.left - n.left
    const width = r.width

    const fromLeft = indicatorFirstLayout.current ? left : ind.offsetLeft
    const fromWidth = indicatorFirstLayout.current ? width : ind.offsetWidth
    indicatorFirstLayout.current = false

    ind.classList.remove('hidden')
    ind.style.display = 'block'

    if (fromLeft === left && fromWidth === width) {
      ind.style.left = `${left}px`
      ind.style.width = `${width}px`
      ind.style.opacity = '1'
    } else {
      void animate(ind, {
        left: [fromLeft, left],
        width: [fromWidth, width],
        opacity: [0.88, 1],
        duration: 340,
        ease: 'outCubic',
      })
    }

    if (lastActiveHref.current !== current.href) {
      lastActiveHref.current = current.href
      if (iconPulseRef.current) clearTimeout(iconPulseRef.current)
      iconPulseRef.current = setTimeout(() => {
        const ico = link.querySelector<HTMLElement>('.nav-tab-icon')
        if (ico) gentlePulse(ico)
      }, 50)
    }

    return () => {
      if (iconPulseRef.current) clearTimeout(iconPulseRef.current)
    }
  }, [pathname, tabs])

  if (pathname.startsWith('/dashboard/routes/record')) {
    return null
  }

  if (!mounted) return null

  const nav = (
    <motion.nav
      id={DASHBOARD_BOTTOM_NAV_DOM_ID}
      ref={navRef}
      className="bg-gdh-card/95 backdrop-blur-md border-t border-white/5 px-2 py-2 flex justify-around items-center relative"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: DASHBOARD_BOTTOM_NAV_Z_INDEX,
        paddingBottom: 'max(env(safe-area-inset-bottom), 0px)',
      }}
      initial={{ y: 18, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <div
        ref={indicatorRef}
        className="pointer-events-none absolute bottom-1 h-0.5 rounded-full bg-gradient-to-r from-teal-400 to-cyan-400 shadow-[0_0_12px_rgba(45,212,191,0.45)] hidden"
        style={{ left: 0, width: 0 }}
      />
      {tabs.map(({ href, label, icon: Icon, match }) => {
        const active = match(pathname)
        return (
          <motion.div
            key={href}
            whileTap={{ scale: 0.94 }}
            whileHover={{ y: -1.5 }}
          >
            <Link
              href={href}
              className={`nav-tab-link flex flex-col items-center gap-0.5 min-w-[4rem] py-1 rounded-xl transition-colors ${
                active ? 'text-teal-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <span className="nav-tab-icon inline-flex">
                <Icon size={22} strokeWidth={active ? 2.25 : 1.75} />
              </span>
              <span className="text-[9px] font-semibold tracking-wide uppercase">{label}</span>
            </Link>
          </motion.div>
        )
      })}
    </motion.nav>
  )

  return createPortal(nav, document.body)
}
