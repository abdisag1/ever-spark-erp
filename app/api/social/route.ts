import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('social_posts')
    .select('*, author:profiles!social_posts_author_id_fkey(id, name)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, content, image_url, image_caption, scheduled_time, platform } = await request.json()
  if (!content) return NextResponse.json({ error: 'Content required' }, { status: 400 })

  const isScheduled = !!scheduled_time
  let scheduledTaskId: string | null = null

  // If scheduled, create a calendar task for the post date
  if (isScheduled) {
    const dueDate = scheduled_time.split('T')[0]
    const taskTitle = title ? `Post: ${title}` : `LinkedIn Post`
    const { data: task } = await supabase
      .from('tasks')
      .insert({
        title: taskTitle,
        description: `Scheduled LinkedIn post.\n\n${content.substring(0, 300)}${content.length > 300 ? '…' : ''}`,
        status: 'todo',
        priority: 'medium',
        due_date: dueDate,
        start_date: dueDate,
        assignee_id: user.id,
      })
      .select('id')
      .single()

    if (task) scheduledTaskId = task.id
  }

  const fullInsert = {
    title: title || null,
    content,
    image_url: image_url || null,
    image_caption: image_caption || null,
    scheduled_time: scheduled_time || null,
    scheduled_task_id: scheduledTaskId,
    platform: platform ?? 'linkedin',
    status: isScheduled ? 'scheduled' : 'draft',
    author_id: user.id,
  }

  let { data, error } = await supabase
    .from('social_posts')
    .insert(fullInsert)
    .select('*, author:profiles!social_posts_author_id_fkey(id, name)')
    .single()

  // If new columns don't exist yet, fall back to base fields only
  if (error && (error.message.includes('column') || error.message.includes('schema cache'))) {
    const fallback = await supabase
      .from('social_posts')
      .insert({
        content,
        scheduled_time: scheduled_time || null,
        platform: platform ?? 'linkedin',
        status: isScheduled ? 'scheduled' : 'draft',
        author_id: user.id,
      })
      .select('*, author:profiles!social_posts_author_id_fkey(id, name)')
      .single()
    data = fallback.data
    error = fallback.error
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
