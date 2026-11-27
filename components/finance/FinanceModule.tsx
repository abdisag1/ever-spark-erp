'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { Plus, Clock, Banknote, CheckCircle2, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatusBadge, formatMoney } from '@/components/finance/shared'
import { NewRequestModal } from '@/components/finance/NewRequestModal'
import { PaymentDetailModal } from '@/components/finance/PaymentDetailModal'
import type {
  PaymentRequest, Vendor, CostCenter, ChartAccount, PaymentStatus,
} from '@/types/finance'

interface Props {
  currentUser: { id: string; name: string; role: string }
  initialRequests: PaymentRequest[]
  projects: { id: string; name: string }[]
  vendors: Vendor[]
  costCenters: CostCenter[]
  accounts: ChartAccount[]
}

type TabKey = 'approval' | 'all' | 'mine'
const OPEN_STATUSES: PaymentStatus[] = ['submitted', 'clarification', 'approved', 'processing']

export function FinanceModule({ currentUser, initialRequests, projects, vendors, costCenters, accounts }: Props) {
  const [requests, setRequests] = useState<PaymentRequest[]>(initialRequests)
  const [newOpen, setNewOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const canSeeAll = ['finance', 'admin'].includes(currentUser.role)

  const myApprovals = useMemo(
    () => requests.filter(
      (r) => ['submitted', 'clarification'].includes(r.status)
        && (r.current_approver_role === currentUser.role || currentUser.role === 'admin')
        && r.requester_id !== currentUser.id
    ),
    [requests, currentUser]
  )
  const mine = useMemo(() => requests.filter((r) => r.requester_id === currentUser.id), [requests, currentUser])

  const [tab, setTab] = useState<TabKey>(canSeeAll ? (myApprovals.length ? 'approval' : 'all') : 'mine')

  const tabs: { key: TabKey; label: string; count?: number }[] = canSeeAll
    ? [
        { key: 'approval', label: 'Needs my approval', count: myApprovals.length },
        { key: 'all', label: 'All', count: requests.length },
        { key: 'mine', label: 'Mine', count: mine.length },
      ]
    : [{ key: 'mine', label: 'My requests', count: mine.length }]

  const visible = tab === 'approval' ? myApprovals : tab === 'mine' ? mine : requests

  // Stat tiles
  const now = new Date()
  const paidThisMonth = requests.filter(
    (r) => r.status === 'paid' && r.paid_at && new Date(r.paid_at).getMonth() === now.getMonth() && new Date(r.paid_at).getFullYear() === now.getFullYear()
  )
  const awaitingPayment = requests.filter((r) => ['approved', 'processing'].includes(r.status))
  const openAmount = requests.filter((r) => OPEN_STATUSES.includes(r.status)).reduce((s, r) => s + Number(r.amount), 0)

  const tiles = [
    canSeeAll
      ? { label: 'Needs my approval', value: String(myApprovals.length), icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' }
      : { label: 'My open requests', value: String(mine.filter((r) => OPEN_STATUSES.includes(r.status)).length), icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Awaiting payment', value: String(awaitingPayment.length), icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Paid this month', value: String(paidThisMonth.length), icon: Banknote, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Open amount', value: formatMoney(openAmount), icon: Wallet, color: 'text-purple-600', bg: 'bg-purple-50' },
  ]

  function onCreated(pr: PaymentRequest) {
    setRequests((prev) => [pr, ...prev])
  }
  function onUpdated(pr: PaymentRequest) {
    setRequests((prev) => prev.map((r) => (r.id === pr.id ? { ...r, ...pr } : r)))
  }

  return (
    <div className="space-y-5">
      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500">{t.label}</span>
              <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', t.bg)}>
                <t.icon className={cn('w-4 h-4', t.color)} />
              </div>
            </div>
            <p className={cn('text-xl lg:text-2xl font-bold', t.color)}>{t.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn('px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className="ml-1.5 text-xs text-slate-400">{t.count}</span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={() => setNewOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
          style={{ background: 'var(--color-primary)' }}
        >
          <Plus className="w-4 h-4" /> New request
        </button>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="divide-y divide-slate-100">
          {visible.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-12">No payment requests here yet.</p>
          )}
          {visible.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-900">{formatMoney(r.amount, r.currency)}</span>
                  <StatusBadge status={r.status} />
                  {r.requires_check && <span className="text-xs text-amber-600">check</span>}
                  {r.source_channel === 'telegram' && <span className="text-xs text-sky-600">telegram</span>}
                </div>
                <p className="text-xs text-slate-500 truncate mt-0.5">{r.purpose}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {r.reference}
                  {canSeeAll && r.requester?.name ? ` · ${r.requester.name}` : ''}
                  {r.project?.name ? ` · ${r.project.name}` : ''}
                </p>
              </div>
              <span className="text-xs text-slate-400 whitespace-nowrap shrink-0">
                {format(new Date(r.created_at), 'MMM d')}
              </span>
            </button>
          ))}
        </div>
      </div>

      <NewRequestModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={onCreated}
        projects={projects}
        vendors={vendors}
        costCenters={costCenters}
        accounts={accounts}
      />

      <PaymentDetailModal
        requestId={selectedId}
        currentUser={currentUser}
        onClose={() => setSelectedId(null)}
        onUpdated={onUpdated}
      />
    </div>
  )
}
