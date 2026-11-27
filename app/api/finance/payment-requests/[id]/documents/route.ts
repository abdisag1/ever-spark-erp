import { createClient } from '@/lib/supabase/server'
import { admin, isFinanceStaff, signedUrl } from '@/lib/finance'
import { NextRequest, NextResponse } from 'next/server'

const DOC_KINDS = ['proforma', 'invoice', 'receipt', 'grn', 'pra', 'bpv', 'bank_advice', 'contract', 'other']

// GET → list documents for a request (with signed URLs)
export async function GET(_req: NextRequest, ctx: RouteContext<'/api/finance/payment-requests/[id]/documents'>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const { data: docs, error } = await supabase
    .from('payment_documents').select('*').eq('payment_request_id', id)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const withUrls = await Promise.all((docs ?? []).map(async (d) => ({ ...d, signed_url: await signedUrl(d.url) })))
  return NextResponse.json(withUrls)
}

// POST { kind, path, file_name } → attach an uploaded file to the request
export async function POST(request: NextRequest, ctx: RouteContext<'/api/finance/payment-requests/[id]/documents'>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const { kind, path, file_name } = await request.json()
  if (!DOC_KINDS.includes(kind)) return NextResponse.json({ error: 'Invalid document kind' }, { status: 400 })
  if (!path || !file_name) return NextResponse.json({ error: 'path and file_name are required' }, { status: 400 })

  const a = admin()
  const { data: req } = await a.from('payment_requests').select('requester_id, status, reference').eq('id', id).single()
  if (!req) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (req.requester_id !== user.id && !isFinanceStaff(profile?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (['posted', 'cancelled', 'rejected'].includes(req.status)) {
    return NextResponse.json({ error: `Cannot attach documents to a ${req.status} request` }, { status: 400 })
  }

  const { data, error } = await a.from('payment_documents')
    .insert({ payment_request_id: id, kind, url: path, file_name, uploaded_by: user.id })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await a.from('payment_events').insert({
    payment_request_id: id, actor_id: user.id, action: 'document_added',
    note: `Added ${kind}: ${file_name}`,
  })

  return NextResponse.json({ ...data, signed_url: await signedUrl(data.url) }, { status: 201 })
}
