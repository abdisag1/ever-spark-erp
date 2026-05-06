import { createClient } from '@/lib/supabase/server'
import { KPIDashboard } from '@/components/kpi/KPIDashboard'
import { Header } from '@/components/layout/Header'
import type { KPI, Profile, EmployeeOfMonth } from '@/types'

export default async function KPIPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'

  const now = new Date()
  const month = now.getMonth() + 1
  const year  = now.getFullYear()

  const [{ data: kpis }, { data: users }, { data: eom }] = await Promise.all([
    supabase
      .from('kpis')
      .select('*, user:profiles!kpis_user_id_fkey(id, name, role)')
      .order('week_start', { ascending: false }),
    isAdmin
      ? supabase.from('profiles').select('id, name, role').order('name')
      : Promise.resolve({ data: [] }),
    supabase
      .from('employee_of_month')
      .select('*, employee:profiles!employee_of_month_user_id_fkey(id, name, role), assigner:profiles!employee_of_month_assigned_by_fkey(id, name)')
      .eq('month', month)
      .eq('year', year)
      .maybeSingle(),
  ])

  return (
    <div>
      <Header title="KPI Dashboard" description="Track performance targets across the team" />
      <KPIDashboard
        initialKPIs={(kpis as KPI[]) ?? []}
        isAdmin={isAdmin}
        users={(users as Profile[]) ?? []}
        currentEoM={(eom as EmployeeOfMonth) ?? null}
        currentMonth={month}
        currentYear={year}
      />
    </div>
  )
}
