'use client'

import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { Upload, FileText, X } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Input, Textarea, Select } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/components/finance/shared'
import {
  DOCUMENT_KIND_LABELS, PAYMENT_METHOD_LABELS,
  type PaymentRequest, type Vendor, type CostCenter, type ChartAccount,
  type DocumentKind, type PaymentMethod, type AccountClass,
} from '@/types/finance'

const CLASS_ORDER: AccountClass[] = ['expense', 'asset', 'liability', 'revenue', 'equity']
const CLASS_LABELS: Record<AccountClass, string> = {
  expense: 'Expenses', asset: 'Assets', liability: 'Liabilities',
  revenue: 'Revenue', equity: 'Equity',
}

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (pr: PaymentRequest) => void
  projects: { id: string; name: string }[]
  vendors: Vendor[]
  costCenters: CostCenter[]
  accounts: ChartAccount[]
}

export function NewRequestModal({ open, onClose, onCreated, projects, vendors, costCenters, accounts }: Props) {
  const [amount, setAmount] = useState('')
  const [purpose, setPurpose] = useState('')
  const [projectId, setProjectId] = useState('')
  const [costCenterId, setCostCenterId] = useState('')
  const [coaCode, setCoaCode] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('')
  const [vendorId, setVendorId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [docKind, setDocKind] = useState<DocumentKind>('proforma')
  const [submitting, setSubmitting] = useState(false)

  const amountNum = Number(amount)
  const requiresCheck = useMemo(() => amountNum > 30000, [amountNum])

  const accountsByClass = useMemo(() => {
    const map = new Map<AccountClass, ChartAccount[]>()
    for (const a of accounts) {
      const list = map.get(a.class) ?? []
      list.push(a)
      map.set(a.class, list)
    }
    return map
  }, [accounts])

  function reset() {
    setAmount(''); setPurpose(''); setProjectId(''); setCostCenterId('')
    setCoaCode(''); setPaymentMethod(''); setVendorId(''); setFile(null); setDocKind('proforma')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!amountNum || amountNum <= 0) { toast.error('Enter a valid amount'); return }
    if (!purpose.trim()) { toast.error('Describe the purpose of this payment'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/finance/payment-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountNum,
          purpose: purpose.trim(),
          project_id: projectId || null,
          cost_center_id: costCenterId || null,
          coa_code: coaCode || null,
          payment_method: paymentMethod || null,
          vendor_id: vendorId || null,
          is_project_related: !!projectId,
        }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b?.error ?? 'Failed to create request')
      }
      const pr: PaymentRequest = await res.json()

      // Optionally attach a proforma/receipt to the fresh request.
      if (file) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('request_id', pr.id)
        const up = await fetch('/api/finance/payment-requests/upload', { method: 'POST', body: fd })
        if (up.ok) {
          const { path } = await up.json()
          await fetch(`/api/finance/payment-requests/${pr.id}/documents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind: docKind, url: path, file_name: file.name }),
          })
        } else {
          toast.error('Request created, but the document failed to upload')
        }
      }

      onCreated(pr)
      toast.success(`Request ${pr.reference} submitted`)
      reset()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create request')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New payment request" size="lg">
      <form onSubmit={submit} className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Input
              label="Amount (ETB) *"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
            {requiresCheck && (
              <p className="text-xs text-amber-600 mt-1">
                Over 30,000 ETB — will require settlement by check (BPV).
              </p>
            )}
          </div>
          <Select label="Payment method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod | '')}>
            <option value="">— Select —</option>
            {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </div>

        <Textarea
          label="Purpose *"
          rows={2}
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="What is this payment for?"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select label="Project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">— Not project related —</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Select label="Cost center" value={costCenterId} onChange={(e) => setCostCenterId(e.target.value)}>
            <option value="">— Select —</option>
            {costCenters.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select label="Account (COA)" value={coaCode} onChange={(e) => setCoaCode(e.target.value)}>
            <option value="">— Select —</option>
            {CLASS_ORDER.filter((c) => accountsByClass.has(c)).map((c) => (
              <optgroup key={c} label={CLASS_LABELS[c]}>
                {accountsByClass.get(c)!.map((a) => (
                  <option key={a.code} value={a.code}>{a.code} — {a.name}</option>
                ))}
              </optgroup>
            ))}
          </Select>
          <Select label="Vendor" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
            <option value="">— Select —</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </Select>
        </div>

        {/* Optional document */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Attach a document (optional)</label>
          {file ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
              <FileText className="w-4 h-4 text-blue-500 shrink-0" />
              <span className="flex-1 min-w-0 text-xs font-medium text-blue-800 truncate">{file.name}</span>
              <button type="button" onClick={() => setFile(null)} className="p-1 rounded hover:bg-blue-100 text-blue-400">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <label className={cn('flex items-center gap-2 px-3 py-2.5 border-2 border-dashed border-slate-200 rounded-lg cursor-pointer hover:border-blue-300 hover:bg-blue-50/30')}>
              <Upload className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-xs text-slate-400">Proforma, invoice or receipt (PDF, Word or image)</span>
              <input type="file" className="hidden" accept=".pdf,.doc,.docx,image/*"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f) }} />
            </label>
          )}
          {file && (
            <div className="mt-2">
              <Select label="Document type" value={docKind} onChange={(e) => setDocKind(e.target.value as DocumentKind)}>
                {Object.entries(DOCUMENT_KIND_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </div>
          )}
        </div>

        {amountNum > 0 && (
          <div className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
            Requesting <strong>{formatMoney(amountNum)}</strong>. This will be routed to the correct approver automatically.
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit request'}</Button>
        </div>
      </form>
    </Modal>
  )
}
