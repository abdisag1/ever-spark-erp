'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  CheckCircle2, XCircle, Clock, AlertTriangle, Users,
  Calendar, TrendingUp, ChevronDown, ChevronUp,
} from 'lucide-react'
import type { LeaveRequest, LeaveBalance, Profile } from '@/types'

const LEAVE_COLOR: Record<string, string> = {
  annual: 'bg-blue-100 text-blue-700',
  sick: 'bg-red-100 text-red-700',
  emergency: 'bg-orange-100 text-orange-700',
  maternity: 'bg-pink-100 text-pink-700',
  paternity: 'bg-purple-100 text-purple-700',
  unpaid: 'bg-slate-100 text-slate-600',
}

const TOTAL_WORKING_DAYS = 260

interface ConflictEmployee { name: string; start_date: string; end_date: string }

function ConflictWarning({ conflicts }: { conflicts: ConflictEmployee[] }) {
  if (!conflicts.length) return null
  return (
    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
      <div className="text-xs text-amber-800">
        <strong>Conflict:</strong>{' '}
        {conflicts.map((c, i) => (
          <span key={i}>{c.name} is off {format(new Date(c.start_date), 'MMM d')}–{format(new Date(c.end_date), 'MMM d')}{i < conflicts.length - 1 ? ', ' : ''}</span>
        ))}
      </div>
    </div>
  )
}

interface AdminProps {
  requests: LeaveRequest[]
  balances: LeaveBalance[]
  employees: Profile[]
}

export function LeaveAdminDashboard({ requests: initialRequests, balances: initialBalances, employees }: AdminProps) {
  const [requests, setRequests] = useState<LeaveRequest[]>(initialRequests)
  const [balances, setBalances] = useState<LeaveBalance[]>(initialBalances)
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({})
  const [processing, setProcessing] = useState<string | null>(null)
  const [conflicts, setConflicts] = useState<Record<string, ConflictEmployee[]>>({})
  const [expandedReq, setExpandedReq] = useState<string | null>(null)

  const pending  = requests.filter((r) => r.status === 'pending')
  const approved = requests.filter((r) => r.status === 'approved')
  const year = new Date().getFullYear()

  // Check conflicts for a request
  async function checkConflicts(req: LeaveRequest) {
    if (conflicts[req.id] !== undefined) return
    const res = await fetch('/api/leave/conflicts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start_date: req.start_date, end_date: req.end_date, exclude_request_id: req.id }),
    })
    if (res.ok) {
      const data: LeaveRequest[] = await res.json()
      setConflicts((prev) => ({
        ...prev,
        [req.id]: data.map((c) => ({ name: c.employee?.name ?? '?', start_date: c.start_date, end_date: c.end_date })),
      }))
    }
  }

  async function handleDecision(req: LeaveRequest, status: 'approved' | 'rejected') {
    setProcessing(req.id)
    const res = await fetch(`/api/leave/requests/${req.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, admin_note: adminNotes[req.id] || null }),
    })
    if (res.ok) {
      const updated: LeaveRequest = await res.json()
      setRequests((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)))
      if (status === 'approved') {
        setBalances((prev) => prev.map((b) =>
          b.employee_id === req.employee_id && b.year === year
            ? { ...b, days_taken: b.days_taken + req.days_requested }
            : b
        ))
      }
      toast.success(status === 'approved' ? 'Leave approved' : 'Leave rejected')
    } else {
      const b = await res.json().catch(() => ({}))
      toast.error(b?.error ?? 'Failed to process request')
    }
    setProcessing(null)
  }

  function getBalance(employeeId: string) {
    return balances.find((b) => b.employee_id === employeeId && b.year === year) ?? { total_days: 20, days_taken: 0 }
  }

  const stats = useMemo(() => ({
    totalEmployees: employees.length,
    pending: pending.length,
    approvedThisYear: approved.filter((r) => r.start_date.startsWith(String(year))).length,
    avgDaysTaken: employees.length > 0
      ? Math.round(balances.filter((b) => b.year === year).reduce((s, b) => s + b.days_taken, 0) / employees.length)
      : 0,
  }), [employees, pending, approved, balances, year])

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Employees', value: stats.totalEmployees, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Pending Requests', value: stats.pending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Approved (this year)', value: stats.approvedThisYear, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Avg Days Taken', value: stats.avgDaysTaken, icon: Calendar, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500">{s.label}</span>
              <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', s.bg)}>
                <s.icon className={cn('w-4 h-4', s.color)} />
              </div>
            </div>
            <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Pending Requests */}
      {pending.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
          <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <h2 className="text-sm font-semibold text-amber-800">Pending Approval ({pending.length})</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {pending.map((req) => {
              const bal = getBalance(req.employee_id)
              const remaining = bal.total_days - bal.days_taken
              const expanded = expandedReq === req.id
              return (
                <div key={req.id} className="p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <Avatar name={req.employee?.name ?? '?'} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{req.employee?.name}</p>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', LEAVE_COLOR[req.leave_type])}>
                          {req.leave_type}
                        </span>
                        <span className="text-xs text-slate-500">
                          {format(new Date(req.start_date), 'MMM d')} – {format(new Date(req.end_date), 'MMM d, yyyy')}
                          {' '}· {req.days_requested} day{req.days_requested !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {req.reason && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{req.reason}</p>}
                      <p className="text-xs text-slate-400 mt-0.5">
                        Balance: {remaining} of {bal.total_days} days remaining
                      </p>

                      {/* Conflict warning */}
                      {conflicts[req.id] && <ConflictWarning conflicts={conflicts[req.id]} />}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => { setExpandedReq(expanded ? null : req.id); checkConflicts(req) }}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
                        title="Add note"
                      >
                        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDecision(req, 'rejected')}
                        disabled={processing === req.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                      <button
                        onClick={() => handleDecision(req, 'approved')}
                        disabled={processing === req.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-colors disabled:opacity-50"
                        style={{ background: 'var(--color-primary)' }}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                      </button>
                    </div>
                  </div>

                  {/* Expanded: admin note */}
                  {expanded && (
                    <div className="mt-3 pl-9">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Admin note (optional)</label>
                      <textarea
                        rows={2}
                        value={adminNotes[req.id] ?? ''}
                        onChange={(e) => setAdminNotes((p) => ({ ...p, [req.id]: e.target.value }))}
                        placeholder="Add a note for the employee…"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Employee Summary */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-900">Employee Leave Summary — {year}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {['Employee', 'Role', 'Annual Balance', 'Days Taken', 'Remaining', 'Efficiency', 'Status'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map((emp) => {
                const bal = getBalance(emp.id)
                const remaining = bal.total_days - bal.days_taken
                const efficiency = Math.round(((TOTAL_WORKING_DAYS - bal.days_taken) / TOTAL_WORKING_DAYS) * 100)
                const hasPending = pending.some((r) => r.employee_id === emp.id)
                return (
                  <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={emp.name} size="sm" />
                        <span className="font-medium text-slate-900 text-xs">{emp.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 capitalize whitespace-nowrap">{emp.role.replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-xs text-slate-700">{bal.total_days} days</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-700">{bal.days_taken}</span>
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, (bal.days_taken / bal.total_days) * 100)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-semibold', remaining <= 5 ? 'text-red-600' : remaining <= 10 ? 'text-amber-600' : 'text-green-600')}>
                        {remaining} days
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-semibold', efficiency >= 95 ? 'text-green-600' : efficiency >= 85 ? 'text-blue-600' : 'text-amber-600')}>
                        {efficiency}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {hasPending ? (
                        <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">Pending</span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {employees.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-xs text-slate-400">No employees found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
