import { createClient } from '@/lib/supabase/server'
import { isFinanceStaff } from '@/lib/finance'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/finance/chart-of-accounts?class=expense
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const klass = request.nextUrl.searchParams.get('class')
  let query = supabase.from('chart_of_accounts').select('*').eq('active', true).order('code', { ascending: true })
  if (klass) query = query.eq('class', klass)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!isFinanceStaff(profile?.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { code, name, class: klass } = await request.json()
  const valid = ['asset', 'liability', 'equity', 'revenue', 'cost', 'expense', 'other', 'control']
  if (!code || !name || !valid.includes(klass)) {
    return NextResponse.json({ error: 'code, name and a valid class are required' }, { status: 400 })
  }

  const { data, error } = await supabase.from('chart_of_accounts').insert({ code, name, class: klass }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
