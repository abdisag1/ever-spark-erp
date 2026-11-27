import { createClient } from '@/lib/supabase/server'
import { admin, canAct, isFinanceStaff, signedUrl } from '@/lib/finance'
import { NextRequest, NextResponse } from 'next/server'

const SELECT = `*,
  requester:profiles!payment_requests_requester_id_fkey(id,name,role),
  approver:profiles!payment_requests_approved_by_fkey(id,name),
  project:projects(id,name),
  vendor:vendors(id,name)`

// GET /api/finance/payment-requests/[id]  → detail + events + documents (signed URLs)
export async function GET(_req: NextRequest, ctx: RouteContext<'/api/finance/payment-requests/[id]'>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const { data: req, error } = await supabase.from('payment_requests').select(SELECT).eq('id', id).single()
  if (error || !req) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (req.requester_id !== user.id && !isFinanceStaff(profile?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: events } = await supabase
    .from('payment_events')
    .select('*, actor:profiles!payment_events_actor_id_fkey(id,name)')
    .eq('payment_request_id', id)
    .order('created_at', { ascending: true })

  const { data: docs } = await supabase
    .from('payment_documents').select('*').eq('payment_request_id', id)
    .order('created_at', { ascending: true })

  const documents = await Promise.all(
    (docs ?? []).map(async (d) => ({ ...d, signed_url: await signedUrl(d.url) }))
  )

  return NextResponse.json({ ...req, events: events ?? [], documents })
}

// PATCH /api/finance/payment-requests/[id]  → state machine
// body: { action: 'approve'|'reject'|'clarify'|'pay'|'post'|'cancel', note?, rejected_reason?,
//         bpv_number?, bank_advice_ref?, payment_method? }
export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/finance/payment-requests/[id]'>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const body = await request.json()
  const action: string = body.action
  const { note, rejected_reason, bpv_number, bank_advice_ref, payment_method } = body

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role

  const a = admin()
  const { data: req } = await a.from('payment_requests').select('*').eq('id', id).single()
  if (!req) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const from = req.status
  let patch: Record<string, unknown> = {}
  let toStatus: string = from
  let notifyUser: string | null = null
  let notifyTitle = ''
  let notifyMsg = ''

  const bad = (msg: string, code = 400) => NextResponse.json({ error: msg }, { status: code })

  switch (action) {
    case 'approve': {
      if (!['submitted', 'clarification'].includes(from)) return bad('Only submitted/clarification requests can be approved')
      if (!canAct('approve', req.current_approver_role, role)) return bad('You are not the authorized approver for this amount', 403)
      if (req.requester_id === user.id) return bad('You cannot approve your own request (segregation of duties)', 403)
      patch = { status: 'approved', approved_by: user.id, approved_at: new Date().toISOString() }
      toStatus = 'approved'
      notifyUser = req.requester_id
      notifyTitle = 'Payment request approved'
      notifyMsg = `${req.reference} approved. ${req.requires_check ? 'Pay by check (amount > 30,000).' : ''}`
      break
    }
    case 'reject': {
      if (!['submitted', 'clarification'].includes(from)) return bad('Only submitted/clarification requests can be rejected')
      if (!canAct('reject', req.current_approver_role, role)) return bad('You are not the authorized approver', 403)
      if (req.requester_id === user.id) return bad('You cannot reject your own request', 403)
      patch = { status: 'rejected', approved_by: user.id, rejected_reason: rejected_reason ?? note ?? null }
      toStatus = 'rejected'
      notifyUser = req.requester_id
      notifyTitle = 'Payment request rejected'
      notifyMsg = `${req.reference} was rejected.${rejected_reason ? ` Reason: ${rejected_reason}` : ''}`
      break
    }
    case 'clarify': {
      if (from !== 'submitted') return bad('Only submitted requests can be sent back for clarification')
      if (!canAct('clarify', req.current_approver_role, role)) return bad('Not authorized', 403)
      patch = { status: 'clarification' }
      toStatus = 'clarification'
      notifyUser = req.requester_id
      notifyTitle = 'Clarification requested'
      notifyMsg = `${req.reference}: ${note ?? 'Please clarify this request.'}`
      break
    }
    case 'pay': {
      if (from !== 'approved') return bad('Only approved requests can be paid')
      if (!isFinanceStaff(role)) return bad('Only finance/admin can record payment', 403)
      // Segregation of duties: the approver must not also pay; the requester cannot pay.
      if (req.approved_by === user.id) return bad('The approver cannot also record the payment (segregation of duties)', 403)
      if (req.requester_id === user.id) return bad('The requester cannot record the payment', 403)
      if (req.requires_check && !bpv_number) return bad('A BPV / check number is required for payments over 30,000')
      // NOTE: the DB trigger blocks this if no receipt/invoice/bpv/bank_advice document is attached.
      patch = {
        status: 'paid', paid_by: user.id, paid_at: new Date().toISOString(),
        bpv_number: bpv_number ?? null, bank_advice_ref: bank_advice_ref ?? null,
        payment_method: payment_method ?? req.payment_method ?? null,
      }
      toStatus = 'paid'
      notifyUser = req.requester_id
      notifyTitle = 'Payment made'
      notifyMsg = `${req.reference} has been paid.`
      break
    }
    case 'post': {
      if (from !== 'paid') return bad('Only paid requests can be posted')
      if (!isFinanceStaff(role)) return bad('Only finance/admin can post', 403)
      patch = { status: 'posted', posted_by: user.id, posted_at: new Date().toISOString() }
      toStatus = 'posted'
      break
    }
    case 'cancel': {
      if (!['draft', 'submitted', 'clarification'].includes(from)) return bad('Only draft/submitted/clarification requests can be cancelled')
      if (req.requester_id !== user.id && !isFinanceStaff(role)) return bad('Not authorized to cancel', 403)
      patch = { status: 'cancelled' }
      toStatus = 'cancelled'
      break
    }
    default:
      return bad('Unknown action')
  }

  const { data: updated, error } = await a.from('payment_requests').update(patch).eq('id', id).select(SELECT).single()
  // The receipt-gate trigger raises an exception on 'pay' with no supporting document.
  if (error) {
    const msg = /supporting document/i.test(error.message)
      ? 'Cannot record payment: attach a receipt/invoice/BPV/bank advice first.'
      : error.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  await a.from('payment_events').insert({
    payment_request_id: id, actor_id: user.id, action,
    from_status: from, to_status: toStatus, note: note ?? rejected_reason ?? null,
  })

  if (notifyUser) {
    await a.from('notifications').insert({
      user_id: notifyUser, title: notifyTitle, message: notifyMsg, type: 'task_assigned', task_id: null,
    })
  }

  return NextResponse.json(updated)
}
