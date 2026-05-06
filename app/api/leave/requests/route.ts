import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { countWorkingDays } from '@/lib/utils'

const SELECT = `*, employee:profiles!leave_requests_employee_id_fkey(id, name, role),
  approver:profiles!leave_requests_approved_by_fkey(id, name)`

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  let query = supabase.from('leave_requests').select(SELECT).order('created_at', { ascending: false })
  if (profile?.role !== 'admin') query = query.eq('employee_id', user.id)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { leave_type, start_date, end_date, reason, attachment_url, attachment_name } = await request.json()
  if (!leave_type || !start_date || !end_date) {
    return NextResponse.json({ error: 'leave_type, start_date and end_date are required' }, { status: 400 })
  }
  if (end_date < start_date) {
    return NextResponse.json({ error: 'end_date cannot be before start_date' }, { status: 400 })
  }

  const days_requested = countWorkingDays(start_date, end_date)
  if (days_requested === 0) {
    return NextResponse.json({ error: 'Selected dates contain no working days' }, { status: 400 })
  }

  // Check remaining balance for annual leave
  if (leave_type === 'annual') {
    const year = new Date(start_date).getFullYear()
    const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data: bal } = await admin.from('leave_balances').select('total_days, days_taken').eq('employee_id', user.id).eq('year', year).maybeSingle()
    const remaining = (bal?.total_days ?? 20) - (bal?.days_taken ?? 0)
    if (days_requested > remaining) {
      return NextResponse.json({ error: `Insufficient leave balance. You have ${remaining} days remaining.` }, { status: 400 })
    }
  }

  const { data, error } = await supabase
    .from('leave_requests')
    .insert({
      employee_id: user.id,
      leave_type,
      start_date,
      end_date,
      days_requested,
      reason: reason || null,
      attachment_url: attachment_url || null,
      attachment_name: attachment_name || null,
    })
    .select(SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify admins
  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: admins } = await admin.from('profiles').select('id').eq('role', 'admin').eq('status', 'active')
  const { data: emp } = await admin.from('profiles').select('name').eq('id', user.id).single()
  if (admins?.length) {
    await admin.from('notifications').insert(
      admins.map(a => ({
        user_id: a.id,
        title: 'New leave request',
        message: `${emp?.name ?? 'An employee'} requested ${days_requested} day(s) of ${leave_type} leave (${start_date} – ${end_date})`,
        type: 'task_assigned',
        task_id: null,
      }))
    )
  }

  return NextResponse.json(data, { status: 201 })
}
