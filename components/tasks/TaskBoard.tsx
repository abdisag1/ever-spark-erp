'use client'

import { useState, useMemo } from 'react'
import {
  DndContext, DragEndEvent, DragOverEvent,
  PointerSensor, useSensor, useSensors, closestCorners, DragOverlay,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { Plus, LayoutGrid, CalendarDays, List, Flag, X, FolderPlus, User } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { TaskCard } from './TaskCard'
import { TaskForm } from './TaskForm'
import { TaskDetail } from './TaskDetail'
import { TaskTableView } from './TaskTableView'
import { ProjectStats } from './ProjectStats'
import { CalendarView } from '@/components/calendar/CalendarView'
import type { Task, TaskStatus, Project, Milestone, Profile } from '@/types'

const COLORS = ['#3b82f6','#8b5cf6','#10b981','#f97316','#ef4444','#ec4899','#06b6d4','#84cc16']

const COLUMNS: { status: TaskStatus; label: string; color: string; header: string; dot: string }[] = [
  { status: 'todo',        label: 'To Do',      color: 'border-slate-400',  header: 'bg-slate-50 text-slate-700',   dot: 'bg-slate-400' },
  { status: 'in_progress', label: 'In Progress', color: 'border-blue-400',   header: 'bg-blue-50 text-blue-700',     dot: 'bg-blue-400' },
  { status: 'review',      label: 'Review',      color: 'border-yellow-400', header: 'bg-yellow-50 text-yellow-700', dot: 'bg-yellow-400' },
  { status: 'done',        label: 'Done',        color: 'border-green-400',  header: 'bg-green-50 text-green-700',   dot: 'bg-green-400' },
]

function Column({ status, label, color, header, dot, tasks, subtaskCounts, completedSubtaskCounts, canEdit, onAdd, onEdit, onDelete, onView }: {
  status: TaskStatus; label: string; color: string; header: string; dot: string
  tasks: Task[]; subtaskCounts: Map<string, number>; completedSubtaskCounts: Map<string, number>
  canEdit: (t: Task) => boolean
  onAdd: () => void; onEdit: (t: Task) => void; onDelete: (id: string) => void; onView: (t: Task) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <div className={cn('flex flex-col w-72 shrink-0 rounded-xl border-t-4 bg-slate-50', color, isOver && 'ring-2 ring-blue-300')}>
      <div className={cn('flex items-center justify-between px-3 py-2.5 rounded-t-lg', header)}>
        <div className="flex items-center gap-2">
          <div className={cn('w-2 h-2 rounded-full', dot)} />
          <span className="text-sm font-semibold">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium bg-white/60 px-1.5 py-0.5 rounded-full">{tasks.length}</span>
          <button onClick={onAdd} className="p-0.5 rounded hover:bg-white/60 transition-colors"><Plus className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      <div ref={setNodeRef} className="flex-1 p-2 space-y-2 min-h-[200px] overflow-y-auto">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} subtaskCount={subtaskCounts.get(t.id) ?? 0} completedSubtaskCount={completedSubtaskCounts.get(t.id) ?? 0} canEdit={canEdit(t)} onEdit={onEdit} onDelete={onDelete} onClick={onView} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="flex items-center justify-center h-20 text-xs text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">Drop here</div>
        )}
      </div>
    </div>
  )
}

// ─── Project modal ──────────────────────────────────────────────────────────
function ProjectModal({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: (p: Project) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), description: description || null, color }),
    })
    if (res.ok) {
      onCreated(await res.json())
      setName(''); setDescription(''); setColor(COLORS[0])
      onClose()
      toast.success('Project created')
    } else {
      const body = await res.json().catch(() => ({}))
      toast.error(body?.error ?? 'Failed to create project')
    }
    setSaving(false)
  }

  return (
    <Modal open={open} onClose={onClose} title="New Project" size="sm">
      <div className="p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Project name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Solar Installation Q3" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Optional description" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">Color</label>
          <div className="flex gap-2 flex-wrap">
            {COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)}
                className={cn('w-7 h-7 rounded-full border-2 transition-all', color === c ? 'border-slate-700 scale-110' : 'border-transparent hover:scale-105')}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !name.trim()}>{saving ? 'Creating…' : 'Create Project'}</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Milestone modal ─────────────────────────────────────────────────────────
function MilestoneModal({ open, onClose, projects, onCreated }: {
  open: boolean; onClose: () => void; projects: Project[]; onCreated: (m: Milestone) => void
}) {
  const [projectId, setProjectId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!projectId || !name.trim()) return
    setSaving(true)
    const res = await fetch('/api/milestones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, name: name.trim(), description: description || null, due_date: dueDate || null }),
    })
    if (res.ok) {
      onCreated(await res.json())
      setProjectId(''); setName(''); setDescription(''); setDueDate('')
      onClose()
      toast.success('Milestone created')
    } else {
      const body = await res.json().catch(() => ({}))
      toast.error(body?.error ?? 'Failed to create milestone')
    }
    setSaving(false)
  }

  const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <Modal open={open} onClose={onClose} title="New Milestone" size="sm">
      <div className="p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Project *</label>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={`${inputCls} bg-white`}>
            <option value="">Select a project…</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Milestone name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Phase 1 Complete" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Optional" className={`${inputCls} resize-none`} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Target date</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !projectId || !name.trim()}>{saving ? 'Creating…' : 'Create Milestone'}</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Main board ──────────────────────────────────────────────────────────────
interface TaskBoardProps {
  initialTasks: Task[]
  projects: Project[]
  milestones: Milestone[]
  profiles: Profile[]
  currentUserId: string
  isAdmin: boolean
}

export function TaskBoard({ initialTasks, projects: ip, milestones: im, profiles, currentUserId, isAdmin }: TaskBoardProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [projects, setProjects] = useState<Project[]>(ip)
  const [milestones, setMilestones] = useState<Milestone[]>(im)
  const [view, setView] = useState<'kanban' | 'calendar' | 'table'>('kanban')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formStatus, setFormStatus] = useState<TaskStatus>('todo')
  const [formParentId, setFormParentId] = useState<string | null>(null)
  const [editingTask, setEditingTask] = useState<Task | undefined>()
  const [viewingTask, setViewingTask] = useState<Task | null>(null)
  const [projectModalOpen, setProjectModalOpen] = useState(false)
  const [milestoneModalOpen, setMilestoneModalOpen] = useState(false)
  const [filterAssigneeId, setFilterAssigneeId] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const projectMilestones = milestones.filter((m) => m.project_id === selectedProjectId)

  const rootTasks = useMemo(() =>
    tasks
      .filter((t) => !t.parent_task_id)
      .filter((t) => !selectedProjectId || t.project_id === selectedProjectId)
      .filter((t) => !selectedMilestoneId || t.milestone_id === selectedMilestoneId)
      .filter((t) => !filterAssigneeId || t.assignee_id === filterAssigneeId),
    [tasks, selectedProjectId, selectedMilestoneId, filterAssigneeId]
  )

  const subtaskCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of tasks) {
      if (t.parent_task_id) map.set(t.parent_task_id, (map.get(t.parent_task_id) ?? 0) + 1)
    }
    return map
  }, [tasks])

  const completedSubtaskCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of tasks) {
      if (t.parent_task_id && t.status === 'done')
        map.set(t.parent_task_id, (map.get(t.parent_task_id) ?? 0) + 1)
    }
    return map
  }, [tasks])

  const viewingSubtasks = useMemo(() =>
    viewingTask ? tasks.filter((t) => t.parent_task_id === viewingTask.id) : [],
    [tasks, viewingTask]
  )

  async function handleToggleSubtask(id: string, newStatus: TaskStatus) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t)))
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return
    const activeId = active.id as string; const overId = over.id as string
    const activeTask = rootTasks.find((t) => t.id === activeId)
    if (!activeTask) return
    const overIsCol = COLUMNS.some((c) => c.status === overId)
    const newStatus = overIsCol ? (overId as TaskStatus) : (rootTasks.find((t) => t.id === overId)?.status ?? activeTask.status)
    if (activeTask.status !== newStatus)
      setTasks((prev) => prev.map((t) => (t.id === activeId ? { ...t, status: newStatus } : t)))
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const activeId = active.id as string; const overId = over.id as string
    const activeTask = rootTasks.find((t) => t.id === activeId)
    if (!activeTask) return
    const overIsCol = COLUMNS.some((c) => c.status === overId)
    const newStatus = overIsCol ? (overId as TaskStatus) : (rootTasks.find((t) => t.id === overId)?.status ?? activeTask.status)
    if (!overIsCol) {
      setTasks((prev) => {
        const col = prev.filter((t) => t.status === newStatus && !t.parent_task_id)
        const oi = col.findIndex((t) => t.id === activeId); const ni = col.findIndex((t) => t.id === overId)
        if (oi === -1 || ni === -1 || oi === ni) return prev
        return [...prev.filter((t) => t.status !== newStatus || t.parent_task_id), ...arrayMove(col, oi, ni)]
      })
    }
    try {
      await fetch(`/api/tasks/${activeId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) })
    } catch { toast.error('Failed to save') }
  }

  async function handleCreate(data: Record<string, unknown>) {
    const res = await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, status: data.status ?? formStatus }) })
    if (!res.ok) { const b = await res.json().catch(() => ({})); toast.error(b?.error ?? 'Failed to create task'); return }
    const t: Task = await res.json()
    setTasks((prev) => [...prev, t])
    toast.success(t.parent_task_id ? 'Subtask added' : 'Task created')
  }

  async function handleUpdate(data: Record<string, unknown>) {
    if (!editingTask) return
    const res = await fetch(`/api/tasks/${editingTask.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    if (!res.ok) { toast.error('Failed to update task'); return }
    const updated: Task = await res.json()
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    toast.success('Task updated')
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Failed to delete task'); return }
    setTasks((prev) => prev.filter((t) => t.id !== id && t.parent_task_id !== id))
    toast.success('Task deleted')
  }

  /** True if the current user can edit/delete this task */
  function canEdit(task: Task): boolean {
    if (isAdmin) return true
    if (!task.created_by) return true // legacy task with no creator
    return task.created_by === currentUserId
  }

  function openNew(status: TaskStatus, parentId: string | null = null) {
    setFormStatus(status); setFormParentId(parentId); setEditingTask(undefined); setFormOpen(true)
  }

  function openEdit(task: Task) {
    setEditingTask(task); setFormParentId(null); setFormOpen(true)
  }

  function selectProject(id: string | null) {
    setSelectedProjectId(id); setSelectedMilestoneId(null)
  }

  const viewBtn = (v: typeof view, icon: React.ReactNode, label: string) => (
    <button
      onClick={() => setView(v)}
      className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
        view === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
    >
      {icon}{label}
    </button>
  )

  return (
    <>
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          {viewBtn('kanban',   <LayoutGrid className="w-3.5 h-3.5" />,   'Kanban')}
          {viewBtn('calendar', <CalendarDays className="w-3.5 h-3.5" />, 'Calendar')}
          {viewBtn('table',    <List className="w-3.5 h-3.5" />,         'Table')}
        </div>
        <div className="flex items-center gap-2 flex-wrap ml-auto">
          <button
            onClick={() => setProjectModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Project</span>
          </button>
          <button
            onClick={() => setMilestoneModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Flag className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Milestone</span>
          </button>
          <button
            onClick={() => openNew('todo')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-colors"
            style={{ background: 'var(--color-primary)' }}
          >
            <Plus className="w-3.5 h-3.5" /> New Task
          </button>
        </div>
      </div>

      {/* ── Project / Milestone filter (Kanban + Calendar only) ── */}
      {view !== 'table' && (
        <div className="flex overflow-x-auto items-center gap-2 mb-4 pb-1 kanban-scroll">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 font-medium">Project:</span>
            <button onClick={() => selectProject(null)} className={cn('px-2.5 py-1 text-xs rounded-full font-medium transition-colors', !selectedProjectId ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>All</button>
            {projects.map((p) => (
              <button key={p.id} onClick={() => selectProject(selectedProjectId === p.id ? null : p.id)}
                className={cn('flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full font-medium transition-colors', selectedProjectId === p.id ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
                style={selectedProjectId === p.id ? { backgroundColor: p.color } : {}}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: selectedProjectId === p.id ? 'rgba(255,255,255,0.7)' : p.color }} />
                {p.name}
              </button>
            ))}
          </div>

          {selectedProjectId && projectMilestones.length > 0 && (
            <>
              <span className="text-slate-300 text-sm">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400 font-medium flex items-center gap-1"><Flag className="w-3 h-3" /> Milestone:</span>
                <button onClick={() => setSelectedMilestoneId(null)} className={cn('px-2.5 py-1 text-xs rounded-full font-medium transition-colors', !selectedMilestoneId ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>All</button>
                {projectMilestones.map((m) => (
                  <button key={m.id} onClick={() => setSelectedMilestoneId(selectedMilestoneId === m.id ? null : m.id)}
                    className={cn('px-2.5 py-1 text-xs rounded-full font-medium transition-colors', selectedMilestoneId === m.id ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Assignee filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(selectedProjectId || selectedMilestoneId) && <span className="text-slate-300 text-sm">|</span>}
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
              <User className="w-3 h-3" /> Assignee:
            </span>
            <button
              onClick={() => setFilterAssigneeId(null)}
              className={cn('px-2.5 py-1 text-xs rounded-full font-medium transition-colors',
                !filterAssigneeId ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
            >
              All
            </button>
            <button
              onClick={() => setFilterAssigneeId(filterAssigneeId === currentUserId ? null : currentUserId)}
              className={cn('px-2.5 py-1 text-xs rounded-full font-medium transition-colors',
                filterAssigneeId === currentUserId ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100')}
            >
              Me
            </button>
            {profiles.filter((p) => p.id !== currentUserId).map((p) => (
              <button
                key={p.id}
                onClick={() => setFilterAssigneeId(filterAssigneeId === p.id ? null : p.id)}
                className={cn('flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full font-medium transition-colors',
                  filterAssigneeId === p.id ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
              >
                <Avatar name={p.name} size="sm" />
                {p.name.split(' ')[0]}
              </button>
            ))}
          </div>

          {(selectedProjectId || selectedMilestoneId || filterAssigneeId) && (
            <button
              onClick={() => { setSelectedProjectId(null); setSelectedMilestoneId(null); setFilterAssigneeId(null) }}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors ml-1"
            >
              <X className="w-3 h-3" /> Clear all
            </button>
          )}
        </div>
      )}

      {/* ── Project stats ── */}
      <ProjectStats tasks={tasks} projects={projects} selectedProjectId={selectedProjectId} />

      {/* ── Kanban ── */}
      {view === 'kanban' && (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4 kanban-scroll">
            {COLUMNS.map((col) => (
              <Column key={col.status} {...col}
                tasks={rootTasks.filter((t) => t.status === col.status)}
                subtaskCounts={subtaskCounts}
                completedSubtaskCounts={completedSubtaskCounts}
                canEdit={canEdit}
                onAdd={() => openNew(col.status)}
                onEdit={openEdit}
                onDelete={handleDelete}
                onView={setViewingTask}
              />
            ))}
          </div>
          <DragOverlay />
        </DndContext>
      )}

      {/* ── Calendar ── */}
      {view === 'calendar' && (
        <CalendarView
          tasks={rootTasks.filter((t) => t.due_date)}
          profiles={profiles}
          currentUserId={currentUserId}
        />
      )}

      {/* ── Table ── */}
      {view === 'table' && (
        <TaskTableView
          tasks={tasks}
          projects={projects}
          milestones={milestones}
          profiles={profiles}
          currentUserId={currentUserId}
          canEdit={canEdit}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
      )}

      {/* ── Modals ── */}
      <TaskForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingTask(undefined); setFormParentId(null) }}
        onSubmit={editingTask ? handleUpdate : handleCreate}
        initialStatus={formStatus}
        initialParentTaskId={formParentId}
        task={editingTask}
        projects={projects}
        milestones={milestones}
        profiles={profiles}
        onProjectCreated={(p) => setProjects((prev) => [...prev, p])}
        onMilestoneCreated={(m) => setMilestones((prev) => [...prev, m])}
      />

      <TaskDetail
        task={viewingTask}
        subtasks={viewingSubtasks}
        onClose={() => setViewingTask(null)}
        onAddSubtask={(pt) => { setViewingTask(null); openNew(pt.status, pt.id) }}
        onSubtaskDeleted={(id) => setTasks((prev) => prev.filter((t) => t.id !== id))}
        onSubtaskToggled={handleToggleSubtask}
      />

      <ProjectModal
        open={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        onCreated={(p) => setProjects((prev) => [...prev, p])}
      />

      <MilestoneModal
        open={milestoneModalOpen}
        onClose={() => setMilestoneModalOpen(false)}
        projects={projects}
        onCreated={(m) => setMilestones((prev) => [...prev, m])}
      />
    </>
  )
}
