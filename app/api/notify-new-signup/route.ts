import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: requester } = await supabase
    .from('profiles')
    .select('name, status')
    .eq('id', user.id)
    .single()

  // Only notify if user is actually pending (avoid repeated calls)
  if (requester?.status !== 'pending') return NextResponse.json({ skipped: true })

  // Find all admins to notify
  const { data: admins } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .eq('status', 'active')

  if (!admins?.length) return NextResponse.json({ notified: 0 })

  const requesterName = requester?.name ?? user.email ?? 'Someone'

  const notifications = admins.map((admin) => ({
    user_id: admin.id,
    title: 'New signup request',
    message: `${requesterName} has signed up and is waiting for approval. Go to Settings → Team to review.`,
    type: 'task_assigned' as const, // reuse existing type for now
    task_id: null,
  }))

  await supabase.from('notifications').insert(notifications)

  return NextResponse.json({ notified: admins.length })
}
