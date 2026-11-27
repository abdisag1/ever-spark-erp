'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/modal'
import { Input, Textarea, Select } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { formatETB } from '@/lib/financeFormat'
import type { PaymentRequest, CostCenter, ChartOfAccount, Vendor } from '@/types/finance'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (r: PaymentRequest) => void
  costCenters: CostCenter[]
  accounts: ChartOfAccount[]
  vendors: Vendor[]
  projects: { id: string; name: string }[]
}

const EMPTY = {
  amount: '', purpose: '', project_id: '', cost_center_id: '',
  coa_code: '', vendor_id: '', payment_method: '',
}

export function PaymentRequestForm({ open, onClose, onCreated, costCenters, accounts, vendors, projects }: Props) {
  const [f, setF] = useState({ ...EMPTY })
  const [submitting, setSubmitting] = useState(false)
  const amount = Number(f.amount)
  const requiresCheck = amount > 30000

  const set = (k: keyof typeof EMPTY, v: string) => setF((p) => ({ ...p, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return }
    if (!f.purpose.trim()) { toast.error('Describe what the payment is for'); return }

    setSubmitting(true)
    const res = await fetch('/api/finance/payment-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount,
        purpose: f.purpose.trim(),
        project_id: f.project_id || null,
        cost_center_id: f.cost_center_id || null,
        coa_code: f.coa_code || null,
        vendor_id: f.vendor_id || null,
        payment_method: f.payment_method || null,
        is_project_related: !!f.project_id,
      }),
    })
    if (res.ok) {
      const created: PaymentRequest = await res.json()
      onCreated(created)
      setF({ ...EMPTY })
      onClose()
      toast.success(`Request ${created.reference} submitted for approval`)
    } else {
      const b = await res.json().catch(() => ({}))
      toast.error(b?.error ?? 'Failed to submit request')
    }
    setSubmitting(false)
  }

  return (
    <Modal open={open} onClose={onClose} title="New payment request" size="md">
      <form onSubmit={submit} className="p-5 space-y-4">
        <Input
          label="Amount (ETB) *"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={f.amount}
          onChange={(e) => set('amount', e.target.value)}
          placeholder="0.00"
          autoFocus
        />
        {requiresCheck && (
          <p className="-mt-2 text-xs text-amber-600">
            {formatETB(amount)} is above ETB 30,000 — this will require payment by check and General Manager approval.
          </p>
        )}

        <Textarea
          label="What is this for? *"
          rows={2}
          value={f.purpose}
          onChange={(e) => set('purpose', e.target.value)}
          placeholder="e.g. Chlorine resupply for Dire Dawa site"
        />

        <div className="grid grid-cols-2 gap-3">
          <Select label="Project" value={f.project_id} onChange={(e) => set('project_id', e.target.value)}>
            <option value="">— None —</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Select label="Cost center" value={f.cost_center_id} onChange={(e) => set('cost_center_id', e.target.value)}>
            <option value="">— None —</option>
            {costCenters.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
          </Select>
        </div>

        <Select label="Expense account (COA)" value={f.coa_code} onChange={(e) => set('coa_code', e.target.value)}>
          <option value="">— Select account —</option>
          {accounts.map((a) => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
        </Select>

        <div className="grid grid-cols-2 gap-3">
          <Select label="Vendor / payee" value={f.vendor_id} onChange={(e) => set('vendor_id', e.target.value)}>
            <option value="">— None —</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </Select>
          <Select label="Payment method" value={f.payment_method} onChange={(e) => set('payment_method', e.target.value)}>
            <option value="">— Unspecified —</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="check">Check</option>
            <option value="telebirr">Telebirr</option>
            <option value="petty_cash">Petty cash</option>
            <option value="other">Other</option>
          </Select>
        </div>

        <p className="text-xs text-slate-400">
          You&apos;ll attach the proforma/receipt from the request detail. A supporting document is required before it can be marked paid.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit request'}</Button>
        </div>
      </form>
    </Modal>
  )
}
