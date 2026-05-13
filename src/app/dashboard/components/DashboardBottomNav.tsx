'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Globe, BarChart2, MapPinned, User, Play } from 'lucide-react'
import { animate, gentlePulse } from '@/lib/animeUi'
import { useLocale } from '@/lib/i18n/LocaleProvider'
import { recordScreenPathWithEntry } from '@/lib/recordScreenEntry'
import { EntryChoiceModal } from '@/app/dashboard/routes/record/components/EntryChoiceModal'

/** Z-index del nav fijo (portal). Los CTA fijos encima del nav deben usar un valor mayor. */
export const DASHBOARD_BOTTOM_NAV_Z_INDEX = 2147483000

/** `id` del `<nav>` en el DOM (portal). Permite medir altura real para overlays tipo mapa a pantalla completa. */
export const DASHBOARD_BOTTOM_NAV_DOM_ID = 'dashboard-bottom-nav'

export function DashboardBottomNav() {
  const { messages } = useLocale()
  const router = useRouter()
  const [recordChoiceOpen, setRecordChoiceOpen] = useState(false)
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
  const navRef = useRef<HTMLDivElement>(null)
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

  const renderTab = (
    href: string,
    label: string,
    Icon: (typeof tabs)[number]['icon'],
    active: boolean
  ) => (
    <motion.div key={href} whileTap={{ scale: 0.94 }} whileHover={{ y: -1.5 }} className="flex justify-center">
      <Link
        href={href}
        className={`nav-tab-link flex flex-col items-center gap-0.5 min-w-0 max-w-[5rem] py-1 rounded-xl transition-colors ${
          active ? 'text-teal-400' : 'text-slate-500 hover:text-slate-300'
        }`}
      >
        <span className="nav-tab-icon inline-flex">
          <Icon size={22} strokeWidth={active ? 2.25 : 1.75} />
        </span>
        <span className="text-[9px] font-semibold tracking-wide uppercase truncate w-full text-center px-0.5">
          {label}
        </span>
      </Link>
    </motion.div>
  )

  const nav = (
    <motion.nav
      id={DASHBOARD_BOTTOM_NAV_DOM_ID}
      className="bg-gdh-card/95 backdrop-blur-md border-t border-white/5 pt-1 pb-2 flex flex-col items-center relative"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: DASHBOARD_BOTTOM_NAV_Z_INDEX,
        paddingBottom: 'max(env(safe-area-inset-bottom), 8px)',
      }}
      initial={{ y: 18, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <div
        ref={navRef}
        className="relative grid w-full max-w-lg grid-cols-5 items-end gap-0.5 px-1"
      >
        <div
          ref={indicatorRef}
          className="pointer-events-none absolute bottom-1 h-0.5 rounded-full bg-gradient-to-r from-teal-400 to-cyan-400 shadow-[0_0_12px_rgba(45,212,191,0.45)] hidden"
          style={{ left: 0, width: 0 }}
        />
        {renderTab(tabs[0].href, tabs[0].label, tabs[0].icon, tabs[0].match(pathname))}
        {renderTab(tabs[1].href, tabs[1].label, tabs[1].icon, tabs[1].match(pathname))}

        <div className="flex flex-col items-center justify-end pb-0.5 min-h-[3.25rem]">
          <motion.button
            type="button"
            aria-label={messages.nav.recordFabAria}
            whileTap={{ scale: 0.92 }}
            whileHover={{ y: -2 }}
            onClick={() => setRecordChoiceOpen(true)}
            className="-mt-7 mb-0.5 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gdh-brand to-teal-600 text-white shadow-lg shadow-teal-950/50 ring-2 ring-white/25 ring-offset-2 ring-offset-[#14181f]"
          >
            <Play className="h-7 w-7 translate-x-0.5" fill="currentColor" strokeWidth={0} aria-hidden />
          </motion.button>
          <span className="text-[9px] font-semibold tracking-wide uppercase text-teal-300/90">
            {messages.nav.recordFab}
          </span>
        </div>

        {renderTab(tabs[2].href, tabs[2].label, tabs[2].icon, tabs[2].match(pathname))}
        {renderTab(tabs[3].href, tabs[3].label, tabs[3].icon, tabs[3].match(pathname))}
      </div>
    </motion.nav>
  )

  return (
    <>
      {createPortal(nav, document.body)}
      <EntryChoiceModal
        open={recordChoiceOpen}
        overlayZIndex={DASHBOARD_BOTTOM_NAV_Z_INDEX + 120}
        onClose={() => setRecordChoiceOpen(false)}
        onNuevaRutaLibre={() => {
          setRecordChoiceOpen(false)
          router.push(recordScreenPathWithEntry('free'))
        }}
        onNewRoute={() => {
          setRecordChoiceOpen(false)
          router.push(recordScreenPathWithEntry('new'))
        }}
        onSelectExisting={() => {
          setRecordChoiceOpen(false)
          router.push(recordScreenPathWithEntry('existing'))
        }}
      />
    </>
  )
}
