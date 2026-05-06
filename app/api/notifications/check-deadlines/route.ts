import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date().toISOString().split('T')[0]
  const todayStart = `${today}T00:00:00.000Z`

  // Fetch tasks that are due today or overdue, assigned to current user, not done
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, due_date')
    .eq('assignee_id', user.id)
    .lte('due_date', today)
    .neq('status', 'done')

  if (!tasks?.length) return NextResponse.json({ created: 0 })

  let created = 0
  for (const task of tasks) {
    const isOverdue = task.due_date < today

    // Check if we already sent this notification today (avoid duplicates)
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('task_id', task.id)
      .eq('user_id', user.id)
      .in('type', ['task_due', 'task_overdue'])
      .gte('created_at', todayStart)
      .maybeSingle()

    if (!existing) {
      await supabase.from('notifications').insert({
        user_id: user.id,
        title: isOverdue ? 'Task overdue' : 'Task due today',
        message: isOverdue
          ? `"${task.title}" is overdue — it was due on ${task.due_date}`
          : `"${task.title}" is due today`,
        type: isOverdue ? 'task_overdue' : 'task_due',
        task_id: task.id,
      })
      created++
    }
  }

  return NextResponse.json({ created })
}
