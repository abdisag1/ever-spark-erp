import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  Users,
  CheckSquare,
  Clock,
  Target,
  ArrowRight,
  Plus,
} from 'lucide-react'
import { DashboardGreeting } from '@/components/dashboard/DashboardGreeting'
import type { Lead, Task } from '@/types'

const FUNNEL_LABEL: Record<string, string> = {
  lead: 'Lead',
  appointment: 'Appointment',
  presentation: 'Presentation',
  sale: 'Sale',
}

const FUNNEL_COLOR: Record<string, string> = {
  lead: 'bg-slate-100 text-slate-700',
  appointment: 'bg-blue-50 text-blue-700',
  presentation: 'bg-purple-50 text-purple-700',
  sale: 'bg-green-50 text-green-700',
}

const TASK_STATUS_COLOR: Record<string, string> = {
  todo: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-blue-50 text-blue-700',
  review: 'bg-purple-50 text-purple-700',
  done: 'bg-green-50 text-green-700',
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconBg,
}: {
  label: string
  value: number | string
  sub?: string
  icon: React.ElementType
  iconBg: string
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', user.id)
    .single()

  const [{ data: leadsData }, { data: tasksData }] = await Promise.all([
    supabase
      .from('leads')
      .select('id, name, organization, funnel_status, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('tasks')
      .select('id, title, status, priority, due_date')
      .neq('status', 'done')
      .order('due_date', { ascending: true }),
  ])

  const leads = (leadsData ?? []) as Pick<
    Lead,
    'id' | 'name' | 'organization' | 'funnel_status' | 'created_at'
  >[]
  const openTasks = (tasksData ?? []) as Pick<
    Task,
    'id' | 'title' | 'status' | 'priority' | 'due_date'
  >[]

  const totalLeads = leads.length
  const salesCount = leads.filter((l) => l.funnel_status === 'sale').length
  const openTaskCount = openTasks.length

  const todayStr = new Date().toISOString().split('T')[0]
  const dueToday = openTasks.filter((t) => t.due_date?.startsWith(todayStr)).length
  const overdueTasks = openTasks.filter(
    (t) => t.due_date && t.due_date < todayStr
  ).length

  const recentLeads = leads.slice(0, 6)
  const upcomingTasks = openTasks.filter((t) => t.due_date).slice(0, 6)

  const conversionRate =
    totalLeads > 0 ? `${Math.round((salesCount / totalLeads) * 100)}% win rate` : 'No leads yet'

  const firstName = profile?.name?.split(' ')[0] ?? 'there'

  return (
    <div>
      <DashboardGreeting firstName={firstName} />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Leads"
          value={totalLeads}
          sub={`${salesCount} closed won`}
          icon={Users}
          iconBg="bg-blue-50 text-blue-600"
        />
        <StatCard
          label="Open Tasks"
          value={openTaskCount}
          sub={overdueTasks > 0 ? `${overdueTasks} overdue` : 'All on track'}
          icon={CheckSquare}
          iconBg="bg-indigo-50 text-indigo-600"
        />
        <StatCard
          label="Due Today"
          value={dueToday}
          sub="tasks requiring action"
          icon={Clock}
          iconBg={dueToday > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'}
        />
        <StatCard
          label="Win Rate"
          value={`${totalLeads > 0 ? Math.round((salesCount / totalLeads) * 100) : 0}%`}
          sub={conversionRate}
          icon={Target}
          iconBg="bg-green-50 text-green-600"
        />
      </div>

      {/* Two-column content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Leads */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900">Recent Leads</h2>
            <Link
              href="/dashboard/leads"
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
            >
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="divide-y divide-slate-50">
            {recentLeads.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-400">
                No leads yet.{' '}
                <Link href="/dashboard/leads" className="text-blue-600 hover:underline">
                  Add your first lead
                </Link>
              </div>
            ) : (
              recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-600 shrink-0">
                    {lead.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{lead.name}</p>
                    {lead.organization && (
                      <p className="text-xs text-slate-400 truncate">{lead.organization}</p>
                    )}
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${FUNNEL_COLOR[lead.funnel_status]}`}
                  >
                    {FUNNEL_LABEL[lead.funnel_status]}
                  </span>
                </div>
              ))
            )}
          </div>

          {recentLeads.length > 0 && (
            <div className="px-5 py-3 border-t border-slate-100">
              <Link
                href="/dashboard/leads"
                className="flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-600 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add new lead
              </Link>
            </div>
          )}
        </div>

        {/* Upcoming Tasks */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900">Upcoming Tasks</h2>
            <Link
              href="/dashboard/tasks"
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
            >
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="divide-y divide-slate-50">
            {upcomingTasks.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-400">
                No upcoming tasks.{' '}
                <Link href="/dashboard/tasks" className="text-blue-600 hover:underline">
                  Create a task
                </Link>
              </div>
            ) : (
              upcomingTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-3 px-5 py-3">
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      task.priority === 'high'
                        ? 'bg-red-500'
                        : task.priority === 'medium'
                        ? 'bg-amber-500'
                        : 'bg-slate-300'
                    }`}
                  />
                  <p className="text-sm text-slate-700 flex-1 truncate">{task.title}</p>
                  {task.due_date && (
                    <span className="text-xs text-slate-400 shrink-0">
                      {new Date(task.due_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  )}
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${TASK_STATUS_COLOR[task.status]}`}
                  >
                    {task.status.replace('_', ' ')}
                  </span>
                </div>
              ))
            )}
          </div>

          {upcomingTasks.length > 0 && (
            <div className="px-5 py-3 border-t border-slate-100">
              <Link
                href="/dashboard/tasks"
                className="flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-600 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add new task
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
