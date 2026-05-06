import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/settings/users/[id]'>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify caller is admin
  const { data: self } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (self?.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can update user roles' }, { status: 403 })
  }

  const { id } = await ctx.params
  const { role, status } = await request.json()

  const update: Record<string, unknown> = {}
  if (role   !== undefined) update.role   = role
  if (status !== undefined) update.status = status

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  // Use service role client to bypass RLS — admins must be able to edit any profile
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin
    .from('profiles')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify the user when their account is approved
  if (status === 'active') {
    await supabase.from('notifications').insert({
      user_id: id,
      title: 'Account approved',
      message: `Your account has been approved! You now have ${role ?? data.role} access to Ever Spark CRM.`,
      type: 'task_assigned',
      task_id: null,
    })
  }

  return NextResponse.json(data)
}
