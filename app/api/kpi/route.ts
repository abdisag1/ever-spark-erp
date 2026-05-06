import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getWeekStart } from '@/lib/utils'

const KPI_SELECT = '*, user:profiles!kpis_user_id_fkey(id, name, role)'

function isColumnError(msg: string) {
  return msg.includes('end_date') || msg.includes('column') || msg.includes('does not exist')
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Try ordering by end_date; fall back if column doesn't exist yet
  const { data, error } = await supabase
    .from('kpis')
    .select(KPI_SELECT)
    .order('end_date', { ascending: true, nullsFirst: false })
    .order('week_start', { ascending: false })

  if (!error) return NextResponse.json(data)

  if (isColumnError(error.message)) {
    const { data: basic, error: e2 } = await supabase
      .from('kpis')
      .select(KPI_SELECT)
      .order('week_start', { ascending: false })
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
    return NextResponse.json(basic)
  }

  return NextResponse.json({ error: error.message }, { status: 500 })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Only admins can create KPIs' }, { status: 403 })

  const body = await request.json()
  const { user_id, metric_type, target_value, week_start, end_date } = body

  if (!user_id || !metric_type || target_value === undefined) {
    return NextResponse.json({ error: 'user_id, metric_type and target_value are required' }, { status: 400 })
  }

  // Try inserting with end_date; fall back without it if the column doesn't exist yet
  const { data, error } = await supabase
    .from('kpis')
    .insert({
      user_id,
      metric_type,
      target_value,
      actual_value: 0,
      week_start: week_start ?? getWeekStart(),
      end_date: end_date || null,
    })
    .select(KPI_SELECT)
    .single()

  if (!error) return NextResponse.json(data, { status: 201 })

  if (isColumnError(error.message)) {
    const { data: basic, error: e2 } = await supabase
      .from('kpis')
      .insert({ user_id, metric_type, target_value, actual_value: 0, week_start: week_start ?? getWeekStart() })
      .select(KPI_SELECT)
      .single()
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
    return NextResponse.json(basic, { status: 201 })
  }

  return NextResponse.json({ error: error.message }, { status: 500 })
}
