'use client'

import { useState, useEffect, useMemo } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { formatDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  Send, Plus, FileText, Trash2, MessageSquare, Mail,
  CheckSquare, Square, Users, AlertCircle, Paperclip,
  X, Pencil, Image as ImageIcon, File as FileIcon,
} from 'lucide-react'
import type { SMSLog, SMSTemplate, EmailLog, EmailTemplate, EmailAttachment, Lead, FunnelStatus } from '@/types'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead', appointment: 'Appointment', presentation: 'Presentation', sale: 'Sale', any: 'All Stages',
}

const STAGE_COLOR: Record<string, string> = {
  lead: 'bg-blue-50 text-blue-700', appointment: 'bg-purple-50 text-purple-700',
  presentation: 'bg-orange-50 text-orange-700', sale: 'bg-green-50 text-green-700',
  any: 'bg-slate-100 text-slate-600',
}

const STATUS_COLOR: Record<string, string> = {
  sent: 'bg-green-100 text-green-700', delivered: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700', pending: 'bg-yellow-100 text-yellow-700',
}

// ── Template panel ────────────────────────────────────────────────────────────
function TemplatePanel<T extends { id: string; name: string; funnel_stage?: string | null }>({
  templates, type, onUse, onDelete, onAdd, onEdit,
}: {
  templates: T[]
  type: 'sms' | 'email'
  onUse: (t: T) => void
  onDelete: (id: string) => void
  onAdd: () => void
  onEdit?: (t: T) => void
}) {
  const [stageFilter, setStageFilter] = useState<string>('all')
  const stages = ['all', 'any', 'lead', 'appointment', 'presentation', 'sale']

  const filtered = stageFilter === 'all'
    ? templates
    : templates.filter((t) => (t.funnel_stage ?? 'any') === stageFilter)

  return (
    <div className="bg-white rounded-xl border border-slate-200 h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-sm font-semibold text-slate-900">Templates</span>
        </div>
        <button onClick={onAdd} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Stage filter */}
      <div className="px-3 py-2 border-b border-slate-100 flex gap-1 flex-wrap">
        {stages.map((s) => (
          <button
            key={s}
            onClick={() => setStageFilter(s)}
            className={cn('px-2 py-0.5 text-xs rounded-full font-medium transition-colors',
              stageFilter === s ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}
          >
            {s === 'all' ? 'All' : s === 'any' ? 'General' : STAGE_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {filtered.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-6">No templates yet.</p>
        )}
        {filtered.map((t) => (
          <div key={t.id} className="group p-3 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-colors">
            <div className="flex items-start justify-between gap-1">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs font-medium text-slate-700 truncate">{t.name}</span>
                  {t.funnel_stage && (
                    <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0', STAGE_COLOR[t.funnel_stage] ?? STAGE_COLOR.any)}>
                      {STAGE_LABELS[t.funnel_stage] ?? t.funnel_stage}
                    </span>
                  )}
                </div>
                {'subject' in t && <p className="text-xs text-slate-500 font-medium mb-0.5">{(t as unknown as EmailTemplate).subject}</p>}
                <p className="text-xs text-slate-400 line-clamp-2">
                  {'content' in t ? (t as unknown as SMSTemplate).content : (t as unknown as EmailTemplate).body}
                </p>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                {onEdit && (
                  <button onClick={() => onEdit(t)} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-500">
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
                <button onClick={() => onDelete(t.id)} className="p-1 rounded hover:bg-red-50 text-red-400">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
            {/* Attachment count badge */}
            {'attachments' in t && Array.isArray((t as unknown as EmailTemplate).attachments) && (t as unknown as EmailTemplate).attachments.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-slate-400 mt-1 mb-0.5">
                <Paperclip className="w-3 h-3" />
                {(t as unknown as EmailTemplate).attachments.length} attachment{(t as unknown as EmailTemplate).attachments.length !== 1 ? 's' : ''}
              </div>
            )}
            <button
              onClick={() => onUse(t)}
              className="mt-1.5 w-full text-xs font-medium text-blue-600 hover:text-blue-700 text-center py-1 rounded hover:bg-blue-50 transition-colors"
            >
              Use template
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Delivery log table ────────────────────────────────────────────────────────
function DeliveryLog({ logs, columns }: {
  logs: (SMSLog | EmailLog)[]
  columns: { key: string; label: string; render: (row: SMSLog | EmailLog) => React.ReactNode }[]
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900">Delivery Logs</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {columns.map((c) => (
                <th key={c.key} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {logs.length === 0 ? (
              <tr><td colSpan={columns.length} className="text-center text-slate-400 py-8 text-xs">No messages sent yet.</td></tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-3">{c.render(log)}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main module ───────────────────────────────────────────────────────────────
export function CommunicationModule() {
  const [tab, setTab] = useState<'sms' | 'email'>('sms')

  // SMS state
  const [smsRecipients, setSmsRecipients] = useState('')
  const [smsMessage, setSmsMessage] = useState('')
  const [smsSending, setSmsSending] = useState(false)
  const [smsLogs, setSmsLogs] = useState<SMSLog[]>([])
  const [smsTemplates, setSmsTemplates] = useState<SMSTemplate[]>([])
  const [smsTemplateModal, setSmsTemplateModal] = useState(false)
  const [newSmsTemplate, setNewSmsTemplate] = useState({ name: '', content: '', funnel_stage: '' })

  // Email state
  const [leads, setLeads] = useState<Lead[]>([])
  const [leadsLoaded, setLeadsLoaded] = useState(false)
  const [stageFilter, setStageFilter] = useState<FunnelStatus | 'all'>('all')
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set())
  const [emailFromName, setEmailFromName] = useState('Ever Spark CRM')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [emailAttachments, setEmailAttachments] = useState<EmailAttachment[]>([])
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([])
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([])
  const [emailTemplateModal, setEmailTemplateModal] = useState(false)
  const [newEmailTemplate, setNewEmailTemplate] = useState({ name: '', subject: '', body: '', funnel_stage: '' })
  const [newEmailTemplateAttachments, setNewEmailTemplateAttachments] = useState<EmailAttachment[]>([])
  const [editingEmailTemplate, setEditingEmailTemplate] = useState<EmailTemplate | null>(null)
  const [editEmailForm, setEditEmailForm] = useState({ name: '', subject: '', body: '', funnel_stage: '' })
  const [editEmailAttachments, setEditEmailAttachments] = useState<EmailAttachment[]>([])

  // Load SMS data on mount
  useEffect(() => {
    fetch('/api/sms/logs').then((r) => r.json()).then(setSmsLogs).catch(() => {})
    fetch('/api/sms/templates').then((r) => r.json()).then(setSmsTemplates).catch(() => {})
    fetch('/api/email/templates').then((r) => r.json()).then(setEmailTemplates).catch(() => {})
    fetch('/api/email/logs').then((r) => r.json()).then(setEmailLogs).catch(() => {})
  }, [])

  // Lazy-load leads when Email tab is first opened
  useEffect(() => {
    if (tab === 'email' && !leadsLoaded) {
      fetch('/api/leads').then((r) => r.json()).then((data) => { setLeads(data); setLeadsLoaded(true) }).catch(() => {})
    }
  }, [tab, leadsLoaded])

  // Filtered leads for email composer
  const filteredLeads = useMemo(() =>
    leads.filter((l) => {
      const hasEmail = !!l.email
      const stageMatch = stageFilter === 'all' || l.funnel_status === stageFilter
      return hasEmail && stageMatch
    }),
    [leads, stageFilter]
  )

  function toggleLead(id: string) {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function selectAll() { setSelectedLeadIds(new Set(filteredLeads.map((l) => l.id))) }
  function selectNone() { setSelectedLeadIds(new Set()) }

  // ── SMS actions ──
  async function sendSMS() {
    const recipientList = smsRecipients.split(/[\n,]+/).map((r) => r.trim()).filter(Boolean)
    if (!recipientList.length) { toast.error('Enter at least one recipient'); return }
    if (!smsMessage.trim()) { toast.error('Message is required'); return }
    setSmsSending(true)
    const res = await fetch('/api/sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipients: recipientList, message: smsMessage }),
    })
    if (res.ok) {
      const { count } = await res.json()
      toast.success(`Sent to ${count} recipient${count !== 1 ? 's' : ''}`)
      setSmsRecipients(''); setSmsMessage('')
      fetch('/api/sms/logs').then((r) => r.json()).then(setSmsLogs).catch(() => {})
    } else {
      const b = await res.json().catch(() => ({}))
      toast.error(b?.error ?? 'Failed to send SMS')
    }
    setSmsSending(false)
  }

  async function saveSmsTemplate() {
    if (!newSmsTemplate.name || !newSmsTemplate.content) { toast.error('Name and content required'); return }
    const res = await fetch('/api/sms/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newSmsTemplate, funnel_stage: newSmsTemplate.funnel_stage || null }),
    })
    if (res.ok) {
      const t: SMSTemplate = await res.json()
      setSmsTemplates((p) => [t, ...p])
      setSmsTemplateModal(false)
      setNewSmsTemplate({ name: '', content: '', funnel_stage: '' })
      toast.success('Template saved')
    } else { toast.error('Failed to save template') }
  }

  async function deleteSmsTemplate(id: string) {
    await fetch(`/api/sms/templates/${id}`, { method: 'DELETE' })
    setSmsTemplates((p) => p.filter((t) => t.id !== id))
    toast.success('Template deleted')
  }

  // ── Email actions ──
  async function sendEmails() {
    const selected = filteredLeads.filter((l) => selectedLeadIds.has(l.id))
    if (!selected.length) { toast.error('Select at least one lead'); return }
    if (!emailSubject.trim()) { toast.error('Subject is required'); return }
    if (!emailBody.trim()) { toast.error('Message body is required'); return }

    setEmailSending(true)
    const recipients = selected.map((l) => ({
      email: l.email!, name: l.name, lead_id: l.id, funnel_stage: l.funnel_status,
    }))
    const res = await fetch('/api/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipients, subject: emailSubject, body: emailBody, fromName: emailFromName, attachments: emailAttachments }),
    })
    if (res.ok) {
      const { sent, failed } = await res.json()
      toast.success(`Sent to ${sent} recipient${sent !== 1 ? 's' : ''}${failed ? ` · ${failed} failed` : ''}`)
      setSelectedLeadIds(new Set())
      fetch('/api/email/logs').then((r) => r.json()).then(setEmailLogs).catch(() => {})
    } else {
      const b = await res.json().catch(() => ({}))
      toast.error(b?.error ?? 'Failed to send emails')
    }
    setEmailSending(false)
  }

  async function handleFileUpload(files: FileList | null, target: 'composer' | 'new-template' | 'edit-template') {
    if (!files?.length) return
    setUploadingFiles(true)
    const uploaded: EmailAttachment[] = []
    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/email/upload', { method: 'POST', body: fd })
      if (res.ok) {
        uploaded.push(await res.json())
      } else {
        const b = await res.json().catch(() => ({}))
        toast.error(`Failed to upload ${file.name}: ${b?.error ?? 'Unknown error'}`)
      }
    }
    if (target === 'composer') setEmailAttachments((p) => [...p, ...uploaded])
    else if (target === 'new-template') setNewEmailTemplateAttachments((p) => [...p, ...uploaded])
    else if (target === 'edit-template') setEditEmailAttachments((p) => [...p, ...uploaded])
    setUploadingFiles(false)
  }

  async function saveEmailTemplate() {
    if (!newEmailTemplate.name || !newEmailTemplate.subject || !newEmailTemplate.body) {
      toast.error('Name, subject and body required'); return
    }
    const res = await fetch('/api/email/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newEmailTemplate, funnel_stage: newEmailTemplate.funnel_stage || null, attachments: newEmailTemplateAttachments }),
    })
    if (res.ok) {
      const t: EmailTemplate = await res.json()
      setEmailTemplates((p) => [t, ...p])
      setEmailTemplateModal(false)
      setNewEmailTemplate({ name: '', subject: '', body: '', funnel_stage: '' })
      setNewEmailTemplateAttachments([])
      toast.success('Template saved')
    } else { toast.error('Failed to save template') }
  }

  function openEditEmailTemplate(t: EmailTemplate) {
    setEditingEmailTemplate(t)
    setEditEmailForm({ name: t.name, subject: t.subject, body: t.body, funnel_stage: t.funnel_stage ?? '' })
    setEditEmailAttachments(t.attachments ?? [])
  }

  async function saveEditEmailTemplate() {
    if (!editingEmailTemplate) return
    if (!editEmailForm.name || !editEmailForm.subject || !editEmailForm.body) {
      toast.error('Name, subject and body required'); return
    }
    const res = await fetch(`/api/email/templates/${editingEmailTemplate.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editEmailForm, funnel_stage: editEmailForm.funnel_stage || null, attachments: editEmailAttachments }),
    })
    if (res.ok) {
      const updated: EmailTemplate = await res.json()
      setEmailTemplates((p) => p.map((t) => t.id === updated.id ? updated : t))
      setEditingEmailTemplate(null)
      toast.success('Template updated')
    } else { toast.error('Failed to update template') }
  }

  async function deleteEmailTemplate(id: string) {
    await fetch(`/api/email/templates/${id}`, { method: 'DELETE' })
    setEmailTemplates((p) => p.filter((t) => t.id !== id))
    toast.success('Template deleted')
  }

  const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const selectCls = `${inputCls} bg-white`

  // ── Render ──
  return (
    <div className="space-y-5">
      {/* Tab toggle */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        <button onClick={() => setTab('sms')} className={cn('flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors', tab === 'sms' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
          <MessageSquare className="w-4 h-4" /> Bulk SMS
        </button>
        <button onClick={() => setTab('email')} className={cn('flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors', tab === 'email' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
          <Mail className="w-4 h-4" /> Bulk Email
        </button>
      </div>

      {/* ══ SMS TAB ══ */}
      {tab === 'sms' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Composer */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                <h3 className="text-sm font-semibold text-slate-900">Compose SMS</h3>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Recipients <span className="text-slate-400 font-normal">(phone numbers, comma or newline separated)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={smsRecipients}
                    onChange={(e) => setSmsRecipients(e.target.value)}
                    placeholder="+251 91 234 5678&#10;+251 92 345 6789"
                    className={`${inputCls} resize-none`}
                  />
                </div>
                <div className="relative">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Message</label>
                  <textarea
                    rows={5}
                    value={smsMessage}
                    onChange={(e) => setSmsMessage(e.target.value)}
                    maxLength={160}
                    placeholder="Type your message. Use [Name] as a placeholder for the recipient's name."
                    className={`${inputCls} resize-none`}
                  />
                  <span className={cn('absolute bottom-2 right-3 text-xs', smsMessage.length > 140 ? 'text-orange-500' : 'text-slate-400')}>
                    {smsMessage.length}/160
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Add <code className="bg-slate-100 px-1 rounded">TWILIO_ACCOUNT_SID</code>, <code className="bg-slate-100 px-1 rounded">TWILIO_AUTH_TOKEN</code> and <code className="bg-slate-100 px-1 rounded">TWILIO_FROM_NUMBER</code> to .env.local to send real SMS.
                  </div>
                  <button
                    onClick={sendSMS}
                    disabled={smsSending}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {smsSending ? 'Sending…' : 'Send SMS'}
                  </button>
                </div>
              </div>
            </div>

            {/* SMS Templates */}
            <TemplatePanel
              templates={smsTemplates}
              type="sms"
              onUse={(t) => setSmsMessage(t.content)}
              onDelete={deleteSmsTemplate}
              onAdd={() => setSmsTemplateModal(true)}
            />
          </div>

          {/* SMS Delivery Logs */}
          <DeliveryLog
            logs={smsLogs}
            columns={[
              { key: 'recipient', label: 'Recipient', render: (l) => <span className="font-mono text-xs text-slate-700">{(l as SMSLog).recipient}</span> },
              { key: 'message', label: 'Message', render: (l) => <span className="text-xs text-slate-600 max-w-xs truncate block">{(l as SMSLog).message_content}</span> },
              { key: 'status', label: 'Status', render: (l) => <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_COLOR[l.status])}>{l.status}</span> },
              { key: 'sent', label: 'Sent', render: (l) => <span className="text-xs text-slate-400">{formatDateTime((l as SMSLog).sent_at)}</span> },
            ]}
          />
        </>
      )}

      {/* ══ EMAIL TAB ══ */}
      {tab === 'email' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Email composer */}
            <div className="lg:col-span-2 space-y-4">
              {/* Lead selector */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-slate-400" />
                    <h3 className="text-sm font-semibold text-slate-900">Select Recipients</h3>
                    {selectedLeadIds.size > 0 && (
                      <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                        {selectedLeadIds.size} selected
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={selectAll} className="text-xs text-blue-600 hover:text-blue-700">Select all</button>
                    <span className="text-slate-300">|</span>
                    <button onClick={selectNone} className="text-xs text-slate-400 hover:text-slate-600">None</button>
                  </div>
                </div>

                {/* Stage filter */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-slate-400">Stage:</span>
                  {(['all', 'lead', 'appointment', 'presentation', 'sale'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => { setStageFilter(s); setSelectedLeadIds(new Set()) }}
                      className={cn('px-2.5 py-1 text-xs rounded-full font-medium transition-colors',
                        stageFilter === s ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
                    >
                      {s === 'all' ? 'All Stages' : STAGE_LABELS[s]}
                    </button>
                  ))}
                </div>

                {/* Lead list */}
                <div className="max-h-48 overflow-y-auto space-y-1 border border-slate-100 rounded-lg p-2">
                  {!leadsLoaded && <p className="text-xs text-slate-400 text-center py-3">Loading leads…</p>}
                  {leadsLoaded && filteredLeads.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-3">No leads with email addresses in this stage.</p>
                  )}
                  {filteredLeads.map((lead) => {
                    const checked = selectedLeadIds.has(lead.id)
                    return (
                      <button
                        key={lead.id}
                        onClick={() => toggleLead(lead.id)}
                        className={cn('w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors',
                          checked ? 'bg-blue-50 border border-blue-200' : 'hover:bg-slate-50 border border-transparent')}
                      >
                        {checked
                          ? <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" />
                          : <Square className="w-4 h-4 text-slate-300 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-slate-800">{lead.name}</span>
                          {lead.organization && <span className="text-xs text-slate-400 ml-1.5">· {lead.organization}</span>}
                        </div>
                        <span className="text-xs text-slate-400 truncate max-w-[160px]">{lead.email}</span>
                        <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0', STAGE_COLOR[lead.funnel_status])}>
                          {STAGE_LABELS[lead.funnel_status]}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Email compose */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                <h3 className="text-sm font-semibold text-slate-900">Compose Email</h3>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    From Name <span className="text-slate-400 font-normal">— shown to recipients as the sender</span>
                  </label>
                  <input
                    value={emailFromName}
                    onChange={(e) => setEmailFromName(e.target.value)}
                    placeholder="Ever Spark CRM"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Subject *</label>
                  <input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder="e.g. Follow-up on your solar installation" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Body * <span className="text-slate-400 font-normal">— use [Name] and [Email] as personalisation placeholders</span>
                  </label>
                  <textarea rows={8} value={emailBody} onChange={(e) => setEmailBody(e.target.value)}
                    placeholder="Dear [Name],&#10;&#10;Thank you for your interest in Ever Spark Technologies…"
                    className={`${inputCls} resize-none`}
                  />
                </div>

                {/* Attachments */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-xs font-medium text-slate-600">Attachments</label>
                    <label className={cn('flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border border-slate-200 rounded-lg cursor-pointer transition-colors',
                      uploadingFiles ? 'opacity-50 pointer-events-none' : 'hover:bg-slate-50 text-slate-600')}>
                      <Paperclip className="w-3.5 h-3.5" />
                      {uploadingFiles ? 'Uploading…' : 'Attach files'}
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.ppt,.pptx"
                        onChange={(e) => handleFileUpload(e.target.files, 'composer')}
                      />
                    </label>
                    <span className="text-xs text-slate-400">Max 10 MB per file</span>
                  </div>
                  {emailAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {emailAttachments.map((att, i) => (
                        <div key={i} className="flex items-center gap-1.5 bg-slate-100 rounded-lg px-2.5 py-1.5 text-xs text-slate-700">
                          {att.type.startsWith('image/') ? <ImageIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" /> : <FileIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                          <span className="truncate max-w-[120px]">{att.name}</span>
                          <span className="text-slate-400 shrink-0">{formatBytes(att.size)}</span>
                          <button onClick={() => setEmailAttachments((p) => p.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-red-500 transition-colors ml-0.5">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Add <code className="bg-slate-100 px-1 rounded">RESEND_API_KEY</code> and <code className="bg-slate-100 px-1 rounded">EMAIL_FROM</code> to .env.local to send real emails.
                  </div>
                  <button
                    onClick={sendEmails}
                    disabled={emailSending || selectedLeadIds.size === 0}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {emailSending ? 'Sending…' : `Send to ${selectedLeadIds.size || 0}`}
                  </button>
                </div>
              </div>
            </div>

            {/* Email Templates */}
            <TemplatePanel
              templates={emailTemplates}
              type="email"
              onUse={(t) => {
                const et = t as EmailTemplate
                setEmailSubject(et.subject)
                setEmailBody(et.body)
                setEmailAttachments(et.attachments ?? [])
              }}
              onDelete={deleteEmailTemplate}
              onAdd={() => setEmailTemplateModal(true)}
              onEdit={(t) => openEditEmailTemplate(t as EmailTemplate)}
            />
          </div>

          {/* Email Delivery Logs */}
          <DeliveryLog
            logs={emailLogs}
            columns={[
              { key: 'recipient', label: 'Recipient', render: (l) => (
                <div>
                  <div className="text-xs font-medium text-slate-700">{(l as EmailLog).recipient_name ?? '—'}</div>
                  <div className="text-xs text-slate-400">{(l as EmailLog).recipient_email}</div>
                </div>
              )},
              { key: 'subject', label: 'Subject', render: (l) => <span className="text-xs text-slate-600 truncate block max-w-[200px]">{(l as EmailLog).subject}</span> },
              { key: 'stage', label: 'Stage', render: (l) => {
                const s = (l as EmailLog).funnel_stage
                return s ? <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', STAGE_COLOR[s] ?? '')}>{STAGE_LABELS[s] ?? s}</span> : <span className="text-slate-300 text-xs">—</span>
              }},
              { key: 'status', label: 'Status', render: (l) => <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_COLOR[l.status])}>{l.status}</span> },
              { key: 'sent', label: 'Sent', render: (l) => <span className="text-xs text-slate-400">{formatDateTime((l as EmailLog).sent_at)}</span> },
            ]}
          />
        </>
      )}

      {/* ── SMS Template modal ── */}
      <Modal open={smsTemplateModal} onClose={() => setSmsTemplateModal(false)} title="New SMS Template" size="sm">
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
            <input value={newSmsTemplate.name} onChange={(e) => setNewSmsTemplate((f) => ({ ...f, name: e.target.value }))} placeholder="Meeting reminder" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Sales Stage</label>
            <select value={newSmsTemplate.funnel_stage} onChange={(e) => setNewSmsTemplate((f) => ({ ...f, funnel_stage: e.target.value }))} className={selectCls}>
              <option value="">General (any stage)</option>
              <option value="lead">Lead</option>
              <option value="appointment">Appointment</option>
              <option value="presentation">Presentation</option>
              <option value="sale">Sale</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Content * (max 160 chars)</label>
            <textarea rows={4} maxLength={160} value={newSmsTemplate.content} onChange={(e) => setNewSmsTemplate((f) => ({ ...f, content: e.target.value }))} placeholder="Hi [Name], this is a reminder about…" className={`${inputCls} resize-none`} />
            <p className="text-xs text-slate-400 text-right mt-0.5">{newSmsTemplate.content.length}/160</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSmsTemplateModal(false)}>Cancel</Button>
            <Button onClick={saveSmsTemplate}>Save Template</Button>
          </div>
        </div>
      </Modal>

      {/* ── Email Template modal ── */}
      <Modal open={emailTemplateModal} onClose={() => setEmailTemplateModal(false)} title="New Email Template" size="md">
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
              <input value={newEmailTemplate.name} onChange={(e) => setNewEmailTemplate((f) => ({ ...f, name: e.target.value }))} placeholder="Introduction email" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Sales Stage</label>
              <select value={newEmailTemplate.funnel_stage} onChange={(e) => setNewEmailTemplate((f) => ({ ...f, funnel_stage: e.target.value }))} className={selectCls}>
                <option value="">General (any stage)</option>
                <option value="lead">Lead</option>
                <option value="appointment">Appointment</option>
                <option value="presentation">Presentation</option>
                <option value="sale">Sale</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Subject *</label>
            <input value={newEmailTemplate.subject} onChange={(e) => setNewEmailTemplate((f) => ({ ...f, subject: e.target.value }))} placeholder="Introducing Ever Spark Solar Solutions" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Body * — use [Name] and [Email] as placeholders</label>
            <textarea rows={7} value={newEmailTemplate.body} onChange={(e) => setNewEmailTemplate((f) => ({ ...f, body: e.target.value }))} placeholder="Dear [Name],&#10;&#10;We are pleased to introduce…" className={`${inputCls} resize-none`} />
          </div>
          {/* Attachments in new template */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-xs font-medium text-slate-600">Attachments</label>
              <label className={cn('flex items-center gap-1.5 px-2 py-1 text-xs border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 text-slate-600', uploadingFiles && 'opacity-50 pointer-events-none')}>
                <Paperclip className="w-3 h-3" />
                {uploadingFiles ? 'Uploading…' : 'Add files'}
                <input type="file" multiple className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                  onChange={(e) => handleFileUpload(e.target.files, 'new-template')} />
              </label>
            </div>
            {newEmailTemplateAttachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {newEmailTemplateAttachments.map((att, i) => (
                  <div key={i} className="flex items-center gap-1 bg-slate-100 rounded px-2 py-1 text-xs text-slate-600">
                    <Paperclip className="w-3 h-3" />{att.name}
                    <button onClick={() => setNewEmailTemplateAttachments((p) => p.filter((_, idx) => idx !== i))}><X className="w-3 h-3 text-slate-400 hover:text-red-500" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setEmailTemplateModal(false); setNewEmailTemplateAttachments([]) }}>Cancel</Button>
            <Button onClick={saveEmailTemplate}>Save Template</Button>
          </div>
        </div>
      </Modal>

      {/* ── Edit Email Template modal ── */}
      <Modal open={!!editingEmailTemplate} onClose={() => setEditingEmailTemplate(null)} title="Edit Email Template" size="md">
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
              <input value={editEmailForm.name} onChange={(e) => setEditEmailForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Sales Stage</label>
              <select value={editEmailForm.funnel_stage} onChange={(e) => setEditEmailForm((f) => ({ ...f, funnel_stage: e.target.value }))} className={selectCls}>
                <option value="">General (any stage)</option>
                <option value="lead">Lead</option>
                <option value="appointment">Appointment</option>
                <option value="presentation">Presentation</option>
                <option value="sale">Sale</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Subject *</label>
            <input value={editEmailForm.subject} onChange={(e) => setEditEmailForm((f) => ({ ...f, subject: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Body *</label>
            <textarea rows={7} value={editEmailForm.body} onChange={(e) => setEditEmailForm((f) => ({ ...f, body: e.target.value }))} className={`${inputCls} resize-none`} />
          </div>
          {/* Attachments in edit */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-xs font-medium text-slate-600">Attachments</label>
              <label className={cn('flex items-center gap-1.5 px-2 py-1 text-xs border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 text-slate-600', uploadingFiles && 'opacity-50 pointer-events-none')}>
                <Paperclip className="w-3 h-3" />
                {uploadingFiles ? 'Uploading…' : 'Add files'}
                <input type="file" multiple className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                  onChange={(e) => handleFileUpload(e.target.files, 'edit-template')} />
              </label>
            </div>
            {editEmailAttachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {editEmailAttachments.map((att, i) => (
                  <div key={i} className="flex items-center gap-1 bg-slate-100 rounded px-2 py-1 text-xs text-slate-600">
                    {att.type.startsWith('image/') ? <ImageIcon className="w-3 h-3 text-blue-400" /> : <FileIcon className="w-3 h-3" />}
                    {att.name}
                    <button onClick={() => setEditEmailAttachments((p) => p.filter((_, idx) => idx !== i))}><X className="w-3 h-3 text-slate-400 hover:text-red-500" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditingEmailTemplate(null)}>Cancel</Button>
            <Button onClick={saveEditEmailTemplate}>Save Changes</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
