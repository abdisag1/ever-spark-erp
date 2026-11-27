import { createClient } from '@/lib/supabase/server'
import { ensurePaymentBucket, PAYMENT_BUCKET, ALLOWED_DOC_TYPES } from '@/lib/finance'
import { NextRequest, NextResponse } from 'next/server'

// POST (FormData: file) → uploads to the PRIVATE receipt bucket and returns the storage PATH.
// The client then calls /documents with { kind, path, file_name } to link it to a request.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (!ALLOWED_DOC_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Only PDF, Word, and image files are allowed' }, { status: 400 })
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 })
  }

  const admin = await ensurePaymentBucket()
  const buffer = Buffer.from(await file.arrayBuffer())
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
  const path = `${user.id}/${Date.now()}-${safeName}`

  const { error } = await admin.storage.from(PAYMENT_BUCKET).upload(path, buffer, { contentType: file.type })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Private bucket → return the path, not a public URL. Served later via signed URL.
  return NextResponse.json({ path, file_name: file.name, size: file.size }, { status: 201 })
}
