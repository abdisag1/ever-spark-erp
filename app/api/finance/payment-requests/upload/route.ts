import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { storageAdmin, ensurePaymentBucket, PAYMENT_BUCKET } from '@/lib/finance-storage'

const ALLOWED = [
  'application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/heic',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

// POST — upload a receipt/proforma to the PRIVATE bucket; returns the storage path.
// The caller then attaches it to a request via /payment-requests/[id]/documents.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const requestId = (formData.get('request_id') as string | null) || 'unassigned'
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: 'Only PDF, Word and image files are allowed' }, { status: 400 })
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 })
  }

  const admin = storageAdmin()
  await ensurePaymentBucket(admin)

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
  const storagePath = `${requestId}/${user.id}/${Date.now()}-${safeName}`

  const { error } = await admin.storage
    .from(PAYMENT_BUCKET)
    .upload(storagePath, buffer, { contentType: file.type })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Private bucket → return the path, not a public URL. Served later via signed URLs.
  return NextResponse.json({ path: storagePath, name: file.name, size: file.size }, { status: 201 })
}
