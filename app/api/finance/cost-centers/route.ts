import { createClient } from '@/lib/supabase/server'
import { isFinanceStaff } from '@/lib/finance'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase.from('cost_centers').select('*')
    .eq('active', true).order('code', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!isFinanceStaff(profile?.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { code, name } = await request.json()
  if (!code || !name) return NextResponse.json({ error: 'code and name are required' }, { status: 400 })

  const { data, error } = await supabase.from('cost_centers').insert({ code, name }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
