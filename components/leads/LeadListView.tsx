'use client'

import { differenceInDays, format } from 'date-fns'
import { Phone, Pencil, Trash2, History, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Lead, ContactLog, FunnelStatus } from '@/types'

const FUNNEL_LABEL: Record<FunnelStatus, string> = {
  lead: 'Lead',
  appointment: 'Appointment',
  presentation: 'Presentation',
  sale: 'Sale',
}

const FUNNEL_COLOR: Record<FunnelStatus, string> = {
  lead: 'bg-blue-50 text-blue-700',
  appointment: 'bg-purple-50 text-purple-700',
  presentation: 'bg-orange-50 text-orange-700',
  sale: 'bg-green-50 text-green-700',
}

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

function shortDate(d: string) {
  return format(new Date(d), 'MMM d, yyyy')
}

function shortTime(d: string) {
  return format(new Date(d), 'h:mm a')
}

function durationLabel(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function daysDiff(days: number): string {
  if (days === 0) return 'Today'
  if (days === 1) return '1 day'
  return `${days} days`
}

interface LeadListViewProps {
  leads: Lead[]
  contactLogs: Map<string, ContactLog[]>
  canEdit: (lead: Lead) => boolean
  onEdit: (lead: Lead) => void
  onDelete: (id: string) => void
  onLogContact: (lead: Lead) => void
  onViewHistory: (lead: Lead) => void
}

export function LeadListView({ leads, contactLogs, canEdit, onEdit, onDelete, onLogContact, onViewHistory }: LeadListViewProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {['Name', 'Stage', 'Source', 'Interactions', 'Last Interaction', 'Sentiment', 'Time in Stage', ''].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-400">
                  No leads yet — add your first lead above.
                </td>
              </tr>
            )}
            {leads.map((lead) => {
              const logs = (contactLogs.get(lead.id) ?? []).sort(
                (a, b) => new Date(a.contacted_at).getTime() - new Date(b.contacted_at).getTime()
              )
              const last = logs[logs.length - 1]
              const prev = logs.length >= 2 ? logs[logs.length - 2] : null

              const stageContacts = logs.filter((l) => l.funnel_status === lead.funnel_status)
              const stageFirst = stageContacts[0]
              const daysInStage = stageFirst
                ? differenceInDays(new Date(), new Date(stageFirst.contacted_at))
                : null

              const lastSentiment = last?.sentiment

              return (
                <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                  {/* Name */}
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{lead.name}</div>
                    {lead.organization && <div className="text-xs text-slate-400">{lead.organization}</div>}
                  </td>

                  {/* Stage */}
                  <td className="px-4 py-3">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', FUNNEL_COLOR[lead.funnel_status])}>
                      {FUNNEL_LABEL[lead.funnel_status]}
                    </span>
                  </td>

                  {/* Source */}
                  <td className="px-4 py-3 text-xs text-slate-500">{lead.source ?? '—'}</td>

                  {/* Interactions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-semibold text-slate-700">{logs.length}</span>
                      {stageContacts.length > 0 && stageContacts.length !== logs.length && (
                        <span className="text-xs text-slate-400">({stageContacts.length} this stage)</span>
                      )}
                    </div>
                    {last && (
                      <div className="text-xs text-slate-400 mt-0.5 ml-5">
                        {last.interaction_type === 'initial' ? 'Initial Contact' : `Follow-up ${last.sequence_number}`}
                      </div>
                    )}
                  </td>

                  {/* Last Interaction */}
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    {last ? (
                      <div>
                        <div className="text-slate-700">{shortDate(last.contacted_at)}</div>
                        <div className="text-slate-400">{shortTime(last.contacted_at)}</div>
                        {last.meeting_duration_minutes && (
                          <div className="flex items-center gap-1 text-slate-400 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {durationLabel(last.meeting_duration_minutes)}
                          </div>
                        )}
                        {prev && (
                          <div className="text-slate-300 mt-0.5">
                            {daysDiff(differenceInDays(new Date(last.contacted_at), new Date(prev.contacted_at)))} after prev
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-300">Not yet</span>
                    )}
                  </td>

                  {/* Sentiment */}
                  <td className="px-4 py-3">
                    {lastSentiment ? (
                      <div className="flex items-center gap-1.5">
                        <span className={cn('w-2 h-2 rounded-full shrink-0', SENTIMENT_DOT[lastSentiment])} />
                        <span className="text-xs text-slate-600">{SENTIMENT_LABEL[lastSentiment]}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>

                  {/* Time in Stage */}
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {daysInStage !== null ? daysDiff(daysInStage) : <span className="text-slate-300">—</span>}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => onLogContact(lead)} title="Log interaction" className="p-1.5 rounded hover:bg-blue-50 text-blue-500 transition-colors">
                        <Phone className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => onViewHistory(lead)} title="View history" className="p-1.5 rounded hover:bg-slate-100 text-slate-500 transition-colors">
                        <History className="w-3.5 h-3.5" />
                      </button>
                      {canEdit(lead) && (
                        <>
                          <button onClick={() => onEdit(lead)} title="Edit" className="p-1.5 rounded hover:bg-slate-100 text-slate-500 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => onDelete(lead.id)} title="Delete" className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
