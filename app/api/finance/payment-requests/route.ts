import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { createPaymentRequest, PR_SELECT } from '@/lib/finance-actions'

// GET — list payment requests. RLS scopes the rows: a requester sees their own,
// finance/admin see all.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('payment_requests')
    .select(PR_SELECT)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST — create a new (submitted) payment request via the shared action module.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

  const amount = Number(body.amount)
  if (!amount || amount <= 0) {
    return NextResponse.json({ error: 'Amount must be greater than zero' }, { status: 400 })
  }
  if (!body.purpose?.trim()) {
    return NextResponse.json({ error: 'Purpose is required' }, { status: 400 })
  }

  try {
    const pr = await createPaymentRequest({
      requesterId: user.id,
      amount,
      currency: body.currency || 'ETB',
      purpose: body.purpose,
      vendorId: body.vendor_id ?? null,
      projectId: body.project_id ?? null,
      costCenterId: body.cost_center_id ?? null,
      coaCode: body.coa_code ?? null,
      paymentMethod: body.payment_method ?? null,
      isProjectRelated: body.is_project_related ?? !!body.project_id,
      sourceChannel: 'web',
    })
    return NextResponse.json(pr, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to create payment request'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
