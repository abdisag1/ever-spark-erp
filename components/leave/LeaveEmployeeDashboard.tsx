'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isToday, isSameDay, addMonths, subMonths,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, Download, Clock, CheckCircle2, XCircle, CalendarDays } from 'lucide-react'
import { cn, countWorkingDays } from '@/lib/utils'
import { toast } from 'sonner'
import type { LeaveRequest, LeaveBalance } from '@/types'

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: 'Annual', sick: 'Sick', emergency: 'Emergency',
  maternity: 'Maternity', paternity: 'Paternity', unpaid: 'Unpaid',
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const TOTAL_WORKING_DAYS = 260

function isDateInLeave(date: Date, leaves: LeaveRequest[]): LeaveRequest | null {
  const d = format(date, 'yyyy-MM-dd')
  return leaves.find((l) => l.start_date <= d && l.end_date >= d) ?? null
}

interface EmployeeProps {
  requests: LeaveRequest[]
  balance: LeaveBalance
}

export function LeaveEmployeeDashboard({ requests: initialRequests, balance: initialBalance }: EmployeeProps) {
  const [requests, setRequests] = useState<LeaveRequest[]>(initialRequests)
  const [balance, setBalance] = useState<LeaveBalance>(initialBalance)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [formOpen, setFormOpen] = useState(false)

  // Form state
  const [leaveType, setLeaveType] = useState('annual')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const remaining = balance.total_days - balance.days_taken
  const efficiency = Math.round(((TOTAL_WORKING_DAYS - balance.days_taken) / TOTAL_WORKING_DAYS) * 100)

  // Real-time days preview
  const previewDays = useMemo(() => {
    if (startDate && endDate && endDate >= startDate) return countWorkingDays(startDate, endDate)
    return 0
  }, [startDate, endDate])

  const previewRemaining = remaining - (leaveType === 'annual' ? previewDays : 0)

  // Calendar grid
  const monthStart = startOfMonth(currentDate)
  const monthEnd   = endOfMonth(currentDate)
  const calStart   = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd     = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days       = eachDayOfInterval({ start: calStart, end: calEnd })

  const approvedLeaves = requests.filter((r) => r.status === 'approved')
  const pendingLeaves  = requests.filter((r) => r.status === 'pending')

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault()
    if (!startDate || !endDate) { toast.error('Select start and end dates'); return }
    if (endDate < startDate) { toast.error('End date must be after start date'); return }
    if (previewDays === 0) { toast.error('No working days in selected range'); return }
    if (leaveType === 'annual' && previewDays > remaining) {
      toast.error(`Insufficient balance. You have ${remaining} days remaining.`); return
    }

    setSubmitting(true)
    const res = await fetch('/api/leave/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leave_type: leaveType, start_date: startDate, end_date: endDate, reason }),
    })
    if (res.ok) {
      const newReq: LeaveRequest = await res.json()
      setRequests((prev) => [newReq, ...prev])
      setFormOpen(false)
      setLeaveType('annual'); setStartDate(''); setEndDate(''); setReason('')
      toast.success('Leave request submitted — awaiting approval')
    } else {
      const b = await res.json().catch(() => ({}))
      toast.error(b?.error ?? 'Failed to submit request')
    }
    setSubmitting(false)
  }

  function downloadTemplate() {
    window.open('/api/leave/template', '_blank')
  }

  const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="space-y-5">
      {/* Balance + quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Remaining balance */}
        <div className="col-span-2 lg:col-span-1 bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500 mb-1">Days Remaining</p>
          <p className={cn('text-4xl font-bold', remaining <= 5 ? 'text-red-600' : remaining <= 10 ? 'text-amber-600' : 'text-green-600')}>
            {remaining}
          </p>
          <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${Math.max(0, (remaining / balance.total_days) * 100)}%` }} />
          </div>
          <p className="text-xs text-slate-400 mt-1">{balance.days_taken} of {balance.total_days} days used</p>
        </div>

        <div className="bg-blue-50 rounded-xl border border-blue-100 p-4">
          <p className="text-xs font-medium text-blue-600 mb-1">Efficiency</p>
          <p className="text-2xl font-bold text-blue-700">{efficiency}%</p>
          <p className="text-xs text-blue-400 mt-1">{TOTAL_WORKING_DAYS - balance.days_taken}/{TOTAL_WORKING_DAYS} working days</p>
        </div>

        {[
          { label: 'Pending', count: requests.filter((r) => r.status === 'pending').length, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
          { label: 'Approved', count: requests.filter((r) => r.status === 'approved').length, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50 border-green-100' },
        ].map((s) => (
          <div key={s.label} className={cn('rounded-xl border p-4', s.bg)}>
            <p className={cn('text-xs font-medium mb-1', s.color)}>{s.label}</p>
            <p className={cn('text-2xl font-bold', s.color)}>{s.count}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
          style={{ background: 'var(--color-primary)' }}
        >
          <Plus className="w-4 h-4" /> Request Leave
        </button>
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors"
        >
          <Download className="w-4 h-4" /> Download Form Template
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Calendar */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Month nav */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <button onClick={() => setCurrentDate((d) => subMonths(d, 1))} className="p-1.5 rounded hover:bg-slate-100 text-slate-500 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold text-slate-900">{format(currentDate, 'MMMM yyyy')}</span>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Approved</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block" /> Pending</span>
              </div>
            </div>
            <button onClick={() => setCurrentDate((d) => addMonths(d, 1))} className="p-1.5 rounded hover:bg-slate-100 text-slate-500 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
            {DAYS.map((d) => (
              <div key={d} className="py-2 text-center text-xs font-medium text-slate-500">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {days.map((day, idx) => {
              const approved = isDateInLeave(day, approvedLeaves)
              const pending  = isDateInLeave(day, pendingLeaves)
              const isWknd   = idx % 7 >= 5
              const inMonth  = isSameMonth(day, currentDate)
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'min-h-[40px] border-b border-r border-slate-100 flex flex-col items-center pt-1 pb-0.5 relative',
                    !inMonth && 'opacity-30',
                    isWknd && inMonth && 'bg-slate-50/60',
                    approved && 'bg-green-50',
                    pending  && 'bg-amber-50',
                  )}
                >
                  <span className={cn(
                    'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full',
                    isToday(day) && 'bg-blue-600 text-white',
                    !isToday(day) && 'text-slate-700',
                  )}>
                    {format(day, 'd')}
                  </span>
                  {(approved || pending) && (
                    <span className={cn('w-1.5 h-1.5 rounded-full mt-0.5', approved ? 'bg-green-500' : 'bg-amber-400')} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* My Requests */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">My Requests</h3>
          </div>
          <div className="divide-y divide-slate-100 overflow-y-auto max-h-[380px]">
            {requests.length === 0 && <p className="text-xs text-slate-400 text-center py-8">No leave requests yet.</p>}
            {requests.map((r) => (
              <div key={r.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold text-slate-800 capitalize">{LEAVE_TYPE_LABELS[r.leave_type]}</span>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                    r.status === 'approved' ? 'bg-green-100 text-green-700' :
                    r.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  )}>
                    {r.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" />
                  {format(new Date(r.start_date), 'MMM d')} – {format(new Date(r.end_date), 'MMM d, yyyy')}
                  <span className="ml-1 text-slate-400">({r.days_requested}d)</span>
                </p>
                {r.admin_note && (
                  <p className="text-xs text-slate-400 italic mt-1">Note: {r.admin_note}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Request Leave Modal / Slide-up */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setFormOpen(false)} />
          <div className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Request Leave</h2>
              <button onClick={() => setFormOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">✕</button>
            </div>
            <form onSubmit={submitRequest} className="p-5 space-y-4 overflow-y-auto max-h-[80vh]">
              {/* Live balance preview */}
              {startDate && endDate && endDate >= startDate && (
                <div className={cn('flex items-center justify-between text-xs px-3 py-2 rounded-lg font-medium',
                  previewDays > remaining && leaveType === 'annual' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                )}>
                  <span>{previewDays} working day{previewDays !== 1 ? 's' : ''} selected</span>
                  {leaveType === 'annual' && (
                    <span>Balance after: <strong>{previewRemaining}</strong> days</span>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Leave Type *</label>
                <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)} className={cn(inputCls, 'bg-white')}>
                  {Object.entries(LEAVE_TYPE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Start Date *</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} min={format(new Date(), 'yyyy-MM-dd')} required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">End Date *</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} min={startDate || format(new Date(), 'yyyy-MM-dd')} required />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Reason</label>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Brief reason for leave…" className={cn(inputCls, 'resize-none')} />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors" style={{ background: 'var(--color-primary)' }}>
                  {submitting ? 'Submitting…' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
