import { createClient } from '@/lib/supabase/server'
import { admin } from '@/lib/finance'
import { NextRequest, NextResponse } from 'next/server'

const SELECT = `*,
  requester:profiles!payment_requests_requester_id_fkey(id,name,role),
  approver:profiles!payment_requests_approved_by_fkey(id,name),
  project:projects(id,name),
  vendor:vendors(id,name)`

// GET /api/finance/payment-requests?status=submitted
// Requesters see their own; finance/admin see all.
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isStaff = profile?.role === 'finance' || profile?.role === 'admin'

  const status = request.nextUrl.searchParams.get('status')
  let query = supabase.from('payment_requests').select(SELECT).order('created_at', { ascending: false })
  if (!isStaff) query = query.eq('requester_id', user.id)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/finance/payment-requests  → creates a submitted request.
// reference / requires_check / current_approver_role are set by the DB trigger.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    amount, purpose, vendor_id, project_id, cost_center_id,
    coa_code, payment_method, is_project_related,
  } = body

  if (typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
  }
  if (!purpose || typeof purpose !== 'string') {
    return NextResponse.json({ error: 'purpose is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('payment_requests')
    .insert({
      requester_id: user.id,
      amount,
      purpose,
      vendor_id: vendor_id ?? null,
      project_id: project_id ?? null,
      cost_center_id: cost_center_id ?? null,
      coa_code: coa_code ?? null,
      payment_method: payment_method ?? null,
      is_project_related: !!is_project_related,
      status: 'submitted',
      source_channel: 'web',
    })
    .select(SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Side effects via service-role client (audit trail + notify approvers).
  const a = admin()
  await a.from('payment_events').insert({
    payment_request_id: data.id,
    actor_id: user.id,
    action: 'submitted',
    to_status: 'submitted',
    note: `Requested ${data.currency} ${Number(amount).toLocaleString()} — ${purpose}`,
  })

  const { data: approvers } = await a.from('profiles')
    .select('id').eq('role', data.current_approver_role).eq('status', 'active')
  if (approvers?.length) {
    await a.from('notifications').insert(
      approvers.map((p: { id: string }) => ({
        user_id: p.id,
        title: 'Payment approval needed',
        message: `${data.reference}: ${data.currency} ${Number(amount).toLocaleString()} — ${purpose}`,
        type: 'task_assigned',
        task_id: null,
      }))
    )
  }

  return NextResponse.json(data, { status: 201 })
}
