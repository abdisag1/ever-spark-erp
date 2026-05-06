'use client'

import { useMemo } from 'react'
import { differenceInDays, format } from 'date-fns'
import { CalendarDays, CheckCircle2, Clock, TrendingUp, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Task, Project } from '@/types'

interface ProjectStat {
  project: Project
  total: number
  done: number
  inProgress: number
  pct: number
  startDate: string | null
  dueDate: string | null
  daysRemaining: number | null
  totalDays: number | null
  isOverdue: boolean
  estimatedDaysToComplete: number | null
}

function buildStats(project: Project, tasks: Task[]): ProjectStat {
  const pts = tasks.filter((t) => t.project_id === project.id && !t.parent_task_id)
  const total = pts.length
  const done = pts.filter((t) => t.status === 'done').length
  const inProgress = pts.filter((t) => t.status === 'in_progress').length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  const starts = pts.map((t) => t.start_date).filter(Boolean) as string[]
  const dues = pts.map((t) => t.due_date).filter(Boolean) as string[]
  const startDate = starts.length ? starts.sort()[0] : null
  const dueDate = dues.length ? dues.sort().at(-1)! : null

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const daysRemaining = dueDate ? differenceInDays(new Date(dueDate), today) : null
  const totalDays =
    startDate && dueDate ? differenceInDays(new Date(dueDate), new Date(startDate)) : null
  const isOverdue = daysRemaining !== null && daysRemaining < 0

  // Estimate days to complete based on current velocity
  let estimatedDaysToComplete: number | null = null
  if (startDate && done > 0) {
    const daysSinceStart = Math.max(differenceInDays(today, new Date(startDate)), 1)
    const tasksPerDay = done / daysSinceStart
    const remaining = total - done
    estimatedDaysToComplete = tasksPerDay > 0 ? Math.ceil(remaining / tasksPerDay) : null
  }

  return { project, total, done, inProgress, pct, startDate, dueDate, daysRemaining, totalDays, isOverdue, estimatedDaysToComplete }
}

function timelineProgress(stat: ProjectStat): number {
  if (!stat.startDate || !stat.dueDate) return 0
  const today = new Date()
  const start = new Date(stat.startDate)
  const due = new Date(stat.dueDate)
  const elapsed = differenceInDays(today, start)
  const total = differenceInDays(due, start)
  if (total <= 0) return 100
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)))
}

// ── Single project card (compact) ────────────────────────────────────────────
function ProjectCard({ stat }: { stat: ProjectStat }) {
  const tlPct = timelineProgress(stat)
  const behindSchedule = stat.pct < tlPct - 10

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 min-w-[220px] flex-1">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: stat.project.color }} />
        <span className="text-sm font-semibold text-slate-900 truncate">{stat.project.name}</span>
        {stat.isOverdue && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 ml-auto" />}
      </div>

      {/* Task completion bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-slate-500">{stat.done}/{stat.total} tasks</span>
          <span className={cn('font-semibold', stat.pct === 100 ? 'text-green-600' : behindSchedule ? 'text-orange-600' : 'text-slate-700')}>
            {stat.pct}%
          </span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', stat.pct === 100 ? 'bg-green-500' : behindSchedule ? 'bg-orange-500' : 'bg-blue-500')}
            style={{ width: `${stat.pct}%` }}
          />
        </div>
      </div>

      {/* Timeline */}
      {(stat.startDate || stat.dueDate) && (
        <div className="text-xs text-slate-400 flex items-center gap-1 mt-2">
          <CalendarDays className="w-3 h-3" />
          {stat.startDate && <span>{format(new Date(stat.startDate), 'MMM d')}</span>}
          {stat.startDate && stat.dueDate && <span>→</span>}
          {stat.dueDate && (
            <span className={cn(stat.isOverdue ? 'text-red-500 font-medium' : '')}>
              {format(new Date(stat.dueDate), 'MMM d')}
            </span>
          )}
          {stat.daysRemaining !== null && (
            <span className={cn('ml-auto font-medium', stat.isOverdue ? 'text-red-500' : stat.daysRemaining <= 7 ? 'text-orange-500' : 'text-slate-500')}>
              {stat.isOverdue ? `${Math.abs(stat.daysRemaining)}d overdue` : `${stat.daysRemaining}d left`}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Expanded view for a single selected project ───────────────────────────────
function ProjectExpanded({ stat }: { stat: ProjectStat }) {
  const tlPct = timelineProgress(stat)
  const behindSchedule = stat.pct < tlPct - 10
  const todo = stat.total - stat.done - stat.inProgress

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className="w-4 h-4 rounded-full" style={{ backgroundColor: stat.project.color }} />
          <span className="font-semibold text-slate-900">{stat.project.name}</span>
          {stat.isOverdue && (
            <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
              <AlertTriangle className="w-3 h-3" /> Overdue
            </span>
          )}
          {stat.pct === 100 && (
            <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3" /> Complete
            </span>
          )}
        </div>
        <span className={cn('text-2xl font-bold', stat.pct === 100 ? 'text-green-600' : behindSchedule ? 'text-orange-600' : 'text-blue-600')}>
          {stat.pct}%
        </span>
      </div>

      {/* Task completion bar */}
      <div className="mb-1">
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', stat.pct === 100 ? 'bg-green-500' : behindSchedule ? 'bg-orange-500' : 'bg-blue-500')}
            style={{ width: `${stat.pct}%` }}
          />
        </div>
      </div>

      {/* Timeline bar (shows how much time has passed) */}
      {stat.startDate && stat.dueDate && (
        <div className="mb-4">
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
            <div className="h-full bg-slate-400 rounded-full" style={{ width: `${tlPct}%` }} />
          </div>
          <div className="flex justify-between text-xs text-slate-400 mt-0.5">
            <span>{format(new Date(stat.startDate), 'MMM d, yyyy')}</span>
            <span className="text-slate-500 font-medium">{tlPct}% of time elapsed</span>
            <span className={cn(stat.isOverdue ? 'text-red-500' : '')}>{format(new Date(stat.dueDate), 'MMM d, yyyy')}</span>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 rounded-lg px-3 py-2.5">
          <p className="text-xs text-slate-400 mb-0.5">Total Tasks</p>
          <p className="text-lg font-bold text-slate-900">{stat.total}</p>
        </div>
        <div className="bg-green-50 rounded-lg px-3 py-2.5">
          <p className="text-xs text-green-600 mb-0.5">Completed</p>
          <p className="text-lg font-bold text-green-700">{stat.done}</p>
        </div>
        <div className="bg-blue-50 rounded-lg px-3 py-2.5">
          <p className="text-xs text-blue-600 mb-0.5">In Progress</p>
          <p className="text-lg font-bold text-blue-700">{stat.inProgress}</p>
        </div>
        <div className={cn('rounded-lg px-3 py-2.5', stat.isOverdue ? 'bg-red-50' : stat.daysRemaining !== null && stat.daysRemaining <= 7 ? 'bg-orange-50' : 'bg-slate-50')}>
          <p className={cn('text-xs mb-0.5', stat.isOverdue ? 'text-red-500' : stat.daysRemaining !== null && stat.daysRemaining <= 7 ? 'text-orange-500' : 'text-slate-400')}>
            {stat.isOverdue ? 'Overdue by' : 'Days Left'}
          </p>
          <p className={cn('text-lg font-bold', stat.isOverdue ? 'text-red-600' : stat.daysRemaining !== null && stat.daysRemaining <= 7 ? 'text-orange-600' : 'text-slate-900')}>
            {stat.daysRemaining !== null ? Math.abs(stat.daysRemaining) : '—'}
          </p>
        </div>
      </div>

      {/* Estimate */}
      {stat.estimatedDaysToComplete !== null && stat.pct < 100 && (
        <div className={cn('mt-3 flex items-center gap-2 text-xs rounded-lg px-3 py-2', behindSchedule ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700')}>
          <TrendingUp className="w-3.5 h-3.5 shrink-0" />
          {behindSchedule
            ? `At current pace, the project needs ~${stat.estimatedDaysToComplete} more days — consider reassigning tasks.`
            : `At current pace, estimated ~${stat.estimatedDaysToComplete} more days to completion.`}
        </div>
      )}
    </div>
  )
}

// ── Public export ─────────────────────────────────────────────────────────────
interface ProjectStatsProps {
  tasks: Task[]
  projects: Project[]
  selectedProjectId: string | null
}

export function ProjectStats({ tasks, projects, selectedProjectId }: ProjectStatsProps) {
  const stats = useMemo(
    () => projects.map((p) => buildStats(p, tasks)),
    [tasks, projects]
  )

  if (projects.length === 0) return null

  if (selectedProjectId) {
    const stat = stats.find((s) => s.project.id === selectedProjectId)
    if (!stat || stat.total === 0) return null
    return <ProjectExpanded stat={stat} />
  }

  // All projects — show mini cards for projects that have tasks
  const withTasks = stats.filter((s) => s.total > 0)
  if (withTasks.length === 0) return null

  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <TrendingUp className="w-3.5 h-3.5" /> Project Overview
      </p>
      <div className="flex gap-3 overflow-x-auto pb-1 kanban-scroll">
        {withTasks.map((stat) => (
          <ProjectCard key={stat.project.id} stat={stat} />
        ))}
      </div>
    </div>
  )
}
