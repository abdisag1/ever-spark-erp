import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/social/[id]'>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const body = await request.json()

  // Fetch current post to check existing task linkage
  const { data: current } = await supabase
    .from('social_posts')
    .select('scheduled_time, scheduled_task_id, title, content')
    .eq('id', id)
    .single()

  const newScheduledTime: string | null = body.scheduled_time ?? current?.scheduled_time ?? null
  const oldTaskId: string | null = current?.scheduled_task_id ?? null
  let newTaskId = oldTaskId

  const scheduledDateChanged = newScheduledTime !== current?.scheduled_time

  if (scheduledDateChanged) {
    if (newScheduledTime) {
      const dueDate = newScheduledTime.split('T')[0]
      const taskTitle = (body.title ?? current?.title) ? `Post: ${body.title ?? current?.title}` : 'LinkedIn Post'
      const contentPreview = (body.content ?? current?.content ?? '').substring(0, 300)

      if (oldTaskId) {
        // Update existing task
        await supabase.from('tasks').update({
          title: taskTitle,
          description: `Scheduled LinkedIn post.\n\n${contentPreview}`,
          due_date: dueDate,
          start_date: dueDate,
          updated_at: new Date().toISOString(),
        }).eq('id', oldTaskId)
      } else {
        // Create new task
        const { data: task } = await supabase
          .from('tasks')
          .insert({
            title: taskTitle,
            description: `Scheduled LinkedIn post.\n\n${contentPreview}`,
            status: 'todo',
            priority: 'medium',
            due_date: dueDate,
            start_date: dueDate,
            assignee_id: user.id,
          })
          .select('id')
          .single()
        newTaskId = task?.id ?? null
      }
    } else {
      // Schedule removed — delete the linked task
      if (oldTaskId) {
        await supabase.from('tasks').delete().eq('id', oldTaskId)
        newTaskId = null
      }
    }
  }

  const updatePayload = {
    ...body,
    scheduled_task_id: newTaskId,
    status: body.status ?? (newScheduledTime ? 'scheduled' : 'draft'),
    updated_at: new Date().toISOString(),
  }

  let { data, error } = await supabase
    .from('social_posts')
    .update(updatePayload)
    .eq('id', id)
    .select('*, author:profiles!social_posts_author_id_fkey(id, name)')
    .single()

  // New columns not added yet — retry with base fields only
  if (error && (error.message.includes('column') || error.message.includes('schema cache'))) {
    const { title: _t, image_url: _i, image_caption: _c, scheduled_task_id: _s, ...baseBody } = updatePayload
    const fallback = await supabase
      .from('social_posts')
      .update(baseBody)
      .eq('id', id)
      .select('*, author:profiles!social_posts_author_id_fkey(id, name)')
      .single()
    data = fallback.data
    error = fallback.error
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<'/api/social/[id]'>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params

  // Delete the linked calendar task if it exists
  const { data: post } = await supabase
    .from('social_posts')
    .select('scheduled_task_id')
    .eq('id', id)
    .single()

  if (post?.scheduled_task_id) {
    await supabase.from('tasks').delete().eq('id', post.scheduled_task_id)
  }

  const { error } = await supabase.from('social_posts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
