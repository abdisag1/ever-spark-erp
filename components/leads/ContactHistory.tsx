'use client'

import { format } from 'date-fns'
import { Clock, Download } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { cn } from '@/lib/utils'
import type { Lead, ContactLog, FunnelStatus } from '@/types'

const STAGE_LABEL: Record<FunnelStatus, string> = {
  lead: 'Lead',
  appointment: 'Appointment',
  presentation: 'Presentation',
  sale: 'Sale',
}

const STAGE_BADGE: Record<FunnelStatus, string> = {
  lead: 'bg-blue-50 text-blue-700 border-blue-200',
  appointment: 'bg-purple-50 text-purple-700 border-purple-200',
  presentation: 'bg-orange-50 text-orange-700 border-orange-200',
  sale: 'bg-green-50 text-green-700 border-green-200',
}

const SENTIMENT_CFG: Record<string, { label: string; pill: string; dot: string }> = {
  very_positive: { label: 'Very Positive', pill: 'bg-green-100 text-green-800',  dot: 'bg-green-500' },
  positive:      { label: 'Positive',      pill: 'bg-emerald-50 text-emerald-800', dot: 'bg-emerald-400' },
  neutral:       { label: 'Neutral',       pill: 'bg-slate-100 text-slate-700',  dot: 'bg-slate-400' },
  negative:      { label: 'Negative',      pill: 'bg-orange-50 text-orange-800', dot: 'bg-orange-500' },
  very_negative: { label: 'Very Negative', pill: 'bg-red-50 text-red-800',       dot: 'bg-red-500' },
}

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function sequenceLabel(log: ContactLog) {
  return log.interaction_type === 'initial' ? 'Initial Contact' : `Follow-up ${log.sequence_number}`
}

interface ContactHistoryProps {
  open: boolean
  lead: Lead | null
  logs: ContactLog[]
  onClose: () => void
  onLogContact: (lead: Lead) => void
}

function downloadHistoryCSV(lead: Lead, logs: ContactLog[]) {
  const sorted = [...logs].sort(
    (a, b) => new Date(a.contacted_at).getTime() - new Date(b.contacted_at).getTime()
  )

  const headers = [
    'Lead Name', 'Organization', 'Current Stage',
    'Interaction', 'Stage at Contact', 'Date', 'Time',
    'Meeting Duration (min)', 'Sentiment', 'Notes',
  ]

  const rows = sorted.map((log) => [
    lead.name,
    lead.organization ?? '',
    STAGE_LABEL[lead.funnel_status],
    log.interaction_type === 'initial' ? 'Initial Contact' : `Follow-up ${log.sequence_number}`,
    STAGE_LABEL[log.funnel_status],
    format(new Date(log.contacted_at), 'yyyy-MM-dd'),
    format(new Date(log.contacted_at), 'HH:mm'),
    log.meeting_duration_minutes ?? '',
    log.sentiment
      ? { very_positive: 'Very Positive', positive: 'Positive', neutral: 'Neutral', negative: 'Negative', very_negative: 'Very Negative' }[log.sentiment]
      : '',
    log.notes ?? '',
  ])

  const csv = [headers, ...rows]
    .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${lead.name.replace(/\s+/g, '-').toLowerCase()}-interactions-${format(new Date(), 'yyyy-MM-dd')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function ContactHistory({ open, lead, logs, onClose, onLogContact }: ContactHistoryProps) {
  if (!lead) return null

  const sorted = [...logs].sort(
    (a, b) => new Date(a.contacted_at).getTime() - new Date(b.contacted_at).getTime()
  )

  const stages = Array.from(new Set(sorted.map((l) => l.funnel_status))) as FunnelStatus[]

  return (
    <Modal open={open} onClose={onClose} title={`Interaction History — ${lead.name}`} size="md">
      <div className="flex flex-col">
        {/* Header stats */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-6 text-sm">
          <div>
            <span className="text-slate-400 text-xs">Total interactions</span>
            <p className="font-semibold text-slate-900">{logs.length}</p>
          </div>
          <div>
            <span className="text-slate-400 text-xs">Stages touched</span>
            <p className="font-semibold text-slate-900">{stages.length}</p>
          </div>
          {sorted[0] && (
            <div>
              <span className="text-slate-400 text-xs">First contact</span>
              <p className="font-semibold text-slate-900">
                {format(new Date(sorted[0].contacted_at), 'MMM d, yyyy')}
              </p>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="p-5 space-y-7 overflow-y-auto max-h-[55vh]">
          {sorted.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">No interactions logged yet.</p>
          )}

          {stages.map((stage) => {
            const stageLogs = sorted.filter((l) => l.funnel_status === stage)
            return (
              <div key={stage}>
                {/* Stage header */}
                <div className="flex items-center gap-2 mb-4">
                  <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full border', STAGE_BADGE[stage])}>
                    {STAGE_LABEL[stage]}
                  </span>
                  <span className="text-xs text-slate-400">{stageLogs.length} interaction{stageLogs.length !== 1 ? 's' : ''}</span>
                </div>

                {/* Log entries */}
                <div className="ml-2 space-y-4 border-l-2 border-slate-200 pl-5">
                  {stageLogs.map((log) => {
                    const sc = log.sentiment ? SENTIMENT_CFG[log.sentiment] : null
                    return (
                      <div key={log.id} className="relative">
                        {/* Timeline dot */}
                        <div className={cn(
                          'absolute -left-[29px] top-1.5 w-3 h-3 rounded-full border-2 border-white ring-2',
                          sc ? `${sc.dot} ring-transparent` : 'bg-slate-300 ring-slate-200'
                        )} />

                        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5 hover:border-slate-300 transition-colors">
                          {/* Top row */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-sm font-semibold text-slate-900">
                                {sequenceLabel(log)}
                              </span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-xs text-slate-400">
                                  {format(new Date(log.contacted_at), 'MMM d, yyyy · h:mm a')}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {log.meeting_duration_minutes && (
                                <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                  <Clock className="w-3 h-3" />
                                  {formatDuration(log.meeting_duration_minutes)}
                                </span>
                              )}
                              {sc && (
                                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', sc.pill)}>
                                  {sc.label}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Notes */}
                          {log.notes && (
                            <p className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2.5 leading-relaxed">
                              {log.notes}
                            </p>
                          )}
                          {!log.notes && (
                            <p className="text-xs text-slate-300 italic">No notes recorded</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-400">
            Current stage: <strong className="text-slate-600">{STAGE_LABEL[lead.funnel_status]}</strong>
          </span>
          <div className="flex items-center gap-3">
            {logs.length > 0 && (
              <button
                onClick={() => downloadHistoryCSV(lead, logs)}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 border border-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            )}
            <button
              onClick={() => { onClose(); onLogContact(lead) }}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              + Log new interaction
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
