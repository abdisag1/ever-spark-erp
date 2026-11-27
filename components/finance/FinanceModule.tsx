'use client'

import { useMemo, useState } from 'react'
import { Plus, Receipt, Clock, CheckCircle2, Wallet } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { formatETB, STATUS_META, isFinanceStaff } from '@/lib/financeFormat'
import { PaymentRequestForm } from './PaymentRequestForm'
import { PaymentRequestDetail } from './PaymentRequestDetail'
import type { PaymentRequest, CostCenter, ChartOfAccount, Vendor } from '@/types/finance'

interface Props {
  role: string
  userId: string
  userName: string
  initialRequests: PaymentRequest[]
  costCenters: CostCenter[]
  accounts: ChartOfAccount[]
  vendors: Vendor[]
  projects: { id: string; name: string }[]
}

type Tab = 'approvals' | 'mine' | 'all'

export function FinanceModule({ role, userId, initialRequests, costCenters, accounts, vendors, projects }: Props) {
  const [requests, setRequests] = useState<PaymentRequest[]>(initialRequests)
  const [formOpen, setFormOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const staff = isFinanceStaff(role)
  const [tab, setTab] = useState<Tab>(staff ? 'approvals' : 'mine')

  function upsert(updated: PaymentRequest) {
    setRequests((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)))
  }

  const pendingForMe = useMemo(
    () => requests.filter((r) =>
      ['submitted', 'clarification'].includes(r.status) &&
      (role === 'admin' || r.current_approver_role === role)),
    [requests, role]
  )

  const visible = useMemo(() => {
    if (tab === 'mine') return requests.filter((r) => r.requester_id === userId)
    if (tab === 'approvals') return pendingForMe
    return requests
  }, [tab, requests, userId, pendingForMe])

  const stats = useMemo(() => {
    const mine = requests.filter((r) => r.requester_id === userId)
    const scope = staff ? requests : mine
    const sum = (list: PaymentRequest[]) => list.reduce((a, r) => a + Number(r.amount), 0)
    return {
      awaiting: scope.filter((r) => ['submitted', 'clarification'].includes(r.status)).length,
      awaitingValue: sum(scope.filter((r) => ['submitted', 'clarification'].includes(r.status))),
      approved: scope.filter((r) => r.status === 'approved').length,
      paid: scope.filter((r) => ['paid', 'posted'].includes(r.status)).length,
    }
  }, [requests, userId, staff])

  const tabs: { id: Tab; label: string; count?: number }[] = staff
    ? [
        { id: 'approvals', label: 'Needs my approval', count: pendingForMe.length },
        { id: 'all', label: 'All requests' },
        { id: 'mine', label: 'My requests' },
      ]
    : [{ id: 'mine', label: 'My requests' }]

  const tiles = [
    { label: 'Awaiting approval', value: stats.awaiting, sub: formatETB(stats.awaitingValue), icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
    { label: 'Approved', value: stats.approved, icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
    { label: 'Paid / posted', value: stats.paid, icon: Wallet, color: 'text-green-600', bg: 'bg-green-50 border-green-100' },
  ]

  return (
    <div className="space-y-5">
      {/* Stat tiles */}
      <div className="grid grid-cols-3 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className={cn('rounded-xl border p-4', t.bg)}>
            <div className="flex items-center justify-between">
              <p className={cn('text-xs font-medium', t.color)}>{t.label}</p>
              <t.icon className={cn('w-4 h-4', t.color)} />
            </div>
            <p className={cn('text-2xl font-bold mt-1', t.color)}>{t.value}</p>
            {t.sub && <p className="text-xs text-slate-400 mt-0.5 truncate">{t.sub}</p>}
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              )}
            >
              {t.label}
              {typeof t.count === 'number' && t.count > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] px-1.5 h-4">{t.count}</span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
          style={{ background: 'var(--color-primary)' }}
        >
          <Plus className="w-4 h-4" /> New request
        </button>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-slate-400">
            <Receipt className="w-8 h-8" />
            <p className="text-sm">No payment requests here yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {visible.map((r) => {
              const meta = STATUS_META[r.status]
              return (
                <button
                  key={r.id}
                  onClick={() => setDetailId(r.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900 truncate">{r.purpose}</span>
                      {r.requires_check && <span className="text-[10px] font-medium text-slate-500 border border-slate-200 rounded px-1">CHECK</span>}
                    </div>
                    <p className="text-xs text-slate-400 truncate">
                      {r.reference} · {r.requester?.name ?? '—'}
                      {r.project?.name ? ` · ${r.project.name}` : ''} · {formatDate(r.created_at)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-slate-900">{formatETB(Number(r.amount), r.currency)}</p>
                    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium mt-0.5', meta.cls)}>{meta.label}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <PaymentRequestForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        costCenters={costCenters}
        accounts={accounts}
        vendors={vendors}
        projects={projects}
        onCreated={(r) => setRequests((prev) => [r, ...prev])}
      />

      {detailId && (
        <PaymentRequestDetail
          id={detailId}
          role={role}
          userId={userId}
          onClose={() => setDetailId(null)}
          onChanged={upsert}
        />
      )}
    </div>
  )
}
