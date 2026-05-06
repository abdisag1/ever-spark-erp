import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/tasks/[id]'>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const { data, error } = await supabase
    .from('tasks')
    .select('*, assignee:profiles!tasks_assignee_id_fkey(id, name, role), comments:task_comments(*, author:profiles!task_comments_author_id_fkey(id, name))')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/tasks/[id]'>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const body = await request.json()

  // Fetch previous assignee to detect reassignment
  const { data: prev } = await supabase
    .from('tasks')
    .select('assignee_id, title, due_date')
    .eq('id', id)
    .single()

  const { data, error } = await supabase
    .from('tasks')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify new assignee if it changed and is someone else
  const newAssigneeId = body.assignee_id ?? data.assignee_id
  if (newAssigneeId && newAssigneeId !== user.id && newAssigneeId !== prev?.assignee_id) {
    const taskTitle = data.title ?? prev?.title ?? 'a task'
    const dueDate   = data.due_date ?? prev?.due_date
    await supabase.from('notifications').insert({
      user_id: newAssigneeId,
      title: 'Task assigned to you',
      message: `You have been assigned "${taskTitle}"${dueDate ? ` — due ${dueDate}` : ''}`,
      type: 'task_assigned',
      task_id: id,
    })
  }

  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<'/api/tasks/[id]'>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
