import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const BUCKET = 'email-attachments'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function ensureBucket() {
  const admin = getAdminClient()
  const { data: buckets } = await admin.storage.listBuckets()
  const exists = buckets?.some((b) => b.name === BUCKET)
  if (!exists) {
    await admin.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 10485760 })
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 })
  }

  // Auto-create the bucket if it doesn't exist yet
  await ensureBucket()

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
  const storagePath = `${user.id}/${Date.now()}-${safeName}`

  const admin = getAdminClient()
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: file.type, upsert: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = admin.storage
    .from(BUCKET)
    .getPublicUrl(storagePath)

  return NextResponse.json({
    url: publicUrl,
    name: file.name,
    size: file.size,
    type: file.type,
  }, { status: 201 })
}
