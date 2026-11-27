'use client'

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  CheckCircle2, XCircle, HelpCircle, Banknote, BookCheck, Ban,
  Upload, FileText, ExternalLink, Clock, AlertTriangle,
} from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input, Textarea, Select } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { StatusBadge, formatMoney } from '@/components/finance/shared'
import {
  DOCUMENT_KIND_LABELS, PAYMENT_METHOD_LABELS,
  type PaymentRequest, type PaymentDocument, type PaymentEvent,
  type DocumentKind, type PaymentMethod,
} from '@/types/finance'

const SETTLEMENT_KINDS: DocumentKind[] = ['receipt', 'invoice', 'bpv', 'bank_advice']

interface Props {
  requestId: string | null
  currentUser: { id: string; role: string }
  onClose: () => void
  onUpdated: (pr: PaymentRequest) => void
}

type Mode = null | 'reject' | 'clarify' | 'pay'

export function PaymentDetailModal({ requestId, currentUser, onClose, onUpdated }: Props) {
  const [detail, setDetail] = useState<PaymentRequest | null>(null)
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<Mode>(null)

  // Action inputs
  const [reason, setReason] = useState('')
  const [bpv, setBpv] = useState('')
  const [bankAdvice, setBankAdvice] = useState('')
  const [payMethod, setPayMethod] = useState<PaymentMethod | ''>('')

  // Document upload
  const [file, setFile] = useState<File | null>(null)
  const [docKind, setDocKind] = useState<DocumentKind>('receipt')
  const [uploading, setUploading] = useState(false)

  // Refresh after an action (called from event handlers, not an effect).
  const refresh = useCallback(async (id: string) => {
    const res = await fetch(`/api/finance/payment-requests/${id}`)
    if (res.ok) setDetail(await res.json())
    else toast.error('Failed to load request')
  }, [])

  // Load when the selected request changes. setState only inside .then.
  useEffect(() => {
    if (!requestId) return
    let cancelled = false
    fetch(`/api/finance/payment-requests/${requestId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('load'))))
      .then((d) => {
        if (cancelled) return
        setDetail(d)
        setMode(null); setReason(''); setBpv(''); setBankAdvice(''); setPayMethod(''); setFile(null); setDocKind('receipt')
      })
      .catch(() => { if (!cancelled) toast.error('Failed to load request') })
    return () => { cancelled = true }
  }, [requestId])

  const documents = (detail?.documents ?? []) as PaymentDocument[]
  const events = (detail?.events ?? []) as PaymentEvent[]
  const hasSettlementDoc = documents.some((d) => SETTLEMENT_KINDS.includes(d.kind))

  if (!requestId) return null

  const canApprove = ['finance', 'admin'].includes(currentUser.role)
  const isApproverForThis = detail
    ? currentUser.role === detail.current_approver_role || currentUser.role === 'admin'
    : false
  const isRequester = detail?.requester_id === currentUser.id

  const showApprove = detail && ['submitted', 'clarification'].includes(detail.status) && isApproverForThis && !isRequester
  const showClarify = detail && detail.status === 'submitted' && isApproverForThis && !isRequester
  const showPay = detail && ['approved', 'processing'].includes(detail.status) && canApprove && detail.approved_by !== currentUser.id
  const showPost = detail && detail.status === 'paid' && canApprove
  const showCancel = detail && ['draft', 'submitted', 'clarification'].includes(detail.status) && (isRequester || currentUser.role === 'admin')

  async function runAction(action: string, extra: Record<string, unknown> = {}) {
    if (!detail) return
    setBusy(true)
    try {
      const res = await fetch(`/api/finance/payment-requests/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Action failed')
      onUpdated(data as PaymentRequest)
      setMode(null); setReason(''); setBpv(''); setBankAdvice(''); setPayMethod('')
      await refresh(detail.id) // refresh events + status
      toast.success('Done')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  function confirmReject() {
    if (!reason.trim()) { toast.error('Please give a reason'); return }
    runAction('reject', { reason })
  }
  function confirmClarify() {
    if (!reason.trim()) { toast.error('Please say what is needed'); return }
    runAction('clarify', { reason })
  }
  function confirmPay() {
    if (detail?.requires_check && !bpv.trim()) { toast.error('A BPV / check number is required'); return }
    runAction('pay', { bpv_number: bpv || null, bank_advice_ref: bankAdvice || null, payment_method: payMethod || null })
  }

  async function uploadDoc() {
    if (!detail || !file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('request_id', detail.id)
      const up = await fetch('/api/finance/payment-requests/upload', { method: 'POST', body: fd })
      if (!up.ok) throw new Error('Upload failed')
      const { path } = await up.json()
      const att = await fetch(`/api/finance/payment-requests/${detail.id}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: docKind, url: path, file_name: file.name }),
      })
      if (!att.ok) { const b = await att.json().catch(() => ({})); throw new Error(b?.error ?? 'Attach failed') }
      setFile(null)
      await refresh(detail.id)
      toast.success('Document attached')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to attach document')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Modal open={!!requestId} onClose={onClose} title={detail?.reference ?? 'Payment request'} size="lg">
      {!detail || detail.id !== requestId ? (
        <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
      ) : (
        <div className="p-5 space-y-5">
          {/* Summary */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-2xl font-bold text-slate-900">{formatMoney(detail.amount, detail.currency)}</span>
                <StatusBadge status={detail.status} />
                {detail.requires_check && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                    <AlertTriangle className="w-3 h-3" /> Check required
                  </span>
                )}
                {detail.source_channel === 'telegram' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 font-medium">via Telegram</span>
                )}
              </div>
              <p className="text-sm text-slate-600 mt-1">{detail.purpose}</p>
            </div>
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs">
            <Meta label="Requested by" value={detail.requester?.name} />
            <Meta label="Project" value={detail.project?.name ?? '—'} />
            <Meta label="Cost center" value={detail.cost_center ? `${detail.cost_center.code}` : '—'} />
            <Meta label="Account" value={detail.coa_code ?? '—'} />
            <Meta label="Vendor" value={detail.vendor?.name ?? '—'} />
            <Meta label="Method" value={detail.payment_method ? PAYMENT_METHOD_LABELS[detail.payment_method] : '—'} />
            <Meta label="Approver role" value={detail.current_approver_role ?? '—'} />
            {detail.approver?.name && <Meta label="Approved by" value={detail.approver.name} />}
            {detail.payer?.name && <Meta label="Paid by" value={detail.payer.name} />}
            {detail.bpv_number && <Meta label="BPV #" value={detail.bpv_number} />}
            {detail.bank_advice_ref && <Meta label="Bank advice" value={detail.bank_advice_ref} />}
          </div>

          {detail.rejected_reason && detail.status === 'rejected' && (
            <div className="text-xs bg-red-50 text-red-700 rounded-lg px-3 py-2">
              <strong>Rejected:</strong> {detail.rejected_reason}
            </div>
          )}

          {/* Documents */}
          <section>
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Documents</h3>
            <div className="space-y-1.5">
              {documents.length === 0 && <p className="text-xs text-slate-400">No documents attached yet.</p>}
              {documents.map((d) => (
                <a
                  key={d.id}
                  href={d.signed_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-colors',
                    d.signed_url ? 'border-slate-200 hover:bg-slate-50' : 'border-slate-100 pointer-events-none opacity-60')}
                >
                  <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="flex-1 min-w-0 truncate font-medium text-slate-700">{d.file_name}</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">{DOCUMENT_KIND_LABELS[d.kind]}</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </a>
              ))}
            </div>

            {/* Upload */}
            <div className="mt-3 flex flex-col sm:flex-row gap-2 sm:items-end">
              {file ? (
                <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                  <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                  <span className="flex-1 min-w-0 text-xs font-medium text-blue-800 truncate">{file.name}</span>
                  <button onClick={() => setFile(null)} className="text-xs text-blue-500">Remove</button>
                </div>
              ) : (
                <label className="flex-1 flex items-center gap-2 px-3 py-2 border-2 border-dashed border-slate-200 rounded-lg cursor-pointer hover:border-blue-300 text-xs text-slate-400">
                  <Upload className="w-4 h-4 shrink-0" /> Attach a document
                  <input type="file" className="hidden" accept=".pdf,.doc,.docx,image/*"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f) }} />
                </label>
              )}
              <select
                value={docKind}
                onChange={(e) => setDocKind(e.target.value as DocumentKind)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
              >
                {Object.entries(DOCUMENT_KIND_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <Button size="sm" variant="outline" onClick={uploadDoc} disabled={!file || uploading}>
                {uploading ? 'Uploading…' : 'Attach'}
              </Button>
            </div>
          </section>

          {/* Action inputs */}
          {mode === 'reject' && (
            <ReasonBox label="Reason for rejection" value={reason} onChange={setReason} onCancel={() => setMode(null)} onConfirm={confirmReject} busy={busy} confirmLabel="Confirm rejection" />
          )}
          {mode === 'clarify' && (
            <ReasonBox label="What clarification is needed?" value={reason} onChange={setReason} onCancel={() => setMode(null)} onConfirm={confirmClarify} busy={busy} confirmLabel="Request clarification" />
          )}
          {mode === 'pay' && (
            <div className="space-y-3 bg-slate-50 rounded-lg p-4">
              {!hasSettlementDoc && (
                <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  Attach a receipt, invoice, BPV or bank advice above before marking as paid.
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label={`BPV / check number${detail.requires_check ? ' *' : ''}`} value={bpv} onChange={(e) => setBpv(e.target.value)} placeholder="BPV-…" />
                <Input label="Bank advice ref" value={bankAdvice} onChange={(e) => setBankAdvice(e.target.value)} placeholder="Optional" />
              </div>
              <Select label="Payment method" value={payMethod} onChange={(e) => setPayMethod(e.target.value as PaymentMethod | '')}>
                <option value="">— Keep as is —</option>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setMode(null)}>Cancel</Button>
                <Button size="sm" onClick={confirmPay} disabled={busy}>Confirm payment</Button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {!mode && (
            <div className="flex flex-wrap gap-2">
              {showApprove && (
                <Button size="sm" onClick={() => runAction('approve')} disabled={busy}>
                  <CheckCircle2 className="w-4 h-4" /> Approve
                </Button>
              )}
              {showClarify && (
                <Button size="sm" variant="outline" onClick={() => setMode('clarify')} disabled={busy}>
                  <HelpCircle className="w-4 h-4" /> Clarify
                </Button>
              )}
              {showApprove && (
                <Button size="sm" variant="destructive" onClick={() => setMode('reject')} disabled={busy}>
                  <XCircle className="w-4 h-4" /> Reject
                </Button>
              )}
              {showPay && (
                <Button size="sm" onClick={() => setMode('pay')} disabled={busy}>
                  <Banknote className="w-4 h-4" /> Mark paid
                </Button>
              )}
              {showPost && (
                <Button size="sm" onClick={() => runAction('post')} disabled={busy}>
                  <BookCheck className="w-4 h-4" /> Post to books
                </Button>
              )}
              {showCancel && (
                <Button size="sm" variant="ghost" onClick={() => { if (confirm('Cancel this payment request?')) runAction('cancel') }} disabled={busy}>
                  <Ban className="w-4 h-4" /> Cancel
                </Button>
              )}
            </div>
          )}

          {/* Timeline */}
          <section>
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Audit trail</h3>
            <ol className="space-y-2">
              {events.map((ev) => (
                <li key={ev.id} className="flex gap-2 text-xs">
                  <Clock className="w-3.5 h-3.5 text-slate-300 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-slate-700">
                      <span className="font-medium capitalize">{ev.action}</span>
                      {ev.actor?.name ? <span className="text-slate-500"> by {ev.actor.name}</span> : null}
                      {ev.to_status ? <span className="text-slate-400"> → {ev.to_status}</span> : null}
                    </p>
                    {ev.note && <p className="text-slate-500">{ev.note}</p>}
                    <p className="text-slate-300">{format(new Date(ev.created_at), 'MMM d, yyyy HH:mm')}</p>
                  </div>
                </li>
              ))}
              {events.length === 0 && <p className="text-xs text-slate-400">No events yet.</p>}
            </ol>
          </section>
        </div>
      )}
    </Modal>
  )
}

function Meta({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-slate-400">{label}</p>
      <p className="text-slate-700 font-medium capitalize truncate">{value ?? '—'}</p>
    </div>
  )
}

function ReasonBox({ label, value, onChange, onCancel, onConfirm, busy, confirmLabel }: {
  label: string; value: string; onChange: (v: string) => void
  onCancel: () => void; onConfirm: () => void; busy: boolean; confirmLabel: string
}) {
  return (
    <div className="space-y-2 bg-slate-50 rounded-lg p-4">
      <Textarea label={label} rows={2} value={value} onChange={(e) => onChange(e.target.value)} />
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={onConfirm} disabled={busy}>{confirmLabel}</Button>
      </div>
    </div>
  )
}
