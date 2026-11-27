/**
 * Shared finance server actions.
 *
 * The web route handlers (app/api/finance/*) AND the Telegram bot
 * (lib/telegram/*) both call these functions, so the status machine,
 * segregation-of-duties rules and audit logging live in exactly one place.
 *
 * All privileged writes go through the service-role admin client and every
 * money action is appended to `payment_events`.
 */
import { createClient as createAdmin, type SupabaseClient } from '@supabase/supabase-js'
import type {
  PaymentRequest,
  PaymentAction,
  PaymentMethod,
  SourceChannel,
} from '@/types/finance'
import {
  notifyApproversTelegram,
  sendStatusUpdateTelegram,
} from '@/lib/telegram/notify'

export function financeAdminClient(): SupabaseClient {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export const PR_SELECT = `*,
  requester:profiles!payment_requests_requester_id_fkey(id, name, role),
  approver:profiles!payment_requests_approved_by_fkey(id, name),
  payer:profiles!payment_requests_paid_by_fkey(id, name),
  vendor:vendors(*),
  project:projects(id, name),
  cost_center:cost_centers(id, code, name)`

export function formatETB(amount: number, currency = 'ETB'): string {
  const n = Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${n} ${currency}`
}

// ── Audit + notifications ───────────────────────────────────────────────────
async function logEvent(
  admin: SupabaseClient,
  requestId: string,
  actorId: string | null,
  action: string,
  fromStatus: string | null,
  toStatus: string | null,
  note: string | null
) {
  await admin.from('payment_events').insert({
    payment_request_id: requestId,
    actor_id: actorId,
    action,
    from_status: fromStatus,
    to_status: toStatus,
    note,
  })
}

async function notifyInApp(
  admin: SupabaseClient,
  userIds: string[],
  title: string,
  message: string
) {
  if (!userIds.length) return
  await admin.from('notifications').insert(
    userIds.map((id) => ({
      user_id: id,
      title,
      message,
      type: 'task_assigned', // reuse existing notification type (see Leave module)
      task_id: null,
    }))
  )
}

/** Telegram ids of active users holding a given role (safe if column absent). */
async function telegramIdsForRole(
  admin: SupabaseClient,
  role: string
): Promise<number[]> {
  try {
    const { data } = await admin
      .from('profiles')
      .select('telegram_user_id')
      .eq('role', role)
      .eq('status', 'active')
      .not('telegram_user_id', 'is', null)
    return (data ?? [])
      .map((r) => (r as { telegram_user_id: number | null }).telegram_user_id)
      .filter((v): v is number => v != null)
  } catch {
    return []
  }
}

async function telegramIdForUser(
  admin: SupabaseClient,
  userId: string
): Promise<number | null> {
  try {
    const { data } = await admin
      .from('profiles')
      .select('telegram_user_id')
      .eq('id', userId)
      .maybeSingle()
    return (data as { telegram_user_id: number | null } | null)?.telegram_user_id ?? null
  } catch {
    return null
  }
}

async function notifyApproversOfNew(admin: SupabaseClient, pr: PaymentRequest) {
  const role = pr.current_approver_role || 'finance'
  const { data: approvers } = await admin
    .from('profiles')
    .select('id, name')
    .eq('role', role)
    .eq('status', 'active')

  const requesterName = pr.requester?.name ?? 'A staff member'
  const summary = `${requesterName} requested ${formatETB(pr.amount, pr.currency)} — ${pr.purpose} (${pr.reference})`

  await notifyInApp(
    admin,
    (approvers ?? []).map((a) => a.id),
    'Payment request awaiting approval',
    summary
  )

  // Telegram: linked approvers get inline Approve / Clarify / Reject buttons.
  try {
    const chatIds = await telegramIdsForRole(admin, role)
    if (chatIds.length) await notifyApproversTelegram(pr, chatIds)
  } catch {
    /* Telegram is best-effort; never block request creation. */
  }
}

// ── Create ──────────────────────────────────────────────────────────────────
export interface CreatePaymentRequestInput {
  requesterId: string
  amount: number
  currency?: string
  purpose: string
  vendorId?: string | null
  projectId?: string | null
  costCenterId?: string | null
  coaCode?: string | null
  paymentMethod?: PaymentMethod | null
  isProjectRelated?: boolean
  sourceChannel?: SourceChannel
}

export async function createPaymentRequest(
  input: CreatePaymentRequestInput
): Promise<PaymentRequest> {
  if (!input.amount || input.amount <= 0) throw new Error('Amount must be greater than zero')
  if (!input.purpose?.trim()) throw new Error('Purpose is required')

  const admin = financeAdminClient()
  const { data, error } = await admin
    .from('payment_requests')
    .insert({
      requester_id: input.requesterId,
      amount: input.amount,
      currency: input.currency || 'ETB',
      purpose: input.purpose.trim(),
      vendor_id: input.vendorId ?? null,
      project_id: input.projectId ?? null,
      cost_center_id: input.costCenterId ?? null,
      coa_code: input.coaCode ?? null,
      payment_method: input.paymentMethod ?? null,
      is_project_related: input.isProjectRelated ?? !!input.projectId,
      source_channel: input.sourceChannel || 'web',
      // reference / requires_check / current_approver_role set by DB trigger
    })
    .select(PR_SELECT)
    .single()

  if (error) throw new Error(error.message)
  const pr = data as PaymentRequest

  await logEvent(admin, pr.id, input.requesterId, 'submit', null, pr.status,
    `Payment request ${pr.reference} submitted via ${pr.source_channel}`)
  await notifyApproversOfNew(admin, pr)
  return pr
}

// ── Attach a document ─────────────────────────────────────────────────────────
export async function attachDocument(input: {
  requestId: string
  kind: PaymentDocKind
  url: string
  fileName: string
  uploadedBy: string
}): Promise<void> {
  const admin = financeAdminClient()
  const { error } = await admin.from('payment_documents').insert({
    payment_request_id: input.requestId,
    kind: input.kind,
    url: input.url,
    file_name: input.fileName,
    uploaded_by: input.uploadedBy,
  })
  if (error) throw new Error(error.message)
  await logEvent(admin, input.requestId, input.uploadedBy, 'document', null, null,
    `Attached ${input.kind}: ${input.fileName}`)
}

type PaymentDocKind = import('@/types/finance').DocumentKind

// ── Action machine ────────────────────────────────────────────────────────────
export interface PerformActionInput {
  requestId: string
  actorId: string
  actorRole: string
  action: PaymentAction
  reason?: string | null
  bpvNumber?: string | null
  bankAdviceRef?: string | null
  paymentMethod?: PaymentMethod | null
}

export interface ActionResult {
  ok: boolean
  status?: number
  error?: string
  request?: PaymentRequest
}

function fail(status: number, error: string): ActionResult {
  return { ok: false, status, error }
}

/** Role + segregation-of-duties + status guards. Returns an error result or null. */
function checkGuards(pr: PaymentRequest, input: PerformActionInput): ActionResult | null {
  const { action, actorId, actorRole } = input
  const isApproverRole = actorRole === pr.current_approver_role || actorRole === 'admin'
  const isFinanceOrAdmin = actorRole === 'finance' || actorRole === 'admin'

  switch (action) {
    case 'approve':
    case 'reject':
    case 'clarify': {
      const allowed = action === 'clarify' ? ['submitted'] : ['submitted', 'clarification']
      if (!allowed.includes(pr.status)) {
        return fail(400, `This request cannot be ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'sent back for clarification'} from status "${pr.status}".`)
      }
      if (!isApproverRole) {
        return fail(403, 'You are not the designated approver for this request.')
      }
      // HARD SoD: requester != approver
      if (actorId === pr.requester_id) {
        return fail(403, 'Segregation of duties: the requester cannot approve, reject or clarify their own request.')
      }
      return null
    }
    case 'pay': {
      if (!['approved', 'processing'].includes(pr.status)) {
        return fail(400, `Only approved requests can be paid (current status: "${pr.status}").`)
      }
      if (!isFinanceOrAdmin) {
        return fail(403, 'Only finance or admin can settle a payment.')
      }
      // HARD SoD: approver != payer
      if (pr.approved_by && actorId === pr.approved_by) {
        return fail(403, 'Segregation of duties: the approver cannot also be the payer.')
      }
      if (pr.requires_check && !input.bpvNumber?.trim()) {
        return fail(400, 'A BPV / check number is required for this payment (amount over 30,000 ETB).')
      }
      return null
    }
    case 'post': {
      if (pr.status !== 'paid') {
        return fail(400, `Only paid requests can be posted (current status: "${pr.status}").`)
      }
      if (!isFinanceOrAdmin) {
        return fail(403, 'Only finance or admin can post a payment to the books.')
      }
      return null
    }
    case 'cancel': {
      if (!['draft', 'submitted', 'clarification'].includes(pr.status)) {
        return fail(400, `Only requests that are not yet approved can be cancelled (current status: "${pr.status}").`)
      }
      if (actorId !== pr.requester_id && actorRole !== 'admin') {
        return fail(403, 'Only the requester or an admin can cancel this request.')
      }
      return null
    }
    default:
      return fail(400, 'Unknown action.')
  }
}

export async function performAction(input: PerformActionInput): Promise<ActionResult> {
  const admin = financeAdminClient()
  const { data: existing, error: fErr } = await admin
    .from('payment_requests')
    .select('*')
    .eq('id', input.requestId)
    .single()
  if (fErr || !existing) return fail(404, 'Payment request not found.')
  const pr = existing as PaymentRequest

  const guard = checkGuards(pr, input)
  if (guard) return guard

  const now = new Date().toISOString()
  let patch: Record<string, unknown> = {}
  let note: string | null = input.reason?.trim() || null

  switch (input.action) {
    case 'approve':
      patch = { status: 'approved', approved_by: input.actorId, approved_at: now, rejected_reason: null }
      break
    case 'reject':
      patch = { status: 'rejected', rejected_reason: input.reason?.trim() || 'No reason provided' }
      note = patch.rejected_reason as string
      break
    case 'clarify':
      patch = { status: 'clarification' }
      note = input.reason?.trim() || 'More information requested'
      break
    case 'pay':
      patch = {
        status: 'paid',
        paid_by: input.actorId,
        paid_at: now,
        bpv_number: input.bpvNumber?.trim() || pr.bpv_number,
        bank_advice_ref: input.bankAdviceRef?.trim() || pr.bank_advice_ref,
        payment_method: input.paymentMethod || pr.payment_method,
      }
      note = note || `Settled${patch.bpv_number ? ` · BPV ${patch.bpv_number}` : ''}`
      break
    case 'post':
      patch = { status: 'posted', posted_by: input.actorId, posted_at: now }
      note = note || 'Posted to the interim book of record'
      break
    case 'cancel':
      patch = { status: 'cancelled' }
      note = note || 'Request cancelled'
      break
  }

  const { data: updated, error } = await admin
    .from('payment_requests')
    .update(patch)
    .eq('id', input.requestId)
    .select(PR_SELECT)
    .single()

  // The receipt-before-paid DB gate raises here if no settlement document exists.
  if (error) return fail(400, error.message)
  const result = updated as PaymentRequest

  await logEvent(admin, pr.id, input.actorId, input.action, pr.status, result.status, note)
  await notifyAfterAction(admin, result, input.action)
  return { ok: true, request: result }
}

async function notifyAfterAction(
  admin: SupabaseClient,
  pr: PaymentRequest,
  action: PaymentAction
) {
  const ref = pr.reference ?? 'your request'
  const amount = formatETB(pr.amount, pr.currency)

  const outcomes: Record<PaymentAction, { title: string; message: string } | null> = {
    approve: {
      title: 'Payment request approved',
      message: `${ref} (${amount}) was approved and is ready for payment.`,
    },
    reject: {
      title: 'Payment request rejected',
      message: `${ref} (${amount}) was rejected.${pr.rejected_reason ? ` Reason: ${pr.rejected_reason}` : ''}`,
    },
    clarify: {
      title: 'Clarification requested',
      message: `${ref} (${amount}) needs more information before it can be approved.`,
    },
    pay: {
      title: 'Payment settled',
      message: `${ref} (${amount}) has been paid.${pr.bpv_number ? ` BPV: ${pr.bpv_number}.` : ''}`,
    },
    post: {
      title: 'Payment posted',
      message: `${ref} (${amount}) has been posted to the books.`,
    },
    cancel: null,
  }

  const outcome = outcomes[action]
  if (!outcome) return

  // Notify the requester in-app + Telegram.
  await notifyInApp(admin, [pr.requester_id], outcome.title, outcome.message)
  try {
    const chatId = await telegramIdForUser(admin, pr.requester_id)
    if (chatId) await sendStatusUpdateTelegram(chatId, `${outcome.title}\n${outcome.message}`)
  } catch {
    /* best effort */
  }

  // When approved, let finance know a payment is ready to settle.
  if (action === 'approve') {
    const { data: finance } = await admin
      .from('profiles')
      .select('id')
      .eq('role', 'finance')
      .eq('status', 'active')
    await notifyInApp(
      admin,
      (finance ?? []).map((f) => f.id),
      'Payment ready to settle',
      `${ref} (${amount}) has been approved and is ready for payment.`
    )
  }
}
