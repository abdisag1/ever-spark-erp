'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { LeadCard } from './LeadCard'
import type { Lead, FunnelStatus, ContactLog } from '@/types'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

const columnColors: Record<FunnelStatus, string> = {
  lead: 'border-blue-400',
  appointment: 'border-purple-400',
  presentation: 'border-orange-400',
  sale: 'border-green-400',
}

const headerColors: Record<FunnelStatus, string> = {
  lead: 'bg-blue-50 text-blue-700',
  appointment: 'bg-purple-50 text-purple-700',
  presentation: 'bg-orange-50 text-orange-700',
  sale: 'bg-green-50 text-green-700',
}

const dotColors: Record<FunnelStatus, string> = {
  lead: 'bg-blue-400',
  appointment: 'bg-purple-400',
  presentation: 'bg-orange-400',
  sale: 'bg-green-400',
}

interface KanbanColumnProps {
  status: FunnelStatus
  label: string
  leads: Lead[]
  contactLogs: Map<string, ContactLog[]>
  onAdd: (status: FunnelStatus) => void
  onEdit: (lead: Lead) => void
  onDelete: (id: string) => void
  onLogContact: (lead: Lead) => void
  onViewHistory: (lead: Lead) => void
}

export function KanbanColumn({ status, label, leads, contactLogs, onAdd, onEdit, onDelete, onLogContact, onViewHistory }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div className={cn(
      'flex flex-col w-72 shrink-0 rounded-xl border-t-4 bg-slate-50',
      columnColors[status],
      isOver && 'ring-2 ring-blue-300'
    )}>
      <div className={cn('flex items-center justify-between px-3 py-2.5 rounded-t-lg', headerColors[status])}>
        <div className="flex items-center gap-2">
          <div className={cn('w-2 h-2 rounded-full', dotColors[status])} />
          <span className="text-sm font-semibold capitalize">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium bg-white/60 px-1.5 py-0.5 rounded-full">{leads.length}</span>
          <button
            onClick={() => onAdd(status)}
            className="p-0.5 rounded hover:bg-white/60 transition-colors"
            title={`Add to ${label}`}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div ref={setNodeRef} className="flex-1 p-2 space-y-2 min-h-[200px] overflow-y-auto">
        <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              contactLogs={contactLogs.get(lead.id) ?? []}
              onEdit={onEdit}
              onDelete={onDelete}
              onLogContact={onLogContact}
              onViewHistory={onViewHistory}
            />
          ))}
        </SortableContext>
        {leads.length === 0 && (
          <div className="flex items-center justify-center h-20 text-xs text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">
            Drop here
          </div>
        )}
      </div>
    </div>
  )
}
