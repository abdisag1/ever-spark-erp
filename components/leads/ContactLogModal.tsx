'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Lead, ContactLog, ContactLogFormData, Sentiment } from '@/types'

const STAGE_LABEL: Record<string, string> = {
  lead: 'Lead',
  appointment: 'Appointment',
  presentation: 'Presentation',
  sale: 'Sale',
}

const SENTIMENTS: { value: Sentiment; label: string; active: string; idle: string }[] = [
  { value: 'very_positive', label: 'Very Positive', active: 'bg-green-100 text-green-800 border-green-400', idle: 'bg-white text-slate-500 border-slate-200 hover:border-green-300' },
  { value: 'positive',      label: 'Positive',      active: 'bg-emerald-50 text-emerald-800 border-emerald-400', idle: 'bg-white text-slate-500 border-slate-200 hover:border-emerald-300' },
  { value: 'neutral',       label: 'Neutral',       active: 'bg-slate-100 text-slate-800 border-slate-400', idle: 'bg-white text-slate-500 border-slate-200 hover:border-slate-400' },
  { value: 'negative',      label: 'Negative',      active: 'bg-orange-50 text-orange-800 border-orange-400', idle: 'bg-white text-slate-500 border-slate-200 hover:border-orange-300' },
  { value: 'very_negative', label: 'Very Negative', active: 'bg-red-50 text-red-800 border-red-400', idle: 'bg-white text-slate-500 border-slate-200 hover:border-red-300' },
]

interface ContactLogModalProps {
  open: boolean
  lead: Lead | null
  existingLogs: ContactLog[]
  onClose: () => void
  onSubmit: (leadId: string, data: ContactLogFormData) => Promise<void>
}

export function ContactLogModal({ open, lead, existingLogs, onClose, onSubmit }: ContactLogModalProps) {
  const [loading, setLoading] = useState(false)
  const [sentiment, setSentiment] = useState<Sentiment | null>(null)
  const [notes, setNotes] = useState('')
  const [durationHours, setDurationHours] = useState('')
  const [durationMins, setDurationMins] = useState('')
  const [contactedAt, setContactedAt] = useState('')

  const stageLogCount = existingLogs.filter((l) => l.funnel_status === lead?.funnel_status).length
  const interactionType: 'initial' | 'follow_up' = stageLogCount === 0 ? 'initial' : 'follow_up'
  const sequenceNumber = interactionType === 'initial' ? 0 : stageLogCount
  const sequenceLabel = interactionType === 'initial' ? 'Initial Contact' : `Follow-up ${sequenceNumber}`

  useEffect(() => {
    if (open) {
      setSentiment(null)
      setNotes('')
      setDurationHours('')
      setDurationMins('')
      setContactedAt(format(new Date(), "yyyy-MM-dd'T'HH:mm"))
    }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!lead) return
    setLoading(true)
    const totalMins =
      (parseInt(durationHours || '0') * 60) + parseInt(durationMins || '0')
    await onSubmit(lead.id, {
      interaction_type: interactionType,
      sequence_number: sequenceNumber,
      contacted_at: contactedAt ? new Date(contactedAt).toISOString() : new Date().toISOString(),
      meeting_duration_minutes: totalMins > 0 ? totalMins : null,
      sentiment,
      notes,
    })
    setLoading(false)
    onClose()
  }

  if (!lead) return null

  return (
    <Modal open={open} onClose={onClose} title="Log Interaction" size="md">
      <form onSubmit={handleSubmit} className="p-5 space-y-5">

        {/* Context banner */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 rounded-lg px-4 py-3">
            <p className="text-xs text-slate-400 mb-0.5">Lead</p>
            <p className="text-sm font-semibold text-slate-900 truncate">{lead.name}</p>
          </div>
          <div className="bg-slate-50 rounded-lg px-4 py-3">
            <p className="text-xs text-slate-400 mb-0.5">Interaction</p>
            <p className="text-sm font-semibold text-slate-900">{sequenceLabel}</p>
            <p className="text-xs text-slate-400">Stage: {STAGE_LABEL[lead.funnel_status]}</p>
          </div>
        </div>

        {/* Date & Time */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Date & Time *</label>
          <input
            type="datetime-local"
            value={contactedAt}
            onChange={(e) => setContactedAt(e.target.value)}
            required
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Meeting Duration */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Meeting Duration{' '}
            <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                type="number"
                min="0"
                max="23"
                placeholder="0"
                value={durationHours}
                onChange={(e) => setDurationHours(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">hr</span>
            </div>
            <div className="flex-1 relative">
              <input
                type="number"
                min="0"
                max="59"
                placeholder="0"
                value={durationMins}
                onChange={(e) => setDurationMins(e.target.value)}
                className="w-full px-3 py-2 pr-12 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">min</span>
            </div>
          </div>
        </div>

        {/* Sentiment */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Lead Sentiment</label>
          <div className="flex gap-1.5 flex-wrap">
            {SENTIMENTS.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setSentiment((prev) => (prev === s.value ? null : s.value))}
                className={cn(
                  'flex-1 min-w-[80px] px-2 py-2 text-xs font-medium rounded-lg border-2 transition-all',
                  sentiment === s.value ? s.active : s.idle
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Engagement Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="What was discussed? Key objections? Agreed next steps?"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving…' : `Save ${sequenceLabel}`}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
