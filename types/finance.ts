import type { Profile } from './index'

// ── Enums (mirror the Postgres enums in supabase/migrations/0001) ──────────
export type PaymentStatus =
  | 'draft'
  | 'submitted'
  | 'clarification'
  | 'approved'
  | 'rejected'
  | 'processing'
  | 'paid'
  | 'posted'
  | 'cancelled'

export type PaymentMethod =
  | 'bank_transfer'
  | 'check'
  | 'telebirr'
  | 'petty_cash'
  | 'other'

export type DocumentKind =
  | 'proforma'
  | 'invoice'
  | 'receipt'
  | 'grn'
  | 'pra'
  | 'bpv'
  | 'bank_advice'
  | 'contract'
  | 'other'

export type SourceChannel = 'web' | 'telegram'

// Actions the status machine understands (web PATCH + Telegram callbacks).
export type PaymentAction =
  | 'approve'
  | 'reject'
  | 'clarify'
  | 'pay'
  | 'post'
  | 'cancel'

// ── Reference data ─────────────────────────────────────────────────────────
export interface CostCenter {
  id: string
  code: string
  name: string
  created_at: string
}

export type AccountClass = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'

export interface ChartAccount {
  code: string
  name: string
  class: AccountClass
  created_at?: string
}

export interface Vendor {
  id: string
  name: string
  tin: string | null
  phone: string | null
  email: string | null
  bank_name: string | null
  bank_account: string | null
  created_by: string | null
  created_at: string
}

export interface ApprovalThreshold {
  id: string
  kind: 'payment' | 'credit'
  min_amount: number
  max_amount: number
  required_role: string
  requires_check: boolean
  created_at?: string
}

// ── Core records ───────────────────────────────────────────────────────────
export interface PaymentRequest {
  id: string
  reference: string | null
  requester_id: string
  amount: number
  currency: string
  purpose: string
  vendor_id: string | null
  project_id: string | null
  cost_center_id: string | null
  coa_code: string | null
  payment_method: PaymentMethod | null
  requires_check: boolean
  is_project_related: boolean
  status: PaymentStatus
  current_approver_role: string | null
  approved_by: string | null
  approved_at: string | null
  rejected_reason: string | null
  paid_by: string | null
  paid_at: string | null
  bpv_number: string | null
  bank_advice_ref: string | null
  posted_by: string | null
  posted_at: string | null
  external_journal_ref: string | null
  source_channel: SourceChannel
  created_at: string
  updated_at: string
  // Joined (optional)
  requester?: Pick<Profile, 'id' | 'name' | 'role'>
  approver?: Pick<Profile, 'id' | 'name'>
  payer?: Pick<Profile, 'id' | 'name'>
  vendor?: Vendor
  project?: { id: string; name: string } | null
  cost_center?: CostCenter | null
  documents?: PaymentDocument[]
  events?: PaymentEvent[]
}

export interface PaymentDocument {
  id: string
  payment_request_id: string
  kind: DocumentKind
  url: string          // storage object path (private bucket)
  file_name: string
  uploaded_by: string | null
  created_at: string
  signed_url?: string  // populated by the API when returning documents
  uploader?: Pick<Profile, 'id' | 'name'>
}

export interface PaymentEvent {
  id: string
  payment_request_id: string
  actor_id: string | null
  action: string
  from_status: PaymentStatus | null
  to_status: PaymentStatus | null
  note: string | null
  created_at: string
  actor?: Pick<Profile, 'id' | 'name'>
}

// Labels for the UI
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  clarification: 'Needs clarification',
  approved: 'Approved',
  rejected: 'Rejected',
  processing: 'Processing',
  paid: 'Paid',
  posted: 'Posted',
  cancelled: 'Cancelled',
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: 'Bank transfer',
  check: 'Check',
  telebirr: 'Telebirr',
  petty_cash: 'Petty cash',
  other: 'Other',
}

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  proforma: 'Proforma',
  invoice: 'Invoice',
  receipt: 'Receipt',
  grn: 'Goods Received Note',
  pra: 'Purchase Requisition',
  bpv: 'Bank Payment Voucher',
  bank_advice: 'Bank Advice',
  contract: 'Contract',
  other: 'Other',
}
