import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

async function getProfileRole(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).single()
  return data?.role ?? null
}

export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/leads/[id]'>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const body = await request.json()

  // Check ownership — admins bypass, others can only update their own leads
  const role = await getProfileRole(supabase, user.id)
  if (role !== 'admin') {
    const { data: lead } = await supabase.from('leads').select('created_by').eq('id', id).single()
    if (lead?.created_by && lead.created_by !== user.id) {
      return NextResponse.json({ error: 'You can only edit leads you created' }, { status: 403 })
    }
  }

  const { data, error } = await supabase
    .from('leads')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<'/api/leads/[id]'>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params

  // Check ownership
  const role = await getProfileRole(supabase, user.id)
  if (role !== 'admin') {
    const { data: lead } = await supabase.from('leads').select('created_by').eq('id', id).single()
    if (lead?.created_by && lead.created_by !== user.id) {
      return NextResponse.json({ error: 'You can only delete leads you created' }, { status: 403 })
    }
  }

  const { error } = await supabase.from('leads').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
