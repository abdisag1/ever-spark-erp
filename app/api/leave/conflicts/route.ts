import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { start_date, end_date, exclude_request_id } = await request.json()
  if (!start_date || !end_date) {
    return NextResponse.json({ error: 'start_date and end_date required' }, { status: 400 })
  }

  // Find approved requests that overlap with the given date range
  let query = supabase
    .from('leave_requests')
    .select('*, employee:profiles!leave_requests_employee_id_fkey(id, name)')
    .eq('status', 'approved')
    .lte('start_date', end_date)
    .gte('end_date', start_date)

  if (exclude_request_id) {
    query = query.neq('id', exclude_request_id)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
