'use client'

import { useState, useEffect } from 'react'
import { User, Bell, Users, X, Shield, UserCheck, Pencil, Palette } from 'lucide-react'
import { useTheme, THEMES } from '@/components/ThemeProvider'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'

type Tab = 'profile' | 'notifications' | 'appearance' | 'team'

interface UserProfile {
  id: string
  name: string
  email: string
  role: string
  status: string
  notify_task_assigned: boolean
  notify_task_due: boolean
}

interface TeamMember {
  id: string
  name: string
  role: string
  status: string
  created_at: string
}

const ROLE_LABELS: Record<string, string> = {
  admin:          'Admin',
  operations:     'Operations',
  finance:        'Finance',
  sales_marketing:'Sales & Marketing',
}

const ROLE_COLOR: Record<string, string> = {
  admin:          'bg-purple-100 text-purple-700',
  operations:     'bg-blue-100 text-blue-700',
  finance:        'bg-amber-100 text-amber-700',
  sales_marketing:'bg-green-100 text-green-700',
}

const STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
  disabled: 'bg-red-100 text-red-700',
}

interface SettingsPanelProps {
  profile: UserProfile
  isAdmin: boolean
}

export function SettingsPanel({ profile, isAdmin }: SettingsPanelProps) {
  const [tab, setTab] = useState<Tab>('profile')
  const { theme, setTheme } = useTheme()

  // Profile state
  const [name, setName] = useState(profile.name)
  const [savingProfile, setSavingProfile] = useState(false)

  // Notification state
  const [notifyAssigned, setNotifyAssigned] = useState(profile.notify_task_assigned)
  const [notifyDue, setNotifyDue] = useState(profile.notify_task_due)
  const [savingNotif, setSavingNotif] = useState(false)

  // Team state
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loadingTeam, setLoadingTeam] = useState(false)
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [editRole, setEditRole] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    if (tab === 'team' && isAdmin && !teamMembers.length) {
      setLoadingTeam(true)
      fetch('/api/settings/users')
        .then((r) => r.json())
        .then((d) => { setTeamMembers(d); setLoadingTeam(false) })
        .catch(() => setLoadingTeam(false))
    }
  }, [tab, isAdmin])

  async function saveProfile() {
    if (!name.trim()) { toast.error('Name is required'); return }
    setSavingProfile(true)
    const res = await fetch('/api/settings/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (res.ok) toast.success('Profile updated')
    else toast.error('Failed to update profile')
    setSavingProfile(false)
  }

  async function saveNotifications() {
    setSavingNotif(true)
    const res = await fetch('/api/settings/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notify_task_assigned: notifyAssigned, notify_task_due: notifyDue }),
    })
    if (res.ok) toast.success('Notification preferences saved')
    else toast.error('Failed to save preferences')
    setSavingNotif(false)
  }

  function openEdit(member: TeamMember) {
    setEditingMember(member)
    setEditRole(member.role)
    setEditStatus(member.status)
  }

  async function saveEdit() {
    if (!editingMember) return
    setSavingEdit(true)
    const res = await fetch(`/api/settings/users/${editingMember.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: editRole, status: editStatus }),
    })
    if (res.ok) {
      const updated: TeamMember = await res.json()
      setTeamMembers((prev) => prev.map((m) => m.id === updated.id ? updated : m))
      setEditingMember(null)
      if (editStatus === 'active' && editingMember.status === 'pending') {
        toast.success(`${editingMember.name} approved and notified`)
      } else {
        toast.success('User updated')
      }
    } else {
      const b = await res.json().catch(() => ({}))
      toast.error(b?.error ?? 'Failed to update user')
    }
    setSavingEdit(false)
  }

  async function quickApprove(member: TeamMember, role: string) {
    const res = await fetch(`/api/settings/users/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, status: 'active' }),
    })
    if (res.ok) {
      const updated: TeamMember = await res.json()
      setTeamMembers((prev) => prev.map((m) => m.id === updated.id ? updated : m))
      toast.success(`${member.name} approved as ${ROLE_LABELS[role]}`)
    } else {
      const b = await res.json().catch(() => ({}))
      toast.error(b?.error ?? 'Failed to approve user')
    }
  }

  async function rejectUser(member: TeamMember) {
    const res = await fetch(`/api/settings/users/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'disabled' }),
    })
    if (res.ok) {
      setTeamMembers((prev) => prev.map((m) => m.id === member.id ? { ...m, status: 'disabled' } : m))
      toast.success('User rejected')
    } else {
      toast.error('Failed to reject user')
    }
  }

  const pending  = teamMembers.filter((m) => m.status === 'pending')
  const active   = teamMembers.filter((m) => m.status === 'active')
  const disabled = teamMembers.filter((m) => m.status === 'disabled')

  const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const selectCls = `${inputCls} bg-white`

  const TABS: { key: Tab; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
    { key: 'profile',       label: 'Profile',       icon: User },
    { key: 'notifications', label: 'Notifications',  icon: Bell },
    { key: 'appearance',    label: 'Appearance',    icon: Palette },
    { key: 'team',          label: 'Team',           icon: Users, adminOnly: true },
  ]

  return (
    <div className="flex gap-6 flex-col md:flex-row">
      {/* Sidebar tabs */}
      <div className="md:w-48 shrink-0">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {TABS.filter((t) => !t.adminOnly || isAdmin).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'w-full flex items-center gap-2.5 px-4 py-3 text-sm font-medium transition-colors text-left border-b border-slate-100 last:border-0',
                tab === key ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
              {key === 'team' && pending.length > 0 && (
                <span className="ml-auto text-xs font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                  {pending.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1">

        {/* ── Profile tab ── */}
        {tab === 'profile' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
            <h2 className="text-sm font-semibold text-slate-900">Profile Information</h2>

            {/* Avatar preview */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-bold">
                {name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">{name}</p>
                <p className="text-xs text-slate-400 capitalize">{ROLE_LABELS[profile.role] ?? profile.role}</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Full Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
              <input value={profile.email} readOnly className={`${inputCls} bg-slate-50 text-slate-400 cursor-not-allowed`} />
              <p className="text-xs text-slate-400 mt-1">Email cannot be changed here.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
              <div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', ROLE_COLOR[profile.role])}>
                <Shield className="w-3 h-3" />
                {ROLE_LABELS[profile.role] ?? profile.role}
              </div>
              <p className="text-xs text-slate-400 mt-1">Contact an administrator to change your role.</p>
            </div>
            <div className="pt-2">
              <Button onClick={saveProfile} disabled={savingProfile}>
                {savingProfile ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </div>
        )}

        {/* ── Notifications tab ── */}
        {tab === 'notifications' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
            <h2 className="text-sm font-semibold text-slate-900">Notification Preferences</h2>
            <p className="text-xs text-slate-500">Choose which in-app notifications you want to receive.</p>

            {[
              { key: 'assigned', label: 'Task assigned', desc: 'When a task is assigned to you', value: notifyAssigned, onChange: setNotifyAssigned },
              { key: 'due',      label: 'Task due / overdue', desc: 'When a task assigned to you is due today or is overdue', value: notifyDue, onChange: setNotifyDue },
            ].map(({ key, label, desc, value, onChange }) => (
              <div key={key} className="flex items-center justify-between gap-4 py-3 border-b border-slate-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-800">{label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                </div>
                <button
                  onClick={() => onChange(!value)}
                  className={cn(
                    'relative w-11 h-6 rounded-full transition-colors shrink-0',
                    value ? 'bg-blue-600' : 'bg-slate-200'
                  )}
                >
                  <span className={cn(
                    'absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform',
                    value ? 'translate-x-6' : 'translate-x-1'
                  )} />
                </button>
              </div>
            ))}

            <Button onClick={saveNotifications} disabled={savingNotif}>
              {savingNotif ? 'Saving…' : 'Save preferences'}
            </Button>
          </div>
        )}

        {/* ── Appearance tab ── */}
        {tab === 'appearance' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
            <h2 className="text-sm font-semibold text-slate-900">Colour Theme</h2>
            <p className="text-xs text-slate-500">
              Choose the colour palette that best fits your preference. The change applies immediately and is saved to this browser.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {THEMES.map((t) => {
                const active = theme === t.id
                const isDark = t.id === 'dark'
                return (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={cn(
                      'relative text-left rounded-xl border-2 overflow-hidden transition-all',
                      active ? 'border-blue-500 shadow-md ring-2 ring-blue-200' : 'border-slate-200 hover:border-slate-300'
                    )}
                  >
                    {/* Colour preview */}
                    {isDark ? (
                      <div className="h-16 flex">
                        <div className="w-1/3" style={{ background: '#020617' }} />
                        <div className="w-1/3" style={{ background: '#1e293b' }} />
                        <div className="w-1/3" style={{ background: '#38bdf8' }} />
                      </div>
                    ) : (
                      <div className="h-16 flex">
                        <div className="w-1/3" style={{ background: t.sidebar }} />
                        <div className="w-1/3" style={{ background: t.primary }} />
                        <div className="w-1/3" style={{ background: t.accent }} />
                      </div>
                    )}
                    {/* Label */}
                    <div className="px-3 py-2.5 bg-white">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-semibold text-slate-900">{t.label}</p>
                        {active && (
                          <span className="text-xs font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full shrink-0">
                            ✓
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 leading-tight">{t.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Team tab (admin only) ── */}
        {tab === 'team' && isAdmin && (
          <div className="space-y-4">

            {/* Pending approvals */}
            {pending.length > 0 && (
              <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
                <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-amber-600" />
                  <h3 className="text-sm font-semibold text-amber-800">
                    Pending Approval ({pending.length})
                  </h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {pending.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 px-5 py-4">
                      <Avatar name={m.name} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900">{m.name}</p>
                        <p className="text-xs text-slate-400">Awaiting approval</p>
                      </div>
                      {/* Quick approve buttons */}
                      <div className="flex items-center gap-1.5">
                        {Object.entries(ROLE_LABELS).map(([role, label]) => (
                          <button
                            key={role}
                            onClick={() => quickApprove(m, role)}
                            className="text-xs px-2 py-1 bg-slate-100 hover:bg-blue-100 hover:text-blue-700 text-slate-600 rounded-lg transition-colors font-medium"
                          >
                            {label}
                          </button>
                        ))}
                        <button
                          onClick={() => rejectUser(m)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                          title="Reject"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active users */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-900">Team Members ({active.length})</h3>
              </div>
              {loadingTeam && <p className="text-xs text-slate-400 text-center py-6">Loading…</p>}
              <div className="divide-y divide-slate-100">
                {active.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                    <Avatar name={m.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{m.name}</p>
                    </div>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', ROLE_COLOR[m.role])}>
                      {ROLE_LABELS[m.role] ?? m.role}
                    </span>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_COLOR[m.status])}>
                      {m.status}
                    </span>
                    <button onClick={() => openEdit(m)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Disabled users */}
            {disabled.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-500">Disabled ({disabled.length})</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {disabled.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 px-5 py-3 opacity-60">
                      <Avatar name={m.name} size="sm" />
                      <p className="text-sm text-slate-600 flex-1">{m.name}</p>
                      <button onClick={() => openEdit(m)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit user modal */}
      <Modal open={!!editingMember} onClose={() => setEditingMember(null)} title={`Edit — ${editingMember?.name}`} size="sm">
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
            <select value={editRole} onChange={(e) => setEditRole(e.target.value)} className={selectCls}>
              <option value="admin">Admin</option>
              <option value="operations">Operations</option>
              <option value="finance">Finance</option>
              <option value="sales_marketing">Sales &amp; Marketing</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
            <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className={selectCls}>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
          {editStatus === 'active' && editingMember?.status === 'pending' && (
            <p className="text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2">
              This user will be notified that their account has been approved.
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setEditingMember(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={savingEdit}>{savingEdit ? 'Saving…' : 'Save'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
