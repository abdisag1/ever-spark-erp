// Shared finance server logic used by BOTH the web API routes and the Telegram bot,
// so approval rules and segregation of duties live in one place.
import { admin } from '@/lib/finance'

export const PR_SELECT = `*,
  requester:profiles!payment_requests_requester_id_fkey(id,name,role),
  approver:profiles!payment_requests_approved_by_fkey(id,name),
  project:projects(id,name),
  vendor:vendors(id,name)`

export interface PaymentRow {
  id: string
  reference: string
  amount: number
  currency: string
  purpose: string
  status: string
  requester_id: string
  current_approver_role: string | null
  approved_by: string | null
  requires_check: boolean
}

export interface CreatePaymentInput {
  requester_id: string
  amount: number
  purpose: string
  project_id?: string | null
  cost_center_id?: string | null
  coa_code?: string | null
  vendor_id?: string | null
  payment_method?: string | null
  source_channel?: 'web' | 'telegram'
}

export type PaymentAction = 'approve' | 'reject' | 'clarify' | 'pay' | 'post' | 'cancel'

export type ActionResult =
  | { ok: true; pr: PaymentRow }
  | { ok: false; error: string }

const etb = (n: number) => `ETB ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Create a submitted payment request. DB triggers set reference, requires_check and approver tier. */
export async function createPaymentRequest(input: CreatePaymentInput): Promise<PaymentRow> {
  const a = admin()
  const { data, error } = await a
    .from('payment_requests')
    .insert({
      requester_id: input.requester_id,
      amount: input.amount,
      purpose: input.purpose,
      project_id: input.project_id ?? null,
      cost_center_id: input.cost_center_id ?? null,
      coa_code: input.coa_code ?? null,
      vendor_id: input.vendor_id ?? null,
      payment_method: input.payment_method ?? null,
      is_project_related: !!input.project_id,
      status: 'submitted',
      source_channel: input.source_channel ?? 'web',
    })
    .select(PR_SELECT)
    .single()
  if (error) throw new Error(error.message)
  const pr = data as PaymentRow
  await a.from('payment_events').insert({
    payment_request_id: pr.id,
    actor_id: input.requester_id,
    action: 'submitted',
    to_status: 'submitted',
    note: `Requested ${etb(input.amount)} — ${input.purpose}`,
  })
  return pr
}

/** Create in-app notifications for the approver tier. Returns the approver profiles (with telegram ids). */
export async function notifyApprovers(pr: PaymentRow): Promise<{ id: string; telegram_user_id: number | null }[]> {
  const a = admin()
  const { data: approvers } = await a
    .from('profiles')
    .select('id, telegram_user_id')
    .eq('role', pr.current_approver_role)
    .eq('status', 'active')
  const list = (approvers ?? []) as { id: string; telegram_user_id: number | null }[]
  if (list.length) {
    await a.from('notifications').insert(
      list.map((p) => ({
        user_id: p.id,
        title: 'Payment approval needed',
        message: `${pr.reference}: ${etb(pr.amount)} — ${pr.purpose}`,
        type: 'task_assigned',
        task_id: null,
      }))
    )
  }
  return list
}

/** Run a lifecycle action with the same guards and segregation-of-duties rules as the web PATCH route. */
export async function actOnRequest(opts: {
  id: string
  actorId: string
  actorRole?: string | null
  action: PaymentAction
  note?: string
  bpv_number?: string
  bank_advice_ref?: string
}): Promise<ActionResult> {
  const a = admin()
  const { data: reqData } = await a.from('payment_requests').select('*').eq('id', opts.id).single()
  if (!reqData) return { ok: false, error: 'Request not found' }
  const req = reqData as PaymentRow
  const staff = opts.actorRole === 'finance' || opts.actorRole === 'admin'
  const isApprover = opts.actorRole === 'admin' || opts.actorRole === req.current_approver_role
  const from = req.status
  const patch: Record<string, unknown> = {}
  let to = from

  switch (opts.action) {
    case 'approve':
      if (!['submitted', 'clarification'].includes(from)) return { ok: false, error: 'Not awaiting approval.' }
      if (!isApprover) return { ok: false, error: 'You are not the authorized approver for this amount.' }
      if (req.requester_id === opts.actorId) return { ok: false, error: 'You cannot approve your own request.' }
      Object.assign(patch, { status: 'approved', approved_by: opts.actorId, approved_at: new Date().toISOString() })
      to = 'approved'
      break
    case 'reject':
      if (!['submitted', 'clarification'].includes(from)) return { ok: false, error: 'Not awaiting approval.' }
      if (!isApprover) return { ok: false, error: 'Not authorized.' }
      if (req.requester_id === opts.actorId) return { ok: false, error: 'You cannot reject your own request.' }
      Object.assign(patch, { status: 'rejected', approved_by: opts.actorId, rejected_reason: opts.note ?? null })
      to = 'rejected'
      break
    case 'clarify':
      if (from !== 'submitted') return { ok: false, error: 'Only submitted requests can be queried.' }
      if (!isApprover) return { ok: false, error: 'Not authorized.' }
      Object.assign(patch, { status: 'clarification' })
      to = 'clarification'
      break
    case 'pay':
      if (from !== 'approved') return { ok: false, error: 'Only approved requests can be paid.' }
      if (!staff) return { ok: false, error: 'Only finance/admin can record payment.' }
      if (req.approved_by === opts.actorId) return { ok: false, error: 'The approver cannot also record payment (segregation of duties).' }
      if (req.requester_id === opts.actorId) return { ok: false, error: 'The requester cannot record payment.' }
      if (req.requires_check && !opts.bpv_number) return { ok: false, error: 'A check / BPV number is required over 30,000.' }
      Object.assign(patch, {
        status: 'paid', paid_by: opts.actorId, paid_at: new Date().toISOString(),
        bpv_number: opts.bpv_number ?? null, bank_advice_ref: opts.bank_advice_ref ?? null,
      })
      to = 'paid'
      break
    case 'post':
      if (from !== 'paid') return { ok: false, error: 'Only paid requests can be posted.' }
      if (!staff) return { ok: false, error: 'Only finance/admin can post.' }
      Object.assign(patch, { status: 'posted', posted_by: opts.actorId, posted_at: new Date().toISOString() })
      to = 'posted'
      break
    case 'cancel':
      if (!['draft', 'submitted', 'clarification'].includes(from)) return { ok: false, error: 'Cannot cancel now.' }
      if (req.requester_id !== opts.actorId && !staff) return { ok: false, error: 'Not authorized to cancel.' }
      Object.assign(patch, { status: 'cancelled' })
      to = 'cancelled'
      break
  }

  const { data: updated, error } = await a.from('payment_requests').update(patch).eq('id', opts.id).select(PR_SELECT).single()
  if (error) {
    const msg = /supporting document/i.test(error.message)
      ? 'Attach a receipt/invoice/BPV before marking paid.'
      : error.message
    return { ok: false, error: msg }
  }
  await a.from('payment_events').insert({
    payment_request_id: opts.id, actor_id: opts.actorId, action: opts.action,
    from_status: from, to_status: to, note: opts.note ?? null,
  })
  return { ok: true, pr: updated as PaymentRow }
}
