import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const EOM_SELECT = `
  *,
  employee:profiles!employee_of_month_user_id_fkey(id, name, role),
  assigner:profiles!employee_of_month_assigned_by_fkey(id, name)
`

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const month = url.searchParams.get('month') ?? new Date().getMonth() + 1
  const year  = url.searchParams.get('year')  ?? new Date().getFullYear()

  const { data, error } = await supabase
    .from('employee_of_month')
    .select(EOM_SELECT)
    .eq('month', month)
    .eq('year', year)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can assign Employee of the Month' }, { status: 403 })
  }

  const { user_id, month, year, reason } = await request.json()

  if (!user_id || !month || !year) {
    return NextResponse.json({ error: 'user_id, month and year are required' }, { status: 400 })
  }

  // Upsert — one winner per month/year
  const { data, error } = await supabase
    .from('employee_of_month')
    .upsert(
      { user_id, assigned_by: user.id, month, year, reason: reason || null },
      { onConflict: 'month,year' }
    )
    .select(EOM_SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
