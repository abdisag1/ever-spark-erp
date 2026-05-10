'use client'

import { useState } from 'react'
import {
  DndContext, DragEndEvent, DragOverEvent, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCorners, DragOverlay,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { LayoutGrid, List, Download, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { KanbanColumn } from './KanbanColumn'
import { LeadForm } from './LeadForm'
import { LeadListView } from './LeadListView'
import { ContactLogModal } from './ContactLogModal'
import { ContactHistory } from './ContactHistory'
import type { Lead, FunnelStatus, ContactLog, ContactLogFormData } from '@/types'

const COLUMNS: { status: FunnelStatus; label: string }[] = [
  { status: 'lead', label: 'Lead' },
  { status: 'appointment', label: 'Appointment' },
  { status: 'presentation', label: 'Presentation' },
  { status: 'sale', label: 'Sale' },
]

function buildMap(logs: ContactLog[]): Map<string, ContactLog[]> {
  const map = new Map<string, ContactLog[]>()
  for (const log of logs) {
    map.set(log.lead_id, [...(map.get(log.lead_id) ?? []), log])
  }
  return map
}

function downloadCSV(leads: Lead[], logsMap: Map<string, ContactLog[]>) {
  const headers = [
    'Name', 'Organization', 'Email', 'Phone', 'Source', 'Stage',
    'Assigned To', 'Notes', 'Total Interactions', 'First Contacted', 'Last Contacted',
    'Last Sentiment', 'Created',
  ]
  const rows = leads.map((lead) => {
    const logs = (logsMap.get(lead.id) ?? []).sort(
      (a, b) => new Date(a.contacted_at).getTime() - new Date(b.contacted_at).getTime()
    )
    const last = logs[logs.length - 1]
    return [
      lead.name,
      lead.organization ?? '',
      lead.email ?? '',
      lead.phone ?? '',
      lead.source ?? '',
      lead.funnel_status,
      lead.assignee?.name ?? '',
      lead.notes ?? '',
      logs.length,
      logs[0]?.contacted_at ? new Date(logs[0].contacted_at).toLocaleDateString() : '',
      last?.contacted_at ? new Date(last.contacted_at).toLocaleDateString() : '',
      last?.sentiment ?? '',
      new Date(lead.created_at).toLocaleDateString(),
    ]
  })
  const csv = [headers, ...rows]
    .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `leads-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

interface KanbanBoardProps {
  initialLeads: Lead[]
  initialContactLogs: ContactLog[]
  currentUserId: string
  isAdmin: boolean
}

export function KanbanBoard({ initialLeads, initialContactLogs, currentUserId, isAdmin }: KanbanBoardProps) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [logsMap, setLogsMap] = useState<Map<string, ContactLog[]>>(() => buildMap(initialContactLogs))
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [formOpen, setFormOpen] = useState(false)
  const [formStatus, setFormStatus] = useState<FunnelStatus>('lead')
  const [editingLead, setEditingLead] = useState<Lead | undefined>()
  const [contactModalLead, setContactModalLead] = useState<Lead | null>(null)
  const [historyLead, setHistoryLead] = useState<Lead | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const leadsForStatus = (s: FunnelStatus) => leads.filter((l) => l.funnel_status === s)

  function handleDragStart(_: DragStartEvent) {}

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return
    const activeId = active.id as string
    const overId = over.id as string
    const activeLead = leads.find((l) => l.id === activeId)
    if (!activeLead) return
    const overIsColumn = COLUMNS.some((c) => c.status === overId)
    const newStatus = overIsColumn
      ? (overId as FunnelStatus)
      : (leads.find((l) => l.id === overId)?.funnel_status ?? activeLead.funnel_status)
    if (activeLead.funnel_status !== newStatus) {
      setLeads((prev) => prev.map((l) => (l.id === activeId ? { ...l, funnel_status: newStatus } : l)))
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const activeId = active.id as string
    const overId = over.id as string
    const activeLead = leads.find((l) => l.id === activeId)
    if (!activeLead) return
    const overIsColumn = COLUMNS.some((c) => c.status === overId)
    const newStatus = overIsColumn
      ? (overId as FunnelStatus)
      : (leads.find((l) => l.id === overId)?.funnel_status ?? activeLead.funnel_status)
    if (!overIsColumn) {
      setLeads((prev) => {
        const colLeads = prev.filter((l) => l.funnel_status === newStatus)
        const oldIdx = colLeads.findIndex((l) => l.id === activeId)
        const newIdx = colLeads.findIndex((l) => l.id === overId)
        if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return prev
        const reordered = arrayMove(colLeads, oldIdx, newIdx)
        return [...prev.filter((l) => l.funnel_status !== newStatus), ...reordered]
      })
    }
    try {
      await fetch(`/api/leads/${activeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ funnel_status: newStatus }),
      })
    } catch {
      toast.error('Failed to save position')
    }
  }

  async function handleCreate(data: Record<string, unknown>) {
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, funnel_status: formStatus }),
    })
    if (!res.ok) { toast.error('Failed to create lead'); return }
    const newLead: Lead = await res.json()
    setLeads((prev) => [...prev, newLead])
    toast.success('Lead added')
  }

  async function handleUpdate(data: Record<string, unknown>) {
    if (!editingLead) return
    const res = await fetch(`/api/leads/${editingLead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) { toast.error('Failed to update lead'); return }
    const updated: Lead = await res.json()
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
    toast.success('Lead updated')
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/leads/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Failed to delete lead'); return }
    setLeads((prev) => prev.filter((l) => l.id !== id))
    toast.success('Lead deleted')
  }

  async function handleLogContact(leadId: string, formData: ContactLogFormData) {
    const lead = leads.find((l) => l.id === leadId)
    if (!lead) return
    const res = await fetch(`/api/contact-logs/${leadId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...formData, funnel_status: lead.funnel_status }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body?.error ?? 'Failed to log interaction')
      return
    }
    const newLog: ContactLog = await res.json()
    setLogsMap((prev) => {
      const updated = new Map(prev)
      updated.set(leadId, [...(updated.get(leadId) ?? []), newLog])
      return updated
    })
    toast.success('Interaction logged')
  }

  function openAdd(status: FunnelStatus) {
    setFormStatus(status)
    setEditingLead(undefined)
    setFormOpen(true)
  }

  function openEdit(lead: Lead) {
    setEditingLead(lead)
    setFormOpen(true)
  }

  /** True if the current user can edit/delete this lead */
  function canEdit(lead: Lead): boolean {
    if (isAdmin) return true
    if (!lead.created_by) return true // legacy lead with no creator
    return lead.created_by === currentUserId
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between mb-4 gap-2">
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setView('kanban')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              view === 'kanban' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Kanban
          </button>
          <button
            onClick={() => setView('list')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              view === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <List className="w-3.5 h-3.5" /> List
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadCSV(leads, logsMap)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button
            onClick={() => openAdd('lead')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Lead
          </button>
        </div>
      </div>

      {/* Kanban view */}
      {view === 'kanban' && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4 kanban-scroll">
            {COLUMNS.map(({ status, label }) => (
              <KanbanColumn
                key={status}
                status={status}
                label={label}
                leads={leadsForStatus(status)}
                contactLogs={logsMap}
                canEdit={canEdit}
                onAdd={openAdd}
                onEdit={openEdit}
                onDelete={handleDelete}
                onLogContact={setContactModalLead}
                onViewHistory={setHistoryLead}
              />
            ))}
          </div>
          <DragOverlay />
        </DndContext>
      )}

      {/* List view */}
      {view === 'list' && (
        <LeadListView
          leads={leads}
          contactLogs={logsMap}
          canEdit={canEdit}
          onEdit={openEdit}
          onDelete={handleDelete}
          onLogContact={setContactModalLead}
          onViewHistory={setHistoryLead}
        />
      )}

      {/* Modals */}
      <LeadForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingLead(undefined) }}
        onSubmit={editingLead ? handleUpdate : handleCreate}
        initialStatus={formStatus}
        lead={editingLead}
      />

      <ContactLogModal
        open={!!contactModalLead}
        lead={contactModalLead}
        existingLogs={logsMap.get(contactModalLead?.id ?? '') ?? []}
        onClose={() => setContactModalLead(null)}
        onSubmit={handleLogContact}
      />

      <ContactHistory
        open={!!historyLead}
        lead={historyLead}
        logs={logsMap.get(historyLead?.id ?? '') ?? []}
        onClose={() => setHistoryLead(null)}
        onLogContact={(lead) => { setHistoryLead(null); setContactModalLead(lead) }}
      />
    </>
  )
}
