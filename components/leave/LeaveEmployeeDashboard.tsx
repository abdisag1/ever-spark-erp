'use client'

import { useState, useMemo } from 'react'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths,
} from 'date-fns'
import {
  ChevronLeft, ChevronRight, Plus, Download, Clock, CheckCircle2,
  CalendarDays, Paperclip, X, Upload, FileText, ExternalLink,
} from 'lucide-react'
import { cn, countWorkingDays } from '@/lib/utils'
import { toast } from 'sonner'
import type { LeaveRequest, LeaveBalance } from '@/types'

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: 'Annual', sick: 'Sick', emergency: 'Emergency',
  maternity: 'Maternity', paternity: 'Paternity', unpaid: 'Unpaid',
}
const STATUS_STYLE: Record<string, string> = {
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  pending:  'bg-amber-100 text-amber-700',
}
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const TOTAL_WORKING_DAYS = 260

function isDateInLeave(date: Date, leaves: LeaveRequest[]): LeaveRequest | null {
  const d = format(date, 'yyyy-MM-dd')
  return leaves.find((l) => l.start_date <= d && l.end_date >= d) ?? null
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

interface Props { requests: LeaveRequest[]; balance: LeaveBalance }

export function LeaveEmployeeDashboard({ requests: init, balance: initBal }: Props) {
  const [requests, setRequests] = useState<LeaveRequest[]>(init)
  const [balance, setBalance]   = useState<LeaveBalance>(initBal)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [formOpen, setFormOpen] = useState(false)

  // Form state
  const [leaveType,  setLeaveType]  = useState('annual')
  const [startDate,  setStartDate]  = useState('')
  const [endDate,    setEndDate]    = useState('')
  const [reason,     setReason]     = useState('')
  const [attachment, setAttachment] = useState<{ url: string; name: string; size: number } | null>(null)
  const [uploading,  setUploading]  = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const remaining    = balance.total_days - balance.days_taken
  const efficiency   = Math.round(((TOTAL_WORKING_DAYS - balance.days_taken) / TOTAL_WORKING_DAYS) * 100)
  const previewDays  = useMemo(() => (startDate && endDate && endDate >= startDate ? countWorkingDays(startDate, endDate) : 0), [startDate, endDate])
  const previewRemaining = remaining - (leaveType === 'annual' ? previewDays : 0)

  // Calendar grid
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }),
    end:   endOfWeek(endOfMonth(currentDate),     { weekStartsOn: 1 }),
  })
  const approvedLeaves = requests.filter((r) => r.status === 'approved')
  const pendingLeaves  = requests.filter((r) => r.status === 'pending')

  async function handleFileChange(file: File) {
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/leave/upload', { method: 'POST', body: fd })
    if (res.ok) {
      const data = await res.json()
      setAttachment({ url: data.url, name: data.name, size: data.size })
      toast.success('Form attached')
    } else {
      const b = await res.json().catch(() => ({}))
      toast.error(b?.error ?? 'Failed to upload file')
    }
    setUploading(false)
  }

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault()
    if (!startDate || !endDate) { toast.error('Select start and end dates'); return }
    if (endDate < startDate)    { toast.error('End date must be after start date'); return }
    if (previewDays === 0)       { toast.error('No working days in selected range'); return }
    if (leaveType === 'annual' && previewDays > remaining) {
      toast.error(`Insufficient balance — ${remaining} days remaining`); return
    }
    setSubmitting(true)
    const res = await fetch('/api/leave/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leave_type: leaveType, start_date: startDate, end_date: endDate, reason,
        attachment_url:  attachment?.url  ?? null,
        attachment_name: attachment?.name ?? null,
      }),
    })
    if (res.ok) {
      const newReq: LeaveRequest = await res.json()
      setRequests((prev) => [newReq, ...prev])
      setFormOpen(false)
      setLeaveType('annual'); setStartDate(''); setEndDate(''); setReason(''); setAttachment(null)
      toast.success('Leave request submitted — awaiting approval')
    } else {
      const b = await res.json().catch(() => ({}))
      toast.error(b?.error ?? 'Failed to submit request')
    }
    setSubmitting(false)
  }

  const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="space-y-5">
      {/* Balance stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
          <p className="text-xs text-blue-400 mt-1">{TOTAL_WORKING_DAYS - balance.days_taken}/{TOTAL_WORKING_DAYS} days</p>
        </div>
        {[
          { label: 'Pending',  count: requests.filter((r) => r.status === 'pending').length,  color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
          { label: 'Approved', count: requests.filter((r) => r.status === 'approved').length, color: 'text-green-600', bg: 'bg-green-50 border-green-100' },
        ].map((s) => (
          <div key={s.label} className={cn('rounded-xl border p-4', s.bg)}>
            <p className={cn('text-xs font-medium mb-1', s.color)}>{s.label}</p>
            <p className={cn('text-2xl font-bold', s.color)}>{s.count}</p>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFormOpen(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors" style={{ background: 'var(--color-primary)' }}>
          <Plus className="w-4 h-4" /> Request Leave
        </button>
        <button onClick={() => window.open('/api/leave/template', '_blank')} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors">
          <Download className="w-4 h-4" /> Download Form Template
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Calendar */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <button onClick={() => setCurrentDate((d) => subMonths(d, 1))} className="p-1.5 rounded hover:bg-slate-100 text-slate-500"><ChevronLeft className="w-4 h-4" /></button>
            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold text-slate-900">{format(currentDate, 'MMMM yyyy')}</span>
              <div className="hidden sm:flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Approved</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block" /> Pending</span>
              </div>
            </div>
            <button onClick={() => setCurrentDate((d) => addMonths(d, 1))} className="p-1.5 rounded hover:bg-slate-100 text-slate-500"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
            {DAYS.map((d) => <div key={d} className="py-2 text-center text-xs font-medium text-slate-500">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day, idx) => {
              const approved = isDateInLeave(day, approvedLeaves)
              const pending  = isDateInLeave(day, pendingLeaves)
              const inMonth  = isSameMonth(day, currentDate)
              return (
                <div key={day.toISOString()} className={cn('min-h-[40px] border-b border-r border-slate-100 flex flex-col items-center pt-1', !inMonth && 'opacity-30', idx % 7 >= 5 && inMonth && 'bg-slate-50/60', approved && 'bg-green-50', pending && 'bg-amber-50')}>
                  <span className={cn('text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full', isToday(day) && 'bg-blue-600 text-white', !isToday(day) && 'text-slate-700')}>
                    {format(day, 'd')}
                  </span>
                  {(approved || pending) && <span className={cn('w-1.5 h-1.5 rounded-full mt-0.5', approved ? 'bg-green-500' : 'bg-amber-400')} />}
                </div>
              )
            })}
          </div>
        </div>

        {/* My Requests list */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">My Leave History</h3>
          </div>
          <div className="divide-y divide-slate-100 overflow-y-auto max-h-[400px]">
            {requests.length === 0 && <p className="text-xs text-slate-400 text-center py-8">No leave requests yet.</p>}
            {requests.map((r) => (
              <div key={r.id} className="px-4 py-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-800">{LEAVE_TYPE_LABELS[r.leave_type]}</span>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_STYLE[r.status])}>
                    {r.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <CalendarDays className="w-3 h-3 shrink-0" />
                  {format(new Date(r.start_date), 'MMM d')} – {format(new Date(r.end_date), 'MMM d, yyyy')}
                  <span className="text-slate-400 ml-1">({r.days_requested}d)</span>
                </p>
                {r.attachment_url && (
                  <a href={r.attachment_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 transition-colors">
                    <Paperclip className="w-3 h-3" />
                    {r.attachment_name ?? 'View attachment'}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {r.admin_note && <p className="text-xs text-slate-400 italic">Note: {r.admin_note}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Request Leave modal ── */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setFormOpen(false)} />
          <div className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Request Leave</h2>
              <button onClick={() => setFormOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={submitRequest} className="p-5 space-y-4 overflow-y-auto max-h-[80vh]">
              {/* Live balance preview */}
              {previewDays > 0 && (
                <div className={cn('flex items-center justify-between text-xs px-3 py-2 rounded-lg font-medium', previewDays > remaining && leaveType === 'annual' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700')}>
                  <span>{previewDays} working day{previewDays !== 1 ? 's' : ''} selected</span>
                  {leaveType === 'annual' && <span>After approval: <strong>{previewRemaining}</strong> days left</span>}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Leave Type *</label>
                <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)} className={cn(inputCls, 'bg-white')}>
                  {Object.entries(LEAVE_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
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
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Brief reason for leave…" className={cn(inputCls, 'resize-none')} />
              </div>

              {/* Attachment */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Attach Leave Form <span className="text-slate-400 font-normal">(PDF, Word, or image)</span>
                </label>

                {attachment ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-blue-800 truncate">{attachment.name}</p>
                      <p className="text-xs text-blue-500">{formatBytes(attachment.size)}</p>
                    </div>
                    <button type="button" onClick={() => setAttachment(null)} className="p-1 rounded hover:bg-blue-100 text-blue-400">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <label className={cn('flex items-center gap-2 px-3 py-2.5 border-2 border-dashed border-slate-200 rounded-lg cursor-pointer transition-colors', uploading ? 'opacity-50 pointer-events-none' : 'hover:border-blue-300 hover:bg-blue-50/30')}>
                    <Upload className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-xs text-slate-400">{uploading ? 'Uploading…' : 'Click to attach completed leave form'}</span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,image/*"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileChange(f) }}
                    />
                  </label>
                )}

                <p className="text-xs text-slate-400 mt-1">
                  Download the template above, fill it out, then attach it here.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
                  Cancel
                </button>
                <button type="submit" disabled={submitting || uploading} className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors" style={{ background: 'var(--color-primary)' }}>
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
