'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Plus, Trash2, Flag, CalendarDays, ListChecks, Check } from 'lucide-react'
import { Badge, priorityVariant, statusVariant } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { formatDate, formatDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Task, TaskComment, TaskStatus } from '@/types'
import { toast } from 'sonner'

interface TaskDetailProps {
  task: Task | null
  subtasks: Task[]
  onClose: () => void
  onAddSubtask: (parentTask: Task) => void
  onSubtaskDeleted: (id: string) => void
  onSubtaskToggled: (id: string, newStatus: TaskStatus) => void
}

export function TaskDetail({ task, subtasks, onClose, onAddSubtask, onSubtaskDeleted, onSubtaskToggled }: TaskDetailProps) {
  const [comments, setComments] = useState<TaskComment[]>([])
  const [newComment, setNewComment] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!task) return
    fetch(`/api/task-comments/${task.id}`)
      .then((r) => r.json())
      .then(setComments)
      .catch(() => {})
  }, [task])

  async function sendComment() {
    if (!task || !newComment.trim()) return
    setSending(true)
    const res = await fetch(`/api/task-comments/${task.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newComment }),
    })
    if (res.ok) {
      const comment: TaskComment = await res.json()
      setComments((c) => [...c, comment])
      setNewComment('')
    } else {
      toast.error('Failed to post comment')
    }
    setSending(false)
  }

  async function deleteSubtask(id: string) {
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    if (res.ok) { onSubtaskDeleted(id); toast.success('Subtask deleted') }
    else toast.error('Failed to delete subtask')
  }

  async function toggleSubtask(sub: Task) {
    const newStatus: TaskStatus = sub.status === 'done' ? 'todo' : 'done'
    const res = await fetch(`/api/tasks/${sub.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      onSubtaskToggled(sub.id, newStatus)
    } else {
      toast.error('Failed to update subtask')
    }
  }

  const doneSubs = subtasks.filter((s) => s.status === 'done').length
  const totalSubs = subtasks.length
  const subPct = totalSubs > 0 ? Math.round((doneSubs / totalSubs) * 100) : null

  return (
    <AnimatePresence>
      {task && (
        <div className="fixed inset-0 z-40 flex">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/30" onClick={onClose} />
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="relative ml-auto w-full max-w-md bg-white shadow-xl flex flex-col h-full"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900 truncate flex-1 mr-4">{task.title}</h2>
              <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">

              {/* Status + Priority */}
              <div className="flex flex-wrap gap-2">
                <Badge variant={priorityVariant(task.priority)}>{task.priority} priority</Badge>
                <Badge variant={statusVariant(task.status)}>{task.status.replace('_', ' ')}</Badge>
              </div>

              {/* Project + Milestone */}
              {(task.project || task.milestone) && (
                <div className="flex flex-wrap gap-3">
                  {task.project && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: task.project.color }} />
                      <span className="text-sm font-medium text-slate-700">{task.project.name}</span>
                    </div>
                  )}
                  {task.milestone && (
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Flag className="w-3.5 h-3.5" />
                      <span className="text-sm">{task.milestone.name}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Description */}
              {task.description && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Description</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{task.description}</p>
                </div>
              )}

              {/* Dates + Assignee */}
              <div className="grid grid-cols-2 gap-4">
                {(task.start_date || task.due_date) && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Timeline</p>
                    <div className="flex items-center gap-1.5 text-sm text-slate-700">
                      <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                      {task.start_date && <span>{formatDate(task.start_date)}</span>}
                      {task.start_date && task.due_date && <span className="text-slate-400">→</span>}
                      {task.due_date && (
                        <span className={cn(new Date(task.due_date) < new Date() && task.status !== 'done' ? 'text-red-500' : '')}>
                          {formatDate(task.due_date)}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {task.assignee && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Assignee</p>
                    <div className="flex items-center gap-2">
                      <Avatar name={task.assignee.name} size="sm" />
                      <span className="text-sm text-slate-700">{task.assignee.name}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Subtasks */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                      <ListChecks className="w-3.5 h-3.5" /> Subtasks
                    </p>
                    {subPct !== null && (
                      <span className={cn('text-xs font-semibold px-1.5 py-0.5 rounded-full',
                        subPct === 100 ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-700')}>
                        {doneSubs}/{totalSubs} · {subPct}%
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => onAddSubtask(task)}
                    className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium"
                  >
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>

                {/* Progress bar */}
                {subPct !== null && (
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500', subPct === 100 ? 'bg-green-500' : 'bg-blue-500')}
                      style={{ width: `${subPct}%` }}
                    />
                  </div>
                )}

                {subtasks.length === 0 ? (
                  <p className="text-xs text-slate-400">No subtasks yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {subtasks.map((sub) => {
                      const isDone = sub.status === 'done'
                      return (
                        <div key={sub.id} className="flex items-center gap-2.5 p-2.5 bg-slate-50 rounded-lg group hover:bg-slate-100 transition-colors">
                          {/* Checkbox */}
                          <button
                            onClick={() => toggleSubtask(sub)}
                            className={cn(
                              'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                              isDone
                                ? 'bg-green-500 border-green-500'
                                : 'border-slate-300 hover:border-blue-400 bg-white'
                            )}
                          >
                            {isDone && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                          </button>

                          {/* Title */}
                          <span className={cn('text-sm flex-1 truncate', isDone ? 'line-through text-slate-400' : 'text-slate-700')}>
                            {sub.title}
                          </span>

                          {/* Assignee */}
                          {sub.assignee && <Avatar name={sub.assignee.name} size="sm" />}

                          {/* Delete on hover */}
                          <button
                            onClick={() => deleteSubtask(sub.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded text-red-400 transition-all"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Comments */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                  Comments ({comments.length})
                </p>
                <div className="space-y-3">
                  {comments.map((c) => (
                    <div key={c.id} className="flex gap-2.5">
                      {c.author && <Avatar name={c.author.name} size="sm" />}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-700">{c.author?.name}</span>
                          <span className="text-xs text-slate-400">{formatDateTime(c.created_at)}</span>
                        </div>
                        <p className="text-sm text-slate-600 mt-0.5">{c.content}</p>
                      </div>
                    </div>
                  ))}
                  {comments.length === 0 && <p className="text-xs text-slate-400">No comments yet.</p>}
                </div>
              </div>
            </div>

            {/* Comment input */}
            <div className="border-t border-slate-100 px-5 py-3">
              <div className="flex gap-2">
                <input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment() } }}
                  placeholder="Add a comment…"
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={sendComment}
                  disabled={sending || !newComment.trim()}
                  className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
