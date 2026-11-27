import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { performAction, PR_SELECT } from '@/lib/finance-actions'
import { storageAdmin, signDocuments } from '@/lib/finance-storage'
import type { PaymentAction, PaymentDocument } from '@/types/finance'

const ACTIONS: PaymentAction[] = ['approve', 'reject', 'clarify', 'pay', 'post', 'cancel']

// GET — detail + events + documents (with signed URLs).
export async function GET(_request: NextRequest, ctx: RouteContext<'/api/finance/payment-requests/[id]'>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params

  const { data: request, error } = await supabase
    .from('payment_requests')
    .select(PR_SELECT)
    .eq('id', id)
    .single()

  if (error || !request) return NextResponse.json({ error: 'Payment request not found' }, { status: 404 })

  const [{ data: events }, { data: documents }] = await Promise.all([
    supabase
      .from('payment_events')
      .select('*, actor:profiles!payment_events_actor_id_fkey(id, name)')
      .eq('payment_request_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('payment_documents')
      .select('*, uploader:profiles!payment_documents_uploaded_by_fkey(id, name)')
      .eq('payment_request_id', id)
      .order('created_at', { ascending: true }),
  ])

  const signed = await signDocuments(storageAdmin(), (documents as PaymentDocument[]) ?? [])

  return NextResponse.json({ ...request, events: events ?? [], documents: signed })
}

// PATCH — run the action machine (approve|reject|clarify|pay|post|cancel).
export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/finance/payment-requests/[id]'>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })

  const { id } = await ctx.params
  const body = await request.json().catch(() => null)
  const action = body?.action as PaymentAction

  if (!action || !ACTIONS.includes(action)) {
    return NextResponse.json({ error: `action must be one of: ${ACTIONS.join(', ')}` }, { status: 400 })
  }

  const result = await performAction({
    requestId: id,
    actorId: user.id,
    actorRole: profile.role,
    action,
    reason: body?.reason ?? null,
    bpvNumber: body?.bpv_number ?? null,
    bankAdviceRef: body?.bank_advice_ref ?? null,
    paymentMethod: body?.payment_method ?? null,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 400 })
  }
  return NextResponse.json(result.request)
}
