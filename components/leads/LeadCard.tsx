'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { Building2, Mail, Phone, MoreVertical, Pencil, Trash2, PhoneCall, History } from 'lucide-react'
import { format } from 'date-fns'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { Lead, ContactLog } from '@/types'

const SENTIMENT_DOT: Record<string, string> = {
  very_positive: 'bg-green-500',
  positive:      'bg-emerald-400',
  neutral:       'bg-slate-400',
  negative:      'bg-orange-500',
  very_negative: 'bg-red-500',
}

const SENTIMENT_LABEL: Record<string, string> = {
  very_positive: 'Very Positive',
  positive:      'Positive',
  neutral:       'Neutral',
  negative:      'Negative',
  very_negative: 'Very Negative',
}

interface LeadCardProps {
  lead: Lead
  contactLogs: ContactLog[]
  canEdit: boolean
  onEdit: (lead: Lead) => void
  onDelete: (id: string) => void
  onLogContact: (lead: Lead) => void
  onViewHistory: (lead: Lead) => void
}

export function LeadCard({ lead, contactLogs, canEdit, onEdit, onDelete, onLogContact, onViewHistory }: LeadCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  const sorted = [...contactLogs].sort(
    (a, b) => new Date(a.contacted_at).getTime() - new Date(b.contacted_at).getTime()
  )
  const firstContact = sorted[0]
  const latestContact = sorted[sorted.length - 1]
  const stageContacts = contactLogs.filter((l) => l.funnel_status === lead.funnel_status).length
  const latestSentiment = latestContact?.sentiment

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-sm cursor-grab active:cursor-grabbing hover:border-blue-300 transition-colors select-none"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {latestSentiment && (
              <span
                title={SENTIMENT_LABEL[latestSentiment]}
                className={cn('w-2 h-2 rounded-full shrink-0', SENTIMENT_DOT[latestSentiment])}
              />
            )}
            <p className="font-medium text-sm text-slate-900 truncate">{lead.name}</p>
          </div>
          {lead.organization && (
            <div className="flex items-center gap-1 mt-0.5 ml-3.5">
              <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
              <p className="text-xs text-slate-500 truncate">{lead.organization}</p>
            </div>
          )}
        </div>

        <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setMenuOpen((o) => !o)}
            className="p-1 rounded hover:bg-slate-100 text-slate-400"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-6 z-10 bg-white border border-slate-200 rounded-lg shadow-lg py-1 w-40">
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => { onLogContact(lead); setMenuOpen(false) }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50"
              >
                <PhoneCall className="w-3 h-3" /> Log Interaction
              </button>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => { onViewHistory(lead); setMenuOpen(false) }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
              >
                <History className="w-3 h-3" /> View History
              </button>
              {canEdit && (
                <>
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => { onEdit(lead); setMenuOpen(false) }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => { onDelete(lead.id); setMenuOpen(false) }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Badges */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {lead.source && <Badge variant="default" className="text-xs">{lead.source}</Badge>}
        {lead.email && (
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <Mail className="w-3 h-3" />
            <span className="truncate max-w-[120px]">{lead.email}</span>
          </div>
        )}
      </div>

      {lead.phone && (
        <div className="mt-1.5 flex items-center gap-1 text-xs text-slate-400">
          <Phone className="w-3 h-3" />
          {lead.phone}
        </div>
      )}

      {/* Contact stats */}
      <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-1">
          <PhoneCall className="w-3 h-3" />
          {contactLogs.length === 0 ? (
            <span>No interactions yet</span>
          ) : (
            <span>
              {contactLogs.length} total
              {stageContacts !== contactLogs.length && ` · ${stageContacts} this stage`}
            </span>
          )}
        </div>
        {firstContact && (
          <span>First: {format(new Date(firstContact.contacted_at), 'MMM d')}</span>
        )}
      </div>

      {/* Assignee */}
      {lead.assignee && (
        <div className="mt-2 flex items-center gap-1.5">
          <Avatar name={lead.assignee.name} size="sm" />
          <span className="text-xs text-slate-500">{lead.assignee.name}</span>
        </div>
      )}
    </div>
  )
}
