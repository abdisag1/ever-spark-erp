'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { Avatar } from '@/components/ui/avatar'
import { Modal } from '@/components/ui/modal'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  CheckCircle2, XCircle, Clock, AlertTriangle, Users,
  Calendar, TrendingUp, ChevronDown, ChevronUp,
  Paperclip, ExternalLink, History,
} from 'lucide-react'
import type { LeaveRequest, LeaveBalance, Profile } from '@/types'

const LEAVE_COLOR: Record<string, string> = {
  annual: 'bg-blue-100 text-blue-700', sick: 'bg-red-100 text-red-700',
  emergency: 'bg-orange-100 text-orange-700', maternity: 'bg-pink-100 text-pink-700',
  paternity: 'bg-purple-100 text-purple-700', unpaid: 'bg-slate-100 text-slate-600',
}
const STATUS_STYLE: Record<string, string> = {
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  pending:  'bg-amber-100 text-amber-700',
}
const TOTAL_WORKING_DAYS = 260

interface ConflictEmp { name: string; start_date: string; end_date: string }

function AttachmentLink({ url, name }: { url: string | null; name: string | null }) {
  if (!url) return null
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors mt-1">
      <Paperclip className="w-3 h-3" />
      {name ?? 'View form'}
      <ExternalLink className="w-3 h-3" />
    </a>
  )
}

interface AdminProps {
  requests: LeaveRequest[]
  balances: LeaveBalance[]
  employees: Profile[]
}

export function LeaveAdminDashboard({ requests: init, balances: initBal, employees }: AdminProps) {
  const [requests,    setRequests]    = useState<LeaveRequest[]>(init)
  const [balances,    setBalances]    = useState<LeaveBalance[]>(initBal)
  const [adminNotes,  setAdminNotes]  = useState<Record<string, string>>({})
  const [processing,  setProcessing]  = useState<string | null>(null)
  const [conflicts,   setConflicts]   = useState<Record<string, ConflictEmp[]>>({})
  const [expandedReq, setExpandedReq] = useState<string | null>(null)
  const [historyEmployee, setHistoryEmployee] = useState<Profile | null>(null)

  const pending  = requests.filter((r) => r.status === 'pending')
  const year     = new Date().getFullYear()

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
      setConflicts((p) => ({ ...p, [req.id]: data.map((c) => ({ name: c.employee?.name ?? '?', start_date: c.start_date, end_date: c.end_date })) }))
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
      setRequests((prev) => prev.map((r) => r.id === updated.id ? { ...r, ...updated } : r))
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
    approvedThisYear: requests.filter((r) => r.status === 'approved' && r.start_date.startsWith(String(year))).length,
    avgDaysTaken: employees.length > 0
      ? Math.round(balances.filter((b) => b.year === year).reduce((s, b) => s + b.days_taken, 0) / employees.length)
      : 0,
  }), [employees, pending, requests, balances, year])

  const historyRequests = historyEmployee
    ? requests.filter((r) => r.employee_id === historyEmployee.id)
    : []

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Employees',      value: stats.totalEmployees,   icon: Users,        color: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'Pending Requests',     value: stats.pending,          icon: Clock,        color: 'text-amber-600',  bg: 'bg-amber-50' },
          { label: 'Approved (this year)', value: stats.approvedThisYear, icon: CheckCircle2, color: 'text-green-600',  bg: 'bg-green-50' },
          { label: 'Avg Days Taken',       value: stats.avgDaysTaken,     icon: Calendar,     color: 'text-purple-600', bg: 'bg-purple-50' },
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
              const expanded  = expandedReq === req.id
              const reqConflicts = conflicts[req.id] ?? []
              return (
                <div key={req.id} className="p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <Avatar name={req.employee?.name ?? '?'} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{req.employee?.name}</p>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', LEAVE_COLOR[req.leave_type])}>{req.leave_type}</span>
                        <span className="text-xs text-slate-500">
                          {format(new Date(req.start_date), 'MMM d')} – {format(new Date(req.end_date), 'MMM d, yyyy')}
                          {' · '}{req.days_requested} day{req.days_requested !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {req.reason && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{req.reason}</p>}
                      <p className="text-xs text-slate-400 mt-0.5">Balance: {remaining} of {bal.total_days} days remaining</p>
                      <AttachmentLink url={req.attachment_url} name={req.attachment_name} />

                      {/* Conflict warning */}
                      {reqConflicts.length > 0 && (
                        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-800">
                            <strong>Conflict:</strong>{' '}
                            {reqConflicts.map((c, i) => (
                              <span key={i}>{c.name} off {format(new Date(c.start_date), 'MMM d')}–{format(new Date(c.end_date), 'MMM d')}{i < reqConflicts.length - 1 ? ', ' : ''}</span>
                            ))}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => { setExpandedReq(expanded ? null : req.id); checkConflicts(req) }}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
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

      {/* Employee Summary Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-900">Employee Leave Summary — {year}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {['Employee', 'Role', 'Annual', 'Taken', 'Remaining', 'Efficiency', 'Forms', 'History'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map((emp) => {
                const bal = getBalance(emp.id)
                const remaining  = bal.total_days - bal.days_taken
                const efficiency = Math.round(((TOTAL_WORKING_DAYS - bal.days_taken) / TOTAL_WORKING_DAYS) * 100)
                const empRequests = requests.filter((r) => r.employee_id === emp.id)
                const formsCount = empRequests.filter((r) => r.attachment_url).length
                return (
                  <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={emp.name} size="sm" />
                        <span className="font-medium text-slate-900 text-xs">{emp.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 capitalize whitespace-nowrap">{emp.role.replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-xs text-slate-700">{bal.total_days}d</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-700">{bal.days_taken}</span>
                        <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, (bal.days_taken / bal.total_days) * 100)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-semibold', remaining <= 5 ? 'text-red-600' : remaining <= 10 ? 'text-amber-600' : 'text-green-600')}>
                        {remaining}d
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-semibold', efficiency >= 95 ? 'text-green-600' : efficiency >= 85 ? 'text-blue-600' : 'text-amber-600')}>
                        {efficiency}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {formsCount > 0 ? (
                        <span className="flex items-center gap-1 text-xs text-blue-600">
                          <Paperclip className="w-3 h-3" /> {formsCount}
                        </span>
                      ) : <span className="text-xs text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setHistoryEmployee(emp)}
                        className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-blue-600 transition-colors"
                      >
                        <History className="w-3.5 h-3.5" /> View
                      </button>
                    </td>
                  </tr>
                )
              })}
              {employees.length === 0 && (
                <tr><td colSpan={8} className="text-center py-8 text-xs text-slate-400">No employees found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Employee History Modal ── */}
      <Modal
        open={!!historyEmployee}
        onClose={() => setHistoryEmployee(null)}
        title={`Leave History — ${historyEmployee?.name ?? ''}`}
        size="lg"
      >
        <div className="p-5 space-y-3 overflow-y-auto max-h-[60vh]">
          {historyRequests.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No leave requests on record.</p>
          ) : (
            historyRequests.map((r) => (
              <div key={r.id} className="flex flex-wrap items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', LEAVE_COLOR[r.leave_type])}>{r.leave_type}</span>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_STYLE[r.status])}>{r.status}</span>
                    <span className="text-xs text-slate-500">
                      {format(new Date(r.start_date), 'MMM d')} – {format(new Date(r.end_date), 'MMM d, yyyy')}
                      {' · '}{r.days_requested} day{r.days_requested !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {r.reason && <p className="text-xs text-slate-600">{r.reason}</p>}
                  {r.admin_note && <p className="text-xs text-slate-400 italic">Admin note: {r.admin_note}</p>}
                  <AttachmentLink url={r.attachment_url} name={r.attachment_name} />
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap">
                  {format(new Date(r.created_at), 'MMM d, yyyy')}
                </span>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  )
}
