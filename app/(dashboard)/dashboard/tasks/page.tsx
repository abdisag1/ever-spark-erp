import { createClient } from '@/lib/supabase/server'
import { TaskBoard } from '@/components/tasks/TaskBoard'
import { Header } from '@/components/layout/Header'
import type { Task, Project, Milestone, Profile } from '@/types'

function isFkError(msg: string) {
  return msg.includes('relationship') || msg.includes('schema cache') || msg.includes('does not exist')
}

export default async function TasksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch tasks — try full join first, fall back if FK columns not yet added
  let tasks: Task[] = []
  {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        assignee:profiles!tasks_assignee_id_fkey(id, name, role),
        project:projects!tasks_project_id_fkey(id, name, color),
        milestone:milestones!tasks_milestone_id_fkey(id, name)
      `)
      .order('position', { ascending: true })
      .order('created_at', { ascending: false })

    if (!error) {
      tasks = (data as Task[]) ?? []
    } else if (isFkError(error.message)) {
      const { data: basic } = await supabase
        .from('tasks')
        .select('*, assignee:profiles!tasks_assignee_id_fkey(id, name, role)')
        .order('position', { ascending: true })
        .order('created_at', { ascending: false })
      tasks = (basic as Task[]) ?? []
    }
  }

  let projects: Project[] = []
  {
    const { data } = await supabase.from('projects').select('*').eq('status', 'active').order('name')
    projects = (data as Project[]) ?? []
  }

  let milestones: Milestone[] = []
  {
    const { data } = await supabase.from('milestones').select('*').order('due_date', { ascending: true })
    milestones = (data as Milestone[]) ?? []
  }

  const [{ data: profiles }, { data: selfProfile }] = await Promise.all([
    supabase.from('profiles').select('id, name, role').order('name'),
    supabase.from('profiles').select('role').eq('id', user!.id).single(),
  ])

  return (
    <div>
      <Header
        title="Task Board"
        description="Manage projects, milestones, and tasks — filter by project, milestone, or assignee"
      />
      <TaskBoard
        initialTasks={tasks}
        projects={projects}
        milestones={milestones}
        profiles={(profiles as Profile[]) ?? []}
        currentUserId={user?.id ?? ''}
        isAdmin={selfProfile?.role === 'admin'}
      />
    </div>
  )
}
