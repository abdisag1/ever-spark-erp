'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { KPICard } from './KPICard'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input, Select } from '@/components/ui/input'
import { Avatar } from '@/components/ui/avatar'
import { Plus, CheckCircle2, XCircle, Clock, Trophy, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { getWeekStart } from '@/lib/utils'
import type { KPI, Profile, EmployeeOfMonth } from '@/types'

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

interface KPIDashboardProps {
  initialKPIs: KPI[]
  isAdmin: boolean
  users: Profile[]
  currentEoM: EmployeeOfMonth | null
  currentMonth: number
  currentYear: number
}

type FilterTab = 'all' | 'met' | 'active' | 'missed'

export function KPIDashboard({ initialKPIs, isAdmin, users, currentEoM, currentMonth, currentYear }: KPIDashboardProps) {
  const [kpis, setKPIs] = useState<KPI[]>(initialKPIs)
  const [eom, setEom] = useState<EmployeeOfMonth | null>(currentEoM)
  const [addKpiOpen, setAddKpiOpen] = useState(false)
  const [eomOpen, setEomOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<FilterTab>('all')

  const [kpiForm, setKpiForm] = useState({ user_id: '', metric_type: '', target_value: '', end_date: '' })
  const [eomForm, setEomForm] = useState({ user_id: eom?.user_id ?? '', reason: eom?.reason ?? '' })
  const [savingKpi, setSavingKpi] = useState(false)
  const [savingEom, setSavingEom] = useState(false)

  function getKPIStatus(kpi: KPI): 'met' | 'missed' | 'active' {
    if (!kpi.end_date) return 'active'
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const due = new Date(kpi.end_date); due.setHours(0, 0, 0, 0)
    if (due < today) return kpi.actual_value >= kpi.target_value ? 'met' : 'missed'
    return 'active'
  }

  const stats = useMemo(() => {
    const met    = kpis.filter((k) => getKPIStatus(k) === 'met').length
    const missed = kpis.filter((k) => getKPIStatus(k) === 'missed').length
    const active = kpis.filter((k) => getKPIStatus(k) === 'active').length
    return { met, missed, active, total: kpis.length }
  }, [kpis])

  const filteredKPIs = useMemo(() =>
    activeTab === 'all' ? kpis : kpis.filter((k) => getKPIStatus(k) === activeTab),
    [kpis, activeTab]
  )

  const chartData = kpis.map((k) => ({
    name: k.metric_type.length > 14 ? k.metric_type.slice(0, 14) + '…' : k.metric_type,
    target: k.target_value,
    actual: k.actual_value,
    pct: Math.min(100, Math.round((k.actual_value / (k.target_value || 1)) * 100)),
  }))

  async function handleAddKpi() {
    if (!kpiForm.user_id || !kpiForm.metric_type || !kpiForm.target_value) {
      toast.error('User, metric and target are required'); return
    }
    setSavingKpi(true)
    const res = await fetch('/api/kpi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: kpiForm.user_id,
        metric_type: kpiForm.metric_type,
        target_value: parseFloat(kpiForm.target_value),
        end_date: kpiForm.end_date || null,
        week_start: getWeekStart(),
      }),
    })
    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      toast.error(b?.error ?? 'Failed to create KPI')
      setSavingKpi(false); return
    }
    const kpi: KPI = await res.json()
    setKPIs((prev) => [kpi, ...prev])
    setAddKpiOpen(false)
    setKpiForm({ user_id: '', metric_type: '', target_value: '', end_date: '' })
    toast.success('KPI created')
    setSavingKpi(false)
  }

  async function handleSetEom() {
    if (!eomForm.user_id) { toast.error('Select a team member'); return }
    setSavingEom(true)
    const res = await fetch('/api/employee-of-month', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: eomForm.user_id, month: currentMonth, year: currentYear, reason: eomForm.reason || null }),
    })
    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      toast.error(b?.error ?? 'Failed to assign')
      setSavingEom(false); return
    }
    const updated: EmployeeOfMonth = await res.json()
    setEom(updated)
    setEomOpen(false)
    toast.success('Employee of the Month assigned')
    setSavingEom(false)
  }

  const TABS: { key: FilterTab; label: string; count: number; icon: React.ElementType; color: string }[] = [
    { key: 'all',    label: 'All',    count: stats.total,  icon: Clock,        color: 'text-slate-600' },
    { key: 'active', label: 'Active', count: stats.active, icon: Clock,        color: 'text-blue-600' },
    { key: 'met',    label: 'Met',    count: stats.met,    icon: CheckCircle2, color: 'text-green-600' },
    { key: 'missed', label: 'Missed', count: stats.missed, icon: XCircle,      color: 'text-red-600' },
  ]

  return (
    <div className="space-y-6">

      {/* ── Employee of the Month banner ── */}
      <div className={`rounded-xl border p-5 ${eom ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200' : 'bg-slate-50 border-slate-200 border-dashed'}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${eom ? 'bg-amber-100' : 'bg-slate-100'}`}>
              <Trophy className={`w-5 h-5 ${eom ? 'text-amber-600' : 'text-slate-400'}`} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Employee of the Month — {MONTH_NAMES[currentMonth - 1]} {currentYear}
              </p>
              {eom?.employee ? (
                <div className="flex items-center gap-2 mt-1">
                  <Avatar name={eom.employee.name} size="sm" />
                  <span className="text-base font-bold text-slate-900">{eom.employee.name}</span>
                  <span className="text-xs text-slate-500 capitalize">· {eom.employee.role.replace('_', ' ')}</span>
                </div>
              ) : (
                <p className="text-sm text-slate-400 mt-0.5">Not assigned yet for this month</p>
              )}
              {eom?.reason && (
                <p className="text-sm text-amber-800 mt-1.5 italic">"{eom.reason}"</p>
              )}
            </div>
          </div>

          {isAdmin && (
            <button
              onClick={() => { setEomForm({ user_id: eom?.user_id ?? '', reason: eom?.reason ?? '' }); setEomOpen(true) }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-white border border-amber-300 rounded-lg hover:bg-amber-50 transition-colors shrink-0"
            >
              <Pencil className="w-3.5 h-3.5" />
              {eom ? 'Change' : 'Assign'}
            </button>
          )}
        </div>
      </div>

      {/* ── Summary strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total KPIs', value: stats.total,  color: 'text-slate-900', bg: 'bg-white' },
          { label: 'Active',     value: stats.active, color: 'text-blue-600',  bg: 'bg-blue-50' },
          { label: 'Met',        value: stats.met,    color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Missed',     value: stats.missed, color: 'text-red-600',   bg: 'bg-red-50' },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-xl border border-slate-200 px-4 py-3`}>
            <p className="text-xs text-slate-500 mb-0.5">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Chart ── */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Performance Overview</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barGap={4}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value, name) => [value, name === 'actual' ? 'Actual' : 'Target']} />
                <Bar dataKey="target" fill="#e2e8f0" radius={[4, 4, 0, 0]} name="Target" />
                <Bar dataKey="actual" radius={[4, 4, 0, 0]} name="Actual">
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.pct >= 100 ? '#22c55e' : entry.pct >= 60 ? '#3b82f6' : entry.pct >= 30 ? '#f97316' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* ── KPI list header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          {TABS.map(({ key, label, count, icon: Icon, color }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${activeTab === key ? color : ''}`} />
              {label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ml-0.5 ${activeTab === key ? 'bg-slate-100' : 'bg-white'}`}>
                {count}
              </span>
            </button>
          ))}
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setAddKpiOpen(true)}>
            <Plus className="w-3.5 h-3.5" /> Add KPI
          </Button>
        )}
      </div>

      {/* ── KPI grid ── */}
      {filteredKPIs.length === 0 ? (
        <div className="text-center py-10 text-sm text-slate-400">
          {activeTab === 'all' ? 'No KPIs set yet.' : `No ${activeTab} KPIs.`}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredKPIs.map((kpi) => (
            <KPICard key={kpi.id} kpi={kpi} isAdmin={isAdmin}
              onUpdate={(u) => setKPIs((prev) => prev.map((k) => k.id === u.id ? u : k))}
              onDelete={(id) => setKPIs((prev) => prev.filter((k) => k.id !== id))}
            />
          ))}
        </div>
      )}

      {/* ── Add KPI modal ── */}
      <Modal open={addKpiOpen} onClose={() => setAddKpiOpen(false)} title="Add KPI" size="sm">
        <div className="p-5 space-y-4">
          <Select label="Assign to *" value={kpiForm.user_id} onChange={(e) => setKpiForm((f) => ({ ...f, user_id: e.target.value }))}>
            <option value="">Select team member…</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
          <Input label="Metric *" placeholder="e.g. Calls Made, Demos Scheduled"
            value={kpiForm.metric_type} onChange={(e) => setKpiForm((f) => ({ ...f, metric_type: e.target.value }))} />
          <Input label="Target value *" type="number" placeholder="50"
            value={kpiForm.target_value} onChange={(e) => setKpiForm((f) => ({ ...f, target_value: e.target.value }))} />
          <Input label="End date (deadline)" type="date"
            value={kpiForm.end_date} onChange={(e) => setKpiForm((f) => ({ ...f, end_date: e.target.value }))} />
          <p className="text-xs text-slate-400">
            After the end date, the system marks the KPI as <strong>Met</strong> or <strong>Missed</strong> automatically.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setAddKpiOpen(false)}>Cancel</Button>
            <Button onClick={handleAddKpi} disabled={savingKpi}>{savingKpi ? 'Creating…' : 'Create KPI'}</Button>
          </div>
        </div>
      </Modal>

      {/* ── Employee of Month modal (admin only) ── */}
      <Modal open={eomOpen} onClose={() => setEomOpen(false)} title={`Employee of the Month — ${MONTH_NAMES[currentMonth - 1]} ${currentYear}`} size="sm">
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
            <Trophy className="w-4 h-4 shrink-0" />
            Recognise outstanding performance for this month.
          </div>
          <Select label="Employee *" value={eomForm.user_id} onChange={(e) => setEomForm((f) => ({ ...f, user_id: e.target.value }))}>
            <option value="">Select team member…</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Recognition note <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={eomForm.reason}
              onChange={(e) => setEomForm((f) => ({ ...f, reason: e.target.value }))}
              rows={3}
              placeholder="Why are they being recognised this month?"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setEomOpen(false)}>Cancel</Button>
            <Button onClick={handleSetEom} disabled={savingEom || !eomForm.user_id}>
              {savingEom ? 'Saving…' : eom ? 'Update' : 'Assign'}
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  )
}
