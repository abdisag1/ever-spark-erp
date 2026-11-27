import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { attachDocument } from '@/lib/finance-actions'
import { storageAdmin, signDocuments } from '@/lib/finance-storage'
import type { DocumentKind, PaymentDocument } from '@/types/finance'

const KINDS: DocumentKind[] = [
  'proforma', 'invoice', 'receipt', 'grn', 'pra', 'bpv', 'bank_advice', 'contract', 'other',
]

// GET — list a request's documents, each with a signed URL.
export async function GET(_request: NextRequest, ctx: RouteContext<'/api/finance/payment-requests/[id]/documents'>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const { data, error } = await supabase
    .from('payment_documents')
    .select('*, uploader:profiles!payment_documents_uploaded_by_fkey(id, name)')
    .eq('payment_request_id', id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const signed = await signDocuments(storageAdmin(), (data as PaymentDocument[]) ?? [])
  return NextResponse.json(signed)
}

// POST — attach a document (expects a storage path already produced by /upload).
export async function POST(request: NextRequest, ctx: RouteContext<'/api/finance/payment-requests/[id]/documents'>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params

  // Verify the caller can see the parent request (RLS-scoped read).
  const { data: pr } = await supabase.from('payment_requests').select('id').eq('id', id).single()
  if (!pr) return NextResponse.json({ error: 'Payment request not found' }, { status: 404 })

  const body = await request.json().catch(() => null)
  const kind = body?.kind as DocumentKind
  const url = body?.url as string
  const fileName = body?.file_name as string

  if (!kind || !KINDS.includes(kind)) {
    return NextResponse.json({ error: `kind must be one of: ${KINDS.join(', ')}` }, { status: 400 })
  }
  if (!url || !fileName) {
    return NextResponse.json({ error: 'url and file_name are required' }, { status: 400 })
  }

  try {
    await attachDocument({ requestId: id, kind, url, fileName, uploadedBy: user.id })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to attach document'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
