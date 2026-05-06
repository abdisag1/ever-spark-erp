'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea, Input } from '@/components/ui/input'
import { Badge, statusVariant } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { toast } from 'sonner'
import { formatDateTime } from '@/lib/utils'
import { Send, Plus, FileText } from 'lucide-react'
import type { SMSLog, SMSTemplate } from '@/types'

export function SMSModule() {
  const [logs, setLogs] = useState<SMSLog[]>([])
  const [templates, setTemplates] = useState<SMSTemplate[]>([])
  const [recipients, setRecipients] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [templateModal, setTemplateModal] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [newTemplateContent, setNewTemplateContent] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)

  useEffect(() => {
    fetch('/api/sms/logs').then((r) => r.json()).then(setLogs).catch(() => {})
    fetch('/api/sms/templates').then((r) => r.json()).then(setTemplates).catch(() => {})
  }, [])

  async function sendSMS() {
    const recipientList = recipients.split(/[\n,]+/).map((r) => r.trim()).filter(Boolean)
    if (!recipientList.length) { toast.error('Enter at least one recipient'); return }
    if (!message.trim()) { toast.error('Message is required'); return }

    setSending(true)
    const res = await fetch('/api/sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipients: recipientList, message }),
    })

    if (res.ok) {
      const { count } = await res.json()
      toast.success(`Sent to ${count} recipient${count === 1 ? '' : 's'}`)
      setRecipients('')
      setMessage('')
      fetch('/api/sms/logs').then((r) => r.json()).then(setLogs).catch(() => {})
    } else {
      toast.error('Failed to send SMS')
    }
    setSending(false)
  }

  async function saveTemplate() {
    if (!newTemplateName || !newTemplateContent) { toast.error('Name and content required'); return }
    setSavingTemplate(true)
    const res = await fetch('/api/sms/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newTemplateName, content: newTemplateContent }),
    })
    if (res.ok) {
      const t: SMSTemplate = await res.json()
      setTemplates((prev) => [t, ...prev])
      setTemplateModal(false)
      setNewTemplateName('')
      setNewTemplateContent('')
      toast.success('Template saved')
    } else {
      toast.error('Failed to save template')
    }
    setSavingTemplate(false)
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Composer */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Compose Message</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                label="Recipients (phone numbers, comma or newline separated)"
                rows={3}
                placeholder="+1 555 0100, +1 555 0101&#10;+1 555 0102"
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
              />
              <div className="relative">
                <Textarea
                  label="Message"
                  rows={5}
                  placeholder="Type your message here…"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={160}
                />
                <span className="absolute bottom-2 right-2 text-xs text-slate-400">{message.length}/160</span>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-xs text-slate-400">
                  Note: Twilio integration ready — add credentials in .env.local to send real SMS.
                </p>
                <Button onClick={sendSMS} disabled={sending}>
                  <Send className="w-3.5 h-3.5" />
                  {sending ? 'Sending…' : 'Send SMS'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Templates */}
        <div>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Templates</CardTitle>
                <button onClick={() => setTemplateModal(true)} className="p-1 rounded hover:bg-slate-100 text-slate-400">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 p-3">
              {templates.length === 0 && <p className="text-xs text-slate-400 p-2">No templates yet.</p>}
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setMessage(t.content)}
                  className="w-full text-left p-2.5 rounded-lg hover:bg-slate-50 border border-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-3 h-3 text-slate-400" />
                    <span className="text-xs font-medium text-slate-700">{t.name}</span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2">{t.content}</p>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delivery Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Delivery Logs</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500">Recipient</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500">Message</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500">Status</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500">Sent</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={4} className="text-center text-slate-400 py-8 text-xs">No messages sent yet.</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-5 py-3 text-slate-700 font-mono text-xs">{log.recipient}</td>
                    <td className="px-5 py-3 text-slate-600 max-w-xs truncate">{log.message_content}</td>
                    <td className="px-5 py-3">
                      <Badge variant={statusVariant(log.status)}>{log.status}</Badge>
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-xs">{formatDateTime(log.sent_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Template modal */}
      <Modal open={templateModal} onClose={() => setTemplateModal(false)} title="New Template">
        <div className="p-5 space-y-4">
          <Input label="Template name" placeholder="Meeting reminder" value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} />
          <Textarea label="Content" rows={4} placeholder="Hi [Name], this is a reminder…" value={newTemplateContent} onChange={(e) => setNewTemplateContent(e.target.value)} maxLength={160} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTemplateModal(false)}>Cancel</Button>
            <Button onClick={saveTemplate} disabled={savingTemplate}>{savingTemplate ? 'Saving…' : 'Save template'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
