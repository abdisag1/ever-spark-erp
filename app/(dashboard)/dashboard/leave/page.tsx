import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { Header } from '@/components/layout/Header'
import { LeaveAdminDashboard } from '@/components/leave/LeaveAdminDashboard'
import { LeaveEmployeeDashboard } from '@/components/leave/LeaveEmployeeDashboard'
import type { LeaveRequest, LeaveBalance, Profile } from '@/types'

export default async function LeavePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'
  const year = new Date().getFullYear()

  const adminSupa = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  if (isAdmin) {
    // Admin: fetch all requests, all balances, all employees
    const [{ data: requests }, { data: employees }] = await Promise.all([
      adminSupa.from('leave_requests')
        .select('*, employee:profiles!leave_requests_employee_id_fkey(id, name, role), approver:profiles!leave_requests_approved_by_fkey(id, name)')
        .order('created_at', { ascending: false }),
      adminSupa.from('profiles').select('id, name, role').eq('status', 'active').order('name'),
    ])

    // Ensure balance records exist for all employees
    const employeeList = (employees as Profile[]) ?? []
    for (const emp of employeeList) {
      await adminSupa.from('leave_balances')
        .upsert({ employee_id: emp.id, year, total_days: 20, days_taken: 0 }, { onConflict: 'employee_id,year', ignoreDuplicates: true })
    }
    const { data: balances } = await adminSupa.from('leave_balances').select('*').eq('year', year)

    return (
      <div>
        <Header title="Leave Management" description="Manage employee leave requests and balances" />
        <LeaveAdminDashboard
          requests={(requests as LeaveRequest[]) ?? []}
          balances={(balances as LeaveBalance[]) ?? []}
          employees={employeeList}
        />
      </div>
    )
  }

  // Employee view
  const [{ data: requests }] = await Promise.all([
    supabase.from('leave_requests')
      .select('*')
      .eq('employee_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  // Ensure balance exists
  await adminSupa.from('leave_balances')
    .upsert({ employee_id: user.id, year, total_days: 20, days_taken: 0 }, { onConflict: 'employee_id,year', ignoreDuplicates: true })
  const { data: balance } = await adminSupa.from('leave_balances').select('*').eq('employee_id', user.id).eq('year', year).single()

  const defaultBalance: LeaveBalance = { id: '', employee_id: user.id, year, total_days: 20, days_taken: 0 }

  return (
    <div>
      <Header title="My Leave" description="View your leave balance, request time off, and track requests" />
      <LeaveEmployeeDashboard
        requests={(requests as LeaveRequest[]) ?? []}
        balance={(balance as LeaveBalance) ?? defaultBalance}
      />
    </div>
  )
}
