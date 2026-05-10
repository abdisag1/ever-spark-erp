'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Badge, priorityVariant } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { CalendarDays, MessageSquare, MoreVertical, Pencil, Trash2, Flag } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Task } from '@/types'
import { useState } from 'react'

interface TaskCardProps {
  task: Task
  subtaskCount: number
  completedSubtaskCount: number
  canEdit: boolean
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
  onClick: (task: Task) => void
}

function formatShortDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function TaskCard({ task, subtaskCount, completedSubtaskCount, canEdit, onEdit, onDelete, onClick }: TaskCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done'
  const subtaskPct = subtaskCount > 0 ? Math.round((completedSubtaskCount / subtaskCount) * 100) : null

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      {...attributes}
      {...listeners}
      className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-sm cursor-grab active:cursor-grabbing hover:border-blue-300 transition-colors select-none"
      onClick={() => onClick(task)}
    >
      {/* Project + Milestone row */}
      {(task.project || task.milestone) && (
        <div className="flex items-center gap-1.5 mb-2">
          {task.project && (
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: task.project.color }} />
              <span className="text-xs text-slate-500 font-medium truncate max-w-[100px]">{task.project.name}</span>
            </div>
          )}
          {task.milestone && (
            <>
              {task.project && <span className="text-slate-300 text-xs">·</span>}
              <div className="flex items-center gap-1">
                <Flag className="w-3 h-3 text-slate-400" />
                <span className="text-xs text-slate-400 truncate max-w-[80px]">{task.milestone.name}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Title + menu */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-slate-900 flex-1 leading-snug">{task.title}</p>
        <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setMenuOpen((o) => !o)}
            className="p-1 rounded hover:bg-slate-100 text-slate-400"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
          {menuOpen && canEdit && (
            <div className="absolute right-0 top-6 z-10 bg-white border border-slate-200 rounded-lg shadow-lg py-1 w-32">
              <button onPointerDown={(e) => e.stopPropagation()} onClick={() => { onEdit(task); setMenuOpen(false) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50">
                <Pencil className="w-3 h-3" /> Edit
              </button>
              <button onPointerDown={(e) => e.stopPropagation()} onClick={() => { onDelete(task.id); setMenuOpen(false) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50">
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {task.description && (
        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{task.description}</p>
      )}

      {/* Priority + dates */}
      <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
        <Badge variant={priorityVariant(task.priority)}>{task.priority}</Badge>
        {(task.start_date || task.due_date) && (
          <div className={cn('flex items-center gap-1 text-xs', isOverdue ? 'text-red-500' : 'text-slate-400')}>
            <CalendarDays className="w-3 h-3" />
            {task.start_date && task.due_date
              ? `${formatShortDate(task.start_date)} → ${formatShortDate(task.due_date)}`
              : task.due_date
              ? formatShortDate(task.due_date)
              : formatShortDate(task.start_date!)}
          </div>
        )}
      </div>

      {/* Subtask progress bar */}
      {subtaskCount > 0 && (
        <div className="mt-2.5" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-400">{completedSubtaskCount}/{subtaskCount} subtasks</span>
            <span className={cn('font-medium', subtaskPct === 100 ? 'text-green-600' : 'text-slate-500')}>
              {subtaskPct}%
            </span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-300', subtaskPct === 100 ? 'bg-green-500' : 'bg-blue-500')}
              style={{ width: `${subtaskPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer: assignee + comments */}
      {(task.assignee || (task.comments && task.comments.length > 0)) && (
        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
          {task.assignee && (
            <div className="flex items-center gap-1.5">
              <Avatar name={task.assignee.name} size="sm" />
              <span className="text-xs text-slate-500">{task.assignee.name}</span>
            </div>
          )}
          {task.comments && task.comments.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-slate-400 ml-auto">
              <MessageSquare className="w-3 h-3" />
              {task.comments.length}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
