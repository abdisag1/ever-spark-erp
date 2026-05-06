import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const SELECT = `*, employee:profiles!leave_requests_employee_id_fkey(id, name, role)`

export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/leave/requests/[id]'>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can approve or reject leave' }, { status: 403 })
  }

  const { id } = await ctx.params
  const { status, admin_note } = await request.json()

  if (!['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'status must be approved or rejected' }, { status: 400 })
  }

  // Fetch the original request first
  const { data: req, error: fetchErr } = await supabase
    .from('leave_requests').select('*').eq('id', id).single()
  if (fetchErr || !req) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  if (req.status !== 'pending') {
    return NextResponse.json({ error: 'Only pending requests can be actioned' }, { status: 400 })
  }

  const adminSupa = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Update the request status
  const { data, error } = await adminSupa
    .from('leave_requests')
    .update({
      status,
      approved_by: user.id,
      admin_note: admin_note || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If approved: update the leave balance (direct update, no RPC needed)
  if (status === 'approved') {
    const year = new Date(req.start_date).getFullYear()

    // Ensure balance record exists
    await adminSupa
      .from('leave_balances')
      .upsert(
        { employee_id: req.employee_id, year, total_days: 20, days_taken: 0 },
        { onConflict: 'employee_id,year', ignoreDuplicates: true }
      )

    // Fetch current days_taken and increment
    const { data: bal } = await adminSupa
      .from('leave_balances')
      .select('days_taken')
      .eq('employee_id', req.employee_id)
      .eq('year', year)
      .single()

    await adminSupa
      .from('leave_balances')
      .update({ days_taken: (bal?.days_taken ?? 0) + req.days_requested })
      .eq('employee_id', req.employee_id)
      .eq('year', year)
  }

  // Notify the employee
  await adminSupa.from('notifications').insert({
    user_id: req.employee_id,
    title: status === 'approved' ? 'Leave request approved' : 'Leave request rejected',
    message: status === 'approved'
      ? `Your ${req.leave_type} leave (${req.start_date} – ${req.end_date}, ${req.days_requested} day(s)) has been approved.`
      : `Your ${req.leave_type} leave request was rejected.${admin_note ? ` Reason: ${admin_note}` : ''}`,
    type: 'task_assigned',
    task_id: null,
  })

  return NextResponse.json(data)
}
