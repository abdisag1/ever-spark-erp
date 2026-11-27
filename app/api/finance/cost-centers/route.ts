import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase.from('cost_centers').select('*').order('code')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['finance', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Only finance or admin can add cost centers' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body?.code?.trim() || !body?.name?.trim()) {
    return NextResponse.json({ error: 'code and name are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('cost_centers')
    .insert({ code: body.code.trim().toUpperCase(), name: body.name.trim() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
