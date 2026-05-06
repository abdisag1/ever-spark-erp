import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { CalendarView } from '@/components/calendar/CalendarView'
import type { Profile } from '@/types'

export default async function CalendarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: tasks }, { data: profiles }] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, title, status, priority, due_date, assignee_id, assignee:profiles!tasks_assignee_id_fkey(id, name)')
      .not('due_date', 'is', null)
      .order('due_date', { ascending: true }),
    supabase
      .from('profiles')
      .select('id, name, role')
      .order('name'),
  ])

  return (
    <div>
      <Header
        title="Calendar"
        description="View tasks and deadlines by due date — filter by assignee"
      />
      <CalendarView
        tasks={(tasks as never[]) ?? []}
        profiles={(profiles as Profile[]) ?? []}
        currentUserId={user?.id ?? ''}
      />
    </div>
  )
}
