import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

async function checkOwnership(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, projectId: string) {
  const [{ data: profile }, { data: project }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', userId).single(),
    supabase.from('projects').select('created_by').eq('id', projectId).single(),
  ])
  if (profile?.role === 'admin') return true
  if (!project?.created_by) return true  // legacy
  return project.created_by === userId
}

export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/projects/[id]'>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params

  if (!await checkOwnership(supabase, user.id, id)) {
    return NextResponse.json({ error: 'You can only edit projects you created' }, { status: 403 })
  }

  const body = await request.json()
  const { data, error } = await supabase
    .from('projects')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<'/api/projects/[id]'>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params

  if (!await checkOwnership(supabase, user.id, id)) {
    return NextResponse.json({ error: 'You can only delete projects you created' }, { status: 403 })
  }

  const { error } = await supabase.from('projects').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
