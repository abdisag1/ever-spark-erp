'use client'

import { useState } from 'react'
import { Pencil, Trash2, CalendarDays, ChevronUp, ChevronDown } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { Badge, priorityVariant, statusVariant } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import type { Task, Project, Milestone, Profile } from '@/types'

type SortCol = 'title' | 'priority' | 'status' | 'due_date' | 'start_date'
const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

const selectCls =
  'px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'

function SortIcon({ col, sortCol, sortDir }: { col: SortCol; sortCol: SortCol; sortDir: 'asc' | 'desc' }) {
  if (sortCol !== col) return <ChevronUp className="w-3 h-3 text-slate-300" />
  return sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
}

interface TaskTableViewProps {
  tasks: Task[]
  projects: Project[]
  milestones: Milestone[]
  profiles: Profile[]
  currentUserId: string
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
}

export function TaskTableView({ tasks, projects, milestones, profiles, currentUserId, onEdit, onDelete }: TaskTableViewProps) {
  const [filterProject, setFilterProject] = useState('')
  const [filterMilestone, setFilterMilestone] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterAssignee, setFilterAssignee] = useState('')
  const [sortCol, setSortCol] = useState<SortCol>('due_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const availableMilestones = milestones.filter(
    (m) => !filterProject || m.project_id === filterProject
  )

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortCol(col); setSortDir('asc') }
  }

  const filtered = tasks
    .filter((t) => !t.parent_task_id)
    .filter((t) => !filterProject || t.project_id === filterProject)
    .filter((t) => !filterMilestone || t.milestone_id === filterMilestone)
    .filter((t) => !filterStatus || t.status === filterStatus)
    .filter((t) => !filterPriority || t.priority === filterPriority)
    .filter((t) => !filterAssignee || t.assignee_id === filterAssignee)
    .sort((a, b) => {
      let cmp = 0
      if (sortCol === 'priority') cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      else if (sortCol === 'status') cmp = a.status.localeCompare(b.status)
      else if (sortCol === 'title') cmp = a.title.localeCompare(b.title)
      else if (sortCol === 'due_date') cmp = (a.due_date ?? '9999') < (b.due_date ?? '9999') ? -1 : 1
      else if (sortCol === 'start_date') cmp = (a.start_date ?? '9999') < (b.start_date ?? '9999') ? -1 : 1
      return sortDir === 'asc' ? cmp : -cmp
    })

  const hasFilters = filterProject || filterMilestone || filterStatus || filterPriority || filterAssignee

  function clearFilters() {
    setFilterProject('')
    setFilterMilestone('')
    setFilterStatus('')
    setFilterPriority('')
    setFilterAssignee('')
  }

  function ThCell({ col, children }: { col: SortCol; children: React.ReactNode }) {
    return (
      <th
        onClick={() => handleSort(col)}
        className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer hover:text-slate-800 select-none whitespace-nowrap"
      >
        <div className="flex items-center gap-1">
          {children}
          <SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
        </div>
      </th>
    )
  }

  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <select
          value={filterProject}
          onChange={(e) => { setFilterProject(e.target.value); setFilterMilestone('') }}
          className={selectCls}
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <select
          value={filterMilestone}
          onChange={(e) => setFilterMilestone(e.target.value)}
          className={cn(selectCls, !filterProject && 'opacity-50 cursor-not-allowed')}
          disabled={!filterProject}
        >
          <option value="">All Milestones</option>
          {availableMilestones.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>

        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selectCls}>
          <option value="">All Statuses</option>
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="review">Review</option>
          <option value="done">Done</option>
        </select>

        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className={selectCls}>
          <option value="">All Priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)} className={selectCls}>
          <option value="">All Assignees</option>
          {currentUserId && <option value={currentUserId}>Me</option>}
          {profiles
            .filter((p) => p.id !== currentUserId)
            .map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
        </select>

        {hasFilters && (
          <button onClick={clearFilters} className="text-xs text-slate-400 hover:text-red-500 transition-colors">
            Clear filters
          </button>
        )}

        <span className="ml-auto text-xs text-slate-400">
          {filtered.length} task{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <ThCell col="title">Task</ThCell>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Project · Milestone
                </th>
                <ThCell col="priority">Priority</ThCell>
                <ThCell col="status">Status</ThCell>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Assignee
                </th>
                <ThCell col="start_date">Start</ThCell>
                <ThCell col="due_date">Due</ThCell>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-400">
                    {hasFilters ? 'No tasks match the current filters.' : 'No tasks yet — create one above.'}
                  </td>
                </tr>
              )}
              {filtered.map((task) => {
                const isOverdue =
                  task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done'
                return (
                  <tr key={task.id} className="hover:bg-slate-50 transition-colors group">
                    {/* Title */}
                    <td className="px-4 py-3 max-w-[220px]">
                      <div className="font-medium text-slate-900 truncate">{task.title}</div>
                      {task.description && (
                        <div className="text-xs text-slate-400 truncate mt-0.5">{task.description}</div>
                      )}
                    </td>

                    {/* Project + Milestone */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {task.project ? (
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: task.project.color }}
                          />
                          <span className="text-xs font-medium text-slate-700">{task.project.name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300">No project</span>
                      )}
                      {task.milestone && (
                        <div className="text-xs text-slate-400 mt-0.5 ml-3.5">{task.milestone.name}</div>
                      )}
                    </td>

                    {/* Priority */}
                    <td className="px-4 py-3">
                      <Badge variant={priorityVariant(task.priority)}>{task.priority}</Badge>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(task.status)}>
                        {task.status.replace('_', ' ')}
                      </Badge>
                    </td>

                    {/* Assignee */}
                    <td className="px-4 py-3">
                      {task.assignee ? (
                        <div className="flex items-center gap-1.5">
                          <Avatar name={task.assignee.name} size="sm" />
                          <span className="text-xs text-slate-600">{task.assignee.name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>

                    {/* Start Date */}
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {task.start_date ? formatDate(task.start_date) : <span className="text-slate-300">—</span>}
                    </td>

                    {/* Due Date */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {task.due_date ? (
                        <div className={cn('flex items-center gap-1 text-xs', isOverdue ? 'text-red-500 font-medium' : 'text-slate-500')}>
                          {isOverdue && <CalendarDays className="w-3 h-3" />}
                          {formatDate(task.due_date)}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onEdit(task)}
                          title="Edit"
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-500 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDelete(task.id)}
                          title="Delete"
                          className="p-1.5 rounded hover:bg-red-50 text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
