'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, Users, CheckSquare, BarChart2,
  Share2, MessageSquare, Calendar, LogOut, Settings,
  Menu, X, Umbrella, Wallet,
} from 'lucide-react'
import { NotificationBell } from '@/components/notifications/NotificationBell'
// NotificationBell reads from NotificationProvider context — no userId prop needed

const navItems = [
  { href: '/dashboard',          label: 'Dashboard',     icon: LayoutDashboard,  roles: null },
  { href: '/dashboard/leads',    label: 'Sales Funnel',  icon: Users,            roles: null },
  { href: '/dashboard/tasks',    label: 'Tasks',         icon: CheckSquare,      roles: null },
  { href: '/dashboard/kpi',      label: 'KPIs',          icon: BarChart2,        roles: null },
  { href: '/dashboard/social',   label: 'Social',        icon: Share2,           roles: null },
  { href: '/dashboard/sms',      label: 'Communication', icon: MessageSquare,    roles: ['admin', 'sales_marketing'] },
  { href: '/dashboard/calendar', label: 'Calendar',      icon: Calendar,         roles: null },
  { href: '/dashboard/leave',    label: 'Leave',         icon: Umbrella,         roles: null },
  { href: '/dashboard/finance',  label: 'Finance',       icon: Wallet,           roles: ['admin', 'finance', 'operations'] },
  { href: '/dashboard/settings', label: 'Settings',      icon: Settings,         roles: null },
]

function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.58} viewBox="0 0 52 30" fill="none" aria-hidden>
      <path
        d="M26 15 C21 8 13 4 7 8 C1 12 2 22 9 25 C16 28 23 21 26 15 C29 9 37 4 43 7 C49 10 50 20 44 24 C38 28 30 21 26 15Z"
        stroke="var(--color-primary)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  )
}

interface SidebarProps {
  userName: string
  userRole: string
  userId: string
}

export function Sidebar({ userName, userRole, userId }: SidebarProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  // Close drawer on navigation
  useEffect(() => { setOpen(false) }, [pathname])

  // Lock body scroll when drawer is open on mobile
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const visibleNav = navItems.filter(({ roles }) => !roles || roles.includes(userRole))

  return (
    <>
      {/* ── Mobile top bar (hidden on desktop) ─────────────────────── */}
      <div
        className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-14 shrink-0"
        style={{ background: 'var(--sidebar-bg)', borderBottom: '1px solid var(--sidebar-border)' }}
      >
        <button
          onClick={() => setOpen(true)}
          className="p-2 rounded-lg transition-colors"
          style={{ color: 'var(--sidebar-text)' }}
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Centre logo */}
        <div className="flex items-center gap-2">
          <LogoMark size={26} />
          <div className="leading-tight">
            <p className="text-[10px] font-medium" style={{ color: 'var(--sidebar-text)' }}>Ever Spark Tech</p>
            <p className="text-xs font-bold text-white leading-none">ERP</p>
          </div>
        </div>

        <NotificationBell />
      </div>

      {/* ── Mobile backdrop ─────────────────────────────────────────── */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* ── Sidebar panel ────────────────────────────────────────────── */}
      <aside
        className={cn(
          // Mobile: fixed overlay, slides in/out
          'fixed inset-y-0 left-0 z-50 flex flex-col h-screen w-72 transition-transform duration-300 ease-in-out',
          // Desktop: static sidebar, always visible
          'lg:static lg:w-60 lg:translate-x-0 lg:shrink-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        style={{ background: 'var(--sidebar-bg)', borderRight: '1px solid var(--sidebar-border)' }}
      >
        {/* Logo row */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--sidebar-border)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(255,255,255,0.12)' }}
            >
              <LogoMark size={30} />
            </div>
            <div className="leading-tight">
              <p className="text-[11px] font-medium" style={{ color: 'var(--sidebar-text)' }}>Ever Spark Tech</p>
              <p className="text-sm font-bold text-white tracking-wide">ERP</p>
            </div>
          </div>
          {/* Close button — mobile only */}
          <button
            onClick={() => setOpen(false)}
            className="lg:hidden p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--sidebar-text)' }}
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {visibleNav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-3 py-3 lg:py-2.5 rounded-lg text-sm font-medium transition-colors"
                style={active ? { background: 'var(--sidebar-active)', color: '#fff' } : undefined}
                onMouseEnter={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-hover)'
                    ;(e.currentTarget as HTMLElement).style.color = '#fff'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    ;(e.currentTarget as HTMLElement).style.background = ''
                    ;(e.currentTarget as HTMLElement).style.color = ''
                  }
                }}
              >
                <Icon className="w-5 h-5 lg:w-4 lg:h-4 shrink-0" style={{ color: active ? '#fff' : 'var(--sidebar-text)' }} />
                <span style={{ color: active ? '#fff' : 'var(--sidebar-text)' }}>{label}</span>
              </Link>
            )
          })}
        </nav>

        {/* User row */}
        <div className="px-3 pb-4 pt-3 shrink-0" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
          <div className="flex items-center gap-2 px-2 mb-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ background: 'var(--color-primary)' }}
            >
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{userName}</p>
              <p className="text-xs truncate capitalize" style={{ color: 'var(--sidebar-text)' }}>
                {userRole.replace('_', ' ')}
              </p>
            </div>
            {/* Bell only in desktop sidebar */}
            <div className="hidden lg:block">
              <NotificationBell />
            </div>
          </div>

          <button
            onClick={signOut}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 lg:py-2 rounded-lg text-sm transition-colors"
            style={{ color: 'var(--sidebar-text)' }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.background = 'var(--sidebar-hover)'
              ;(e.currentTarget as HTMLElement).style.color = '#fff'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.background = ''
              ;(e.currentTarget as HTMLElement).style.color = ''
            }}
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  )
}
