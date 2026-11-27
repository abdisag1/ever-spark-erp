import { cn } from '@/lib/utils'
import type { PaymentStatus } from '@/types/finance'
import { PAYMENT_STATUS_LABELS } from '@/types/finance'

export function formatMoney(amount: number, currency = 'ETB'): string {
  const n = Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${n} ${currency}`
}

const STATUS_STYLE: Record<PaymentStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  submitted: 'bg-amber-100 text-amber-700',
  clarification: 'bg-orange-100 text-orange-700',
  approved: 'bg-blue-100 text-blue-700',
  rejected: 'bg-red-100 text-red-700',
  processing: 'bg-indigo-100 text-indigo-700',
  paid: 'bg-green-100 text-green-700',
  posted: 'bg-teal-100 text-teal-700',
  cancelled: 'bg-slate-100 text-slate-400',
}

export function StatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', STATUS_STYLE[status])}>
      {PAYMENT_STATUS_LABELS[status]}
    </span>
  )
}
