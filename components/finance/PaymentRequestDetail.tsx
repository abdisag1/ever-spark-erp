'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Paperclip, Upload, FileText, ExternalLink, Clock, ShieldCheck, AlertTriangle,
} from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Input, Textarea, Select } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn, formatDateTime } from '@/lib/utils'
import { formatETB, STATUS_META, DOC_KIND_LABELS, isFinanceStaff } from '@/lib/financeFormat'
import { RECEIPT_KINDS, type PaymentRequest, type DocumentKind } from '@/types/finance'

interface Props {
  id: string
  role: string
  userId: string
  onClose: () => void
  onChanged: (r: PaymentRequest) => void
}

export function PaymentRequestDetail({ id, role, userId, onClose, onChanged }: Props) {
  const [data, setData] = useState<PaymentRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [note, setNote] = useState('')
  const [bpv, setBpv] = useState('')
  const [bankAdvice, setBankAdvice] = useState('')
  const [docKind, setDocKind] = useState<DocumentKind>('receipt')
  const [uploading, setUploading] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/finance/payment-requests/${id}`)
    if (res.ok) setData(await res.json())
    else toast.error('Could not load request')
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  const staff = isFinanceStaff(role)
  const status = data?.status
  const isRequester = data?.requester_id === userId
  const hasReceipt = !!data?.documents?.some((d) => RECEIPT_KINDS.includes(d.kind))

  const canApprove = !!data && ['submitted', 'clarification'].includes(status!) &&
    (role === 'admin' || data.current_approver_role === role) && !isRequester
  const canPay = !!data && staff && status === 'approved' &&
    data.approved_by !== userId && !isRequester
  const canPost = !!data && staff && status === 'paid'
  const canCancel = !!data && (isRequester || staff) &&
    ['draft', 'submitted', 'clarification'].includes(status!)

  async function uploadReceipt(file: File) {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const up = await fetch('/api/finance/payment-requests/upload', { method: 'POST', body: fd })
      if (!up.ok) throw new Error((await up.json().catch(() => ({})))?.error ?? 'Upload failed')
      const { path, file_name } = await up.json()
      const att = await fetch(`/api/finance/payment-requests/${id}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: docKind, path, file_name }),
      })
      if (!att.ok) throw new Error((await att.json().catch(() => ({})))?.error ?? 'Could not attach')
      toast.success('Document attached')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to attach document')
    } finally {
      setUploading(false)
    }
  }

  async function act(action: string) {
    if (action === 'reject' && !note.trim()) { toast.error('Add a reason for rejection'); return }
    if (action === 'clarify' && !note.trim()) { toast.error('Say what needs clarifying'); return }
    if (action === 'pay' && data?.requires_check && !bpv.trim()) { toast.error('Enter the check / BPV number'); return }

    setActing(true)
    const res = await fetch(`/api/finance/payment-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        note: note || undefined,
        rejected_reason: action === 'reject' ? note : undefined,
        bpv_number: bpv || undefined,
        bank_advice_ref: bankAdvice || undefined,
      }),
    })
    if (res.ok) {
      const updated: PaymentRequest = await res.json()
      onChanged(updated)
      setNote(''); setBpv(''); setBankAdvice('')
      const past: Record<string, string> = {
        approve: 'approved', reject: 'rejected', clarify: 'sent back for clarification',
        pay: 'marked paid', post: 'posted to the books', cancel: 'cancelled',
      }
      toast.success(`Request ${past[action] ?? 'updated'}`)
      await load()
    } else {
      const b = await res.json().catch(() => ({}))
      toast.error(b?.error ?? 'Action failed')
    }
    setActing(false)
  }

  const meta = status ? STATUS_META[status] : null

  return (
    <Modal open onClose={onClose} title={data ? data.reference : 'Payment request'} size="lg">
      {loading || !data ? (
        <div className="p-10 text-center text-sm text-slate-400">Loading…</div>
      ) : (
        <div className="p-5 space-y-5">
          {/* Header line */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-base font-semibold text-slate-900">{data.purpose}</p>
              <p className="text-xs text-slate-400">Raised by {data.requester?.name ?? '—'} · {formatDateTime(data.created_at)}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-lg font-bold text-slate-900">{formatETB(Number(data.amount), data.currency)}</p>
              {meta && <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium', meta.cls)}>{meta.label}</span>}
            </div>
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            {[
              ['Project', data.project?.name],
              ['Vendor', data.vendor?.name],
              ['COA', data.coa_code],
              ['Method', data.payment_method?.replace('_', ' ')],
              ['Approver tier', data.current_approver_role],
              ['Approved by', data.approver?.name],
            ].map(([label, val]) => (
              <div key={label as string}>
                <p className="text-slate-400">{label}</p>
                <p className="font-medium text-slate-700 capitalize truncate">{(val as string) || '—'}</p>
              </div>
            ))}
          </div>

          {data.requires_check && (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> Above ETB 30,000 — must be paid by check (BPV number required).
            </div>
          )}
          {data.rejected_reason && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              Rejected: {data.rejected_reason}
            </p>
          )}

          {/* Documents */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5"><Paperclip className="w-4 h-4" /> Supporting documents</h4>
              {!hasReceipt && <span className="text-[11px] text-amber-600">receipt/invoice needed before payment</span>}
            </div>

            <div className="space-y-1.5">
              {(data.documents ?? []).length === 0 && <p className="text-xs text-slate-400">No documents attached yet.</p>}
              {(data.documents ?? []).map((d) => (
                <a
                  key={d.id}
                  href={d.signed_url ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="flex-1 min-w-0 text-xs font-medium text-slate-700 truncate">{d.file_name}</span>
                  <span className="text-[10px] text-slate-500 border border-slate-200 rounded px-1 shrink-0">{DOC_KIND_LABELS[d.kind]}</span>
                  <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                </a>
              ))}
            </div>

            {!['posted', 'cancelled', 'rejected'].includes(data.status) && (
              <div className="flex items-end gap-2 mt-2">
                <Select label="Type" value={docKind} onChange={(e) => setDocKind(e.target.value as DocumentKind)} className="w-36">
                  {Object.entries(DOC_KIND_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
                <label className={cn('flex-1 flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed border-slate-200 rounded-lg cursor-pointer text-xs text-slate-400 transition-colors', uploading ? 'opacity-50 pointer-events-none' : 'hover:border-blue-300 hover:bg-blue-50/30')}>
                  <Upload className="w-4 h-4" /> {uploading ? 'Uploading…' : 'Attach file (PDF, Word, image)'}
                  <input type="file" className="hidden" accept=".pdf,.doc,.docx,image/*"
                    onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadReceipt(file) }} />
                </label>
              </div>
            )}
          </section>

          {/* Timeline */}
          <section>
            <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5 mb-2"><Clock className="w-4 h-4" /> Activity</h4>
            <ol className="space-y-2 border-l border-slate-200 pl-4">
              {(data.events ?? []).map((ev) => (
                <li key={ev.id} className="relative">
                  <span className="absolute -left-[21px] top-1 w-2 h-2 rounded-full bg-slate-300" />
                  <p className="text-xs text-slate-700">
                    <span className="font-medium capitalize">{ev.action.replace('_', ' ')}</span>
                    {ev.actor?.name ? ` · ${ev.actor.name}` : ''}
                  </p>
                  {ev.note && <p className="text-xs text-slate-400">{ev.note}</p>}
                  <p className="text-[10px] text-slate-300">{formatDateTime(ev.created_at)}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* Actions */}
          {(canApprove || canPay || canPost || canCancel) && (
            <section className="border-t border-slate-100 pt-4 space-y-3">
              {(canApprove) && (
                <Textarea label="Note (for clarification or rejection)" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional for approval; required to reject or request clarification" />
              )}
              {canPay && (
                <div className="grid grid-cols-2 gap-3">
                  <Input label={`Check / BPV number${data.requires_check ? ' *' : ''}`} value={bpv} onChange={(e) => setBpv(e.target.value)} placeholder="e.g. 0012345" />
                  <Input label="Bank advice ref" value={bankAdvice} onChange={(e) => setBankAdvice(e.target.value)} placeholder="optional" />
                </div>
              )}
              {canPay && !hasReceipt && (
                <p className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Attach a receipt/invoice/BPV above before marking paid.</p>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                {canCancel && <Button variant="ghost" disabled={acting} onClick={() => act('cancel')}>Cancel request</Button>}
                {canApprove && <Button variant="outline" disabled={acting} onClick={() => act('clarify')}>Request clarification</Button>}
                {canApprove && <Button variant="destructive" disabled={acting} onClick={() => act('reject')}>Reject</Button>}
                {canApprove && <Button disabled={acting} onClick={() => act('approve')}><ShieldCheck className="w-4 h-4" /> Approve</Button>}
                {canPay && <Button disabled={acting} onClick={() => act('pay')}>Mark paid</Button>}
                {canPost && <Button disabled={acting} onClick={() => act('post')}>Post to books</Button>}
              </div>
            </section>
          )}
        </div>
      )}
    </Modal>
  )
}
