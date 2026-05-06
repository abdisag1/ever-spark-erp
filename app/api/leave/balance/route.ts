import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const year = parseInt(request.nextUrl.searchParams.get('year') ?? String(new Date().getFullYear()))
  const employeeId = request.nextUrl.searchParams.get('employee_id') ?? user.id

  // If requesting another employee's balance, must be admin
  if (employeeId !== user.id) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  // Ensure balance record exists
  await admin.from('leave_balances')
    .upsert({ employee_id: employeeId, year, total_days: 20, days_taken: 0 }, { onConflict: 'employee_id,year', ignoreDuplicates: true })

  const { data, error } = await admin.from('leave_balances').select('*').eq('employee_id', employeeId).eq('year', year).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
