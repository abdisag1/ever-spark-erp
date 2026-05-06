'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import type { Task, TaskStatus, Project, Milestone, Profile } from '@/types'

const COLORS = ['#3b82f6','#8b5cf6','#10b981','#f97316','#ef4444','#ec4899','#06b6d4','#84cc16']

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']),
  status: z.enum(['todo', 'in_progress', 'review', 'done']),
  start_date: z.string().optional(),
  due_date: z.string().optional(),
  assignee_id: z.string().optional(),
  project_id: z.string().optional(),
  milestone_id: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface TaskFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: Record<string, unknown>) => Promise<void>
  initialStatus?: TaskStatus
  initialParentTaskId?: string | null
  task?: Task
  projects: Project[]
  milestones: Milestone[]
  profiles: Profile[]
  onProjectCreated: (project: Project) => void
  onMilestoneCreated: (milestone: Milestone) => void
}

export function TaskForm({
  open, onClose, onSubmit, initialStatus = 'todo', initialParentTaskId,
  task, projects, milestones, profiles, onProjectCreated, onMilestoneCreated,
}: TaskFormProps) {
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, watch, setValue } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: task
      ? { title: task.title, description: task.description ?? '', priority: task.priority, status: task.status, start_date: task.start_date ?? '', due_date: task.due_date ?? '', assignee_id: task.assignee_id ?? '', project_id: task.project_id ?? '', milestone_id: task.milestone_id ?? '' }
      : { priority: 'medium', status: initialStatus, project_id: '', milestone_id: '' },
  })

  const selectedProjectId = watch('project_id')
  const filteredMilestones = milestones.filter((m) => m.project_id === selectedProjectId)

  // New project inline creation
  const [showNewProject, setShowNewProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectColor, setNewProjectColor] = useState(COLORS[0])
  const [creatingProject, setCreatingProject] = useState(false)

  // New milestone inline creation
  const [showNewMilestone, setShowNewMilestone] = useState(false)
  const [newMilestoneName, setNewMilestoneName] = useState('')
  const [newMilestoneDue, setNewMilestoneDue] = useState('')
  const [creatingMilestone, setCreatingMilestone] = useState(false)

  useEffect(() => {
    if (open) {
      reset(task
        ? { title: task.title, description: task.description ?? '', priority: task.priority, status: task.status, start_date: task.start_date ?? '', due_date: task.due_date ?? '', assignee_id: task.assignee_id ?? '', project_id: task.project_id ?? '', milestone_id: task.milestone_id ?? '' }
        : { priority: 'medium', status: initialStatus, project_id: '', milestone_id: '' }
      )
      setShowNewProject(false)
      setShowNewMilestone(false)
    }
  }, [open, task])

  useEffect(() => {
    setValue('milestone_id', '')
  }, [selectedProjectId])

  async function createProject() {
    if (!newProjectName.trim()) return
    setCreatingProject(true)
    const res = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newProjectName.trim(), color: newProjectColor }) })
    if (res.ok) {
      const p: Project = await res.json()
      onProjectCreated(p)
      setValue('project_id', p.id)
      setNewProjectName('')
      setShowNewProject(false)
    }
    setCreatingProject(false)
  }

  async function createMilestone() {
    if (!newMilestoneName.trim() || !selectedProjectId) return
    setCreatingMilestone(true)
    const res = await fetch('/api/milestones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project_id: selectedProjectId, name: newMilestoneName.trim(), due_date: newMilestoneDue || null }) })
    if (res.ok) {
      const m: Milestone = await res.json()
      onMilestoneCreated(m)
      setValue('milestone_id', m.id)
      setNewMilestoneName('')
      setShowNewMilestone(false)
    }
    setCreatingMilestone(false)
  }

  async function submit(data: FormData) {
    await onSubmit({
      ...data,
      project_id: data.project_id || null,
      milestone_id: data.milestone_id || null,
      assignee_id: data.assignee_id || null,
      start_date: data.start_date || null,
      due_date: data.due_date || null,
      parent_task_id: initialParentTaskId ?? null,
    })
    reset()
    onClose()
  }

  const label = (text: string) => (
    <label className="block text-xs font-medium text-slate-600 mb-1">{text}</label>
  )
  const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  const selectCls = `${inputCls} bg-white`

  return (
    <Modal open={open} onClose={onClose} title={task ? 'Edit Task' : initialParentTaskId ? 'Add Subtask' : 'New Task'} size="md">
      <form onSubmit={handleSubmit(submit)} className="p-5 space-y-4">

        {/* Title */}
        <div>
          {label('Title *')}
          <input {...register('title')} placeholder="What needs to be done?" className={inputCls} />
          {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}
        </div>

        {/* Description */}
        <div>
          {label('Description')}
          <textarea {...register('description')} rows={2} placeholder="Details…" className={`${inputCls} resize-none`} />
        </div>

        {/* Project */}
        {!initialParentTaskId && (
          <div>
            {label('Project')}
            {!showNewProject ? (
              <div className="flex gap-2">
                <select {...register('project_id')} className={`${selectCls} flex-1`}>
                  <option value="">No project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button type="button" onClick={() => setShowNewProject(true)} className="px-3 py-2 text-xs text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 whitespace-nowrap">
                  + New
                </button>
              </div>
            ) : (
              <div className="space-y-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex gap-2">
                  <input value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="Project name" className={`${inputCls} flex-1`} />
                  <div className="flex gap-1">
                    {COLORS.map((c) => (
                      <button key={c} type="button" onClick={() => setNewProjectColor(c)}
                        className={`w-6 h-6 rounded-full border-2 ${newProjectColor === c ? 'border-slate-700 scale-110' : 'border-transparent'} transition-all`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setShowNewProject(false)} className="text-xs text-slate-500 hover:text-slate-700">Cancel</button>
                  <button type="button" onClick={createProject} disabled={creatingProject || !newProjectName.trim()} className="text-xs font-medium text-white bg-blue-600 px-3 py-1 rounded-lg disabled:opacity-50">
                    {creatingProject ? 'Creating…' : 'Create'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Milestone */}
        {!initialParentTaskId && selectedProjectId && (
          <div>
            {label('Milestone')}
            {!showNewMilestone ? (
              <div className="flex gap-2">
                <select {...register('milestone_id')} className={`${selectCls} flex-1`}>
                  <option value="">No milestone</option>
                  {filteredMilestones.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}{m.due_date ? ` (${m.due_date})` : ''}</option>
                  ))}
                </select>
                <button type="button" onClick={() => setShowNewMilestone(true)} className="px-3 py-2 text-xs text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 whitespace-nowrap">
                  + New
                </button>
              </div>
            ) : (
              <div className="space-y-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <input value={newMilestoneName} onChange={(e) => setNewMilestoneName(e.target.value)} placeholder="Milestone name" className={inputCls} />
                <input type="date" value={newMilestoneDue} onChange={(e) => setNewMilestoneDue(e.target.value)} className={inputCls} />
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setShowNewMilestone(false)} className="text-xs text-slate-500 hover:text-slate-700">Cancel</button>
                  <button type="button" onClick={createMilestone} disabled={creatingMilestone || !newMilestoneName.trim()} className="text-xs font-medium text-white bg-blue-600 px-3 py-1 rounded-lg disabled:opacity-50">
                    {creatingMilestone ? 'Creating…' : 'Create'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Priority + Status */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            {label('Priority')}
            <select {...register('priority')} className={selectCls}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            {label('Status')}
            <select {...register('status')} className={selectCls}>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="review">Review</option>
              <option value="done">Done</option>
            </select>
          </div>
        </div>

        {/* Assignee */}
        <div>
          {label('Assignee')}
          <select {...register('assignee_id')} className={selectCls}>
            <option value="">Unassigned</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            {label('Start Date')}
            <input type="date" {...register('start_date')} className={inputCls} />
          </div>
          <div>
            {label('Due Date')}
            <input type="date" {...register('due_date')} className={inputCls} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : task ? 'Save changes' : initialParentTaskId ? 'Add Subtask' : 'Create task'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
