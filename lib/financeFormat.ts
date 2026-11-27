// Client-safe finance formatting helpers (no server imports — safe in 'use client' files).
import type { PaymentStatus } from '@/types/finance'

export function formatETB(amount: number, currency = 'ETB'): string {
  return `${currency} ${Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export const STATUS_META: Record<PaymentStatus, { label: string; cls: string }> = {
  draft:         { label: 'Draft',             cls: 'bg-slate-100 text-slate-700' },
  submitted:     { label: 'Awaiting approval', cls: 'bg-amber-100 text-amber-700' },
  clarification: { label: 'Clarification',     cls: 'bg-orange-100 text-orange-700' },
  approved:      { label: 'Approved',          cls: 'bg-blue-100 text-blue-700' },
  rejected:      { label: 'Rejected',          cls: 'bg-red-100 text-red-700' },
  processing:    { label: 'Processing',        cls: 'bg-indigo-100 text-indigo-700' },
  paid:          { label: 'Paid',              cls: 'bg-teal-100 text-teal-700' },
  posted:        { label: 'Posted',            cls: 'bg-green-100 text-green-700' },
  cancelled:     { label: 'Cancelled',         cls: 'bg-slate-100 text-slate-500' },
}

export const DOC_KIND_LABELS: Record<string, string> = {
  proforma: 'Proforma', invoice: 'Invoice', receipt: 'Receipt', grn: 'GRN',
  pra: 'PRA', bpv: 'BPV', bank_advice: 'Bank advice', contract: 'Contract', other: 'Other',
}

export const isFinanceStaff = (role?: string | null): boolean => role === 'finance' || role === 'admin'
