'use client'

import { useState } from 'react'
import { differenceInDays } from 'date-fns'
import { Card, CardContent } from '@/components/ui/card'
import { ProgressBar } from '@/components/ui/progress'
import { Avatar } from '@/components/ui/avatar'
import { Pencil, Check, X, CheckCircle2, XCircle, Clock, Trash2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { KPI } from '@/types'

interface KPICardProps {
  kpi: KPI
  isAdmin: boolean
  onUpdate: (updated: KPI) => void
  onDelete: (id: string) => void
}

type KPIStatus = 'met' | 'missed' | 'due_soon' | 'active' | 'no_date'

function getStatus(kpi: KPI): KPIStatus {
  if (!kpi.end_date) return 'no_date'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(kpi.end_date)
  due.setHours(0, 0, 0, 0)
  if (due < today) {
    return kpi.actual_value >= kpi.target_value ? 'met' : 'missed'
  }
  const daysLeft = differenceInDays(due, today)
  return daysLeft <= 7 ? 'due_soon' : 'active'
}

const STATUS_CONFIG = {
  met:      { label: 'Met',       icon: CheckCircle2, pill: 'bg-green-100 text-green-700',  dot: 'text-green-500' },
  missed:   { label: 'Missed',    icon: XCircle,      pill: 'bg-red-100 text-red-700',      dot: 'text-red-500' },
  due_soon: { label: 'Due soon',  icon: Clock,        pill: 'bg-orange-100 text-orange-700', dot: 'text-orange-500' },
  active:   { label: 'Active',    icon: Clock,        pill: 'bg-blue-50 text-blue-700',     dot: 'text-blue-400' },
  no_date:  { label: '',          icon: Clock,        pill: '',                              dot: '' },
}

export function KPICard({ kpi, isAdmin, onUpdate, onDelete }: KPICardProps) {
  const [editingActual, setEditingActual] = useState(false)
  const [actualValue, setActualValue] = useState(String(kpi.actual_value))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const pct = Math.min(100, Math.round((kpi.actual_value / (kpi.target_value || 1)) * 100))
  const barColor: 'green' | 'blue' | 'orange' | 'red' =
    pct >= 100 ? 'green' : pct >= 60 ? 'blue' : pct >= 30 ? 'orange' : 'red'

  const status = getStatus(kpi)
  const statusCfg = STATUS_CONFIG[status]
  const StatusIcon = statusCfg.icon

  const daysLeft = kpi.end_date
    ? differenceInDays(new Date(kpi.end_date), new Date())
    : null

  async function saveActual() {
    const num = parseFloat(actualValue)
    if (isNaN(num) || num < 0) { toast.error('Enter a valid number'); return }
    setSaving(true)
    const res = await fetch(`/api/kpi/${kpi.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actual_value: num }),
    })
    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      toast.error(b?.error ?? 'Failed to update')
      setSaving(false)
      return
    }
    const updated: KPI = await res.json()
    onUpdate(updated)
    setEditingActual(false)
    toast.success('KPI updated')
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm(`Delete "${kpi.metric_type}"?`)) return
    setDeleting(true)
    const res = await fetch(`/api/kpi/${kpi.id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Failed to delete'); setDeleting(false); return }
    onDelete(kpi.id)
    toast.success('KPI deleted')
  }

  return (
    <Card className={cn(status === 'missed' && 'border-red-200', status === 'met' && 'border-green-200')}>
      <CardContent className="pt-4">

        {/* Header: metric + status + admin actions */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{kpi.metric_type}</p>
            {kpi.user && (
              <div className="flex items-center gap-1.5 mt-1">
                <Avatar name={kpi.user.name} size="sm" />
                <span className="text-xs text-slate-500">{kpi.user.name}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Status badge */}
            {status !== 'no_date' && (
              <span className={cn('flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', statusCfg.pill)}>
                <StatusIcon className="w-3 h-3" />
                {status === 'due_soon' && daysLeft !== null
                  ? `${daysLeft}d left`
                  : statusCfg.label}
              </span>
            )}
            {/* Percentage */}
            <span className={cn('text-lg font-bold',
              barColor === 'green' ? 'text-green-600' :
              barColor === 'blue' ? 'text-blue-600' :
              barColor === 'orange' ? 'text-orange-500' : 'text-red-500'
            )}>
              {pct}%
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <ProgressBar value={kpi.actual_value} max={kpi.target_value} color={barColor} className="mb-3" />

        {/* Actual value row */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-600">
            {isAdmin && editingActual ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={actualValue}
                  onChange={(e) => setActualValue(e.target.value)}
                  className="w-20 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveActual()
                    if (e.key === 'Escape') setEditingActual(false)
                  }}
                />
                <span className="text-slate-400">/ {kpi.target_value}</span>
                <button onClick={saveActual} disabled={saving} className="p-1 bg-blue-600 text-white rounded disabled:opacity-50">
                  <Check className="w-3 h-3" />
                </button>
                <button onClick={() => setEditingActual(false)} className="p-1 rounded hover:bg-slate-100 text-slate-400">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <span className="font-medium">{kpi.actual_value} / {kpi.target_value}</span>
            )}
          </div>

          {/* Admin controls */}
          {isAdmin && !editingActual && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setActualValue(String(kpi.actual_value)); setEditingActual(true) }}
                className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                title="Edit actual value"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                title="Delete KPI"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Footer: dates */}
        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
          <span>Started {formatDate(kpi.week_start)}</span>
          {kpi.end_date && (
            <span className={cn('font-medium',
              status === 'missed' ? 'text-red-500' :
              status === 'met' ? 'text-green-600' :
              status === 'due_soon' ? 'text-orange-500' : 'text-slate-500'
            )}>
              Due {formatDate(kpi.end_date)}
            </span>
          )}
        </div>

      </CardContent>
    </Card>
  )
}
