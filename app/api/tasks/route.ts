import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const FULL_SELECT = `
  *,
  assignee:profiles!tasks_assignee_id_fkey(id, name, role),
  project:projects!tasks_project_id_fkey(id, name, color),
  milestone:milestones!tasks_milestone_id_fkey(id, name)
`
const BASIC_SELECT = '*, assignee:profiles!tasks_assignee_id_fkey(id, name, role)'

function isFkError(msg: string) {
  return msg.includes('relationship') || msg.includes('schema cache') || msg.includes('does not exist')
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('tasks')
    .select(FULL_SELECT)
    .order('position', { ascending: true })
    .order('created_at', { ascending: false })

  if (!error) return NextResponse.json(data)

  if (isFkError(error.message)) {
    const { data: basic, error: e2 } = await supabase
      .from('tasks')
      .select(BASIC_SELECT)
      .order('position', { ascending: true })
      .order('created_at', { ascending: false })
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
    return NextResponse.json(basic)
  }

  return NextResponse.json({ error: error.message }, { status: 500 })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    title, description, assignee_id, priority, status,
    start_date, due_date, project_id, milestone_id, parent_task_id,
  } = body

  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

  // Try inserting with all new columns + full select
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title,
      description: description || null,
      assignee_id: assignee_id || null,
      priority: priority ?? 'medium',
      status: status ?? 'todo',
      start_date: start_date || null,
      due_date: due_date || null,
      project_id: project_id || null,
      milestone_id: milestone_id || null,
      parent_task_id: parent_task_id || null,
    })
    .select(FULL_SELECT)
    .single()

  if (!error) {
    // Notify the assignee if it's someone else
    if (assignee_id && assignee_id !== user.id) {
      await supabase.from('notifications').insert({
        user_id: assignee_id,
        title: 'New task assigned',
        message: `You have been assigned "${title}"${due_date ? ` — due ${due_date}` : ''}`,
        type: 'task_assigned',
        task_id: data.id,
      })
    }
    return NextResponse.json(data, { status: 201 })
  }

  // New columns not added yet — fall back to inserting only base fields
  if (isFkError(error.message)) {
    const { data: basic, error: e2 } = await supabase
      .from('tasks')
      .insert({
        title,
        description: description || null,
        assignee_id: assignee_id || null,
        priority: priority ?? 'medium',
        status: status ?? 'todo',
        due_date: due_date || null,
      })
      .select(BASIC_SELECT)
      .single()
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
    return NextResponse.json(basic, { status: 201 })
  }

  return NextResponse.json({ error: error.message }, { status: 500 })
}
