'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, Users, CheckSquare, BarChart2,
  Share2, MessageSquare, Calendar, LogOut, Settings,
} from 'lucide-react'
import { NotificationBell } from '@/components/notifications/NotificationBell'

const navItems = [
  { href: '/dashboard',          label: 'Dashboard',     icon: LayoutDashboard,  roles: null },
  { href: '/dashboard/leads',    label: 'Sales Funnel',  icon: Users,            roles: null },
  { href: '/dashboard/tasks',    label: 'Tasks',         icon: CheckSquare,      roles: null },
  { href: '/dashboard/kpi',      label: 'KPIs',          icon: BarChart2,        roles: null },
  { href: '/dashboard/social',   label: 'Social',        icon: Share2,           roles: null },
  { href: '/dashboard/sms',      label: 'Communication', icon: MessageSquare,    roles: ['admin', 'sales_marketing'] },
  { href: '/dashboard/calendar', label: 'Calendar',      icon: Calendar,         roles: null },
  { href: '/dashboard/settings', label: 'Settings',      icon: Settings,         roles: null },
]

interface SidebarProps {
  userName: string
  userRole: string
  userId: string
}

/** Ever Spark infinity-leaf logo mark */
function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size * 0.58}
      viewBox="0 0 52 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M26 15
           C21 8 13 4 7 8
           C1 12 2 22 9 25
           C16 28 23 21 26 15
           C29 9 37 4 43 7
           C49 10 50 20 44 24
           C38 28 30 21 26 15Z"
        stroke="var(--color-primary)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Sidebar({ userName, userRole, userId }: SidebarProps) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside
      className="w-60 shrink-0 flex flex-col h-screen sticky top-0"
      style={{ background: 'var(--sidebar-bg)', borderRight: '1px solid var(--sidebar-border)' }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-2.5 px-5 py-4"
        style={{ borderBottom: '1px solid var(--sidebar-border)' }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(255,255,255,0.12)' }}
        >
          <LogoMark size={30} />
        </div>
        <div className="leading-tight">
          <p className="text-[11px] font-medium" style={{ color: 'var(--sidebar-text)' }}>
            Ever Spark Tech
          </p>
          <p className="text-sm font-bold text-white tracking-wide">ERP</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems
          .filter(({ roles }) => !roles || roles.includes(userRole))
          .map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                )}
                style={
                  active
                    ? { background: 'var(--sidebar-active)', color: 'var(--sidebar-text-active)' }
                    : undefined
                }
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
                <Icon
                  className="w-4 h-4 shrink-0"
                  style={{ color: active ? '#fff' : 'var(--sidebar-text)' }}
                />
                <span style={{ color: active ? '#fff' : 'var(--sidebar-text)' }}>
                  {label}
                </span>
              </Link>
            )
          })}
      </nav>

      {/* User */}
      <div
        className="px-3 pb-4 pt-3"
        style={{ borderTop: '1px solid var(--sidebar-border)' }}
      >
        <div className="flex items-center gap-2 px-2 mb-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
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
          <NotificationBell userId={userId} />
        </div>

        <button
          onClick={signOut}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors"
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
  )
}
