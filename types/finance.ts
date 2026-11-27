// Finance module types (Phase 1).
// Append these to types/index.ts, or keep as a separate module and import from '@/types/finance'.
import type { Profile, Project } from '@/types'

export type PaymentStatus =
  | 'draft' | 'submitted' | 'clarification' | 'approved' | 'rejected'
  | 'processing' | 'paid' | 'posted' | 'cancelled'

export type PaymentMethod =
  | 'bank_transfer' | 'check' | 'telebirr' | 'petty_cash' | 'other'

export type DocumentKind =
  | 'proforma' | 'invoice' | 'receipt' | 'grn' | 'pra' | 'bpv' | 'bank_advice' | 'contract' | 'other'

// Documents that satisfy the receipt-before-paid gate (must match the SQL trigger).
export const RECEIPT_KINDS: DocumentKind[] = ['receipt', 'invoice', 'bpv', 'bank_advice']

export type PaymentAction =
  | 'approve' | 'reject' | 'clarify' | 'pay' | 'post' | 'cancel'

export interface CostCenter {
  id: string
  code: string
  name: string
  active: boolean
  created_at: string
}

export interface ChartOfAccount {
  id: string
  code: string
  name: string
  class: 'asset' | 'liability' | 'equity' | 'revenue' | 'cost' | 'expense' | 'other' | 'control'
  active: boolean
  created_at: string
}

export interface Vendor {
  id: string
  name: string
  tin: string | null
  bank_name: string | null
  bank_account: string | null
  phone: string | null
  email: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
}

export interface ApprovalThreshold {
  id: string
  kind: 'payment' | 'credit'
  min_amount: number
  max_amount: number | null
  required_role: 'finance' | 'admin'
  requires_check: boolean
  created_at: string
}

export interface PaymentDocument {
  id: string
  payment_request_id: string
  kind: DocumentKind
  url: string          // storage path; resolve to a signed URL on read
  signed_url?: string  // populated by GET endpoints
  file_name: string
  uploaded_by: string
  created_at: string
}

export interface PaymentEvent {
  id: string
  payment_request_id: string
  actor_id: string
  action: string
  from_status: PaymentStatus | null
  to_status: PaymentStatus | null
  note: string | null
  created_at: string
  actor?: Profile
}

export interface PaymentRequest {
  id: string
  reference: string
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
  source_channel: 'web' | 'telegram'
  created_at: string
  updated_at: string
  // joins
  requester?: Profile
  approver?: Profile
  project?: Pick<Project, 'id' | 'name'>
  vendor?: Pick<Vendor, 'id' | 'name'>
  documents?: PaymentDocument[]
  events?: PaymentEvent[]
}
