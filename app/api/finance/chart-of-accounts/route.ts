import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const CLASSES = ['asset', 'liability', 'equity', 'revenue', 'expense']

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase.from('chart_of_accounts').select('*').order('code')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['finance', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Only finance or admin can add accounts' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const code = String(body?.code ?? '').trim()
  if (!/^\d{9}$/.test(code)) {
    return NextResponse.json({ error: 'code must be a 9-digit number with no spaces' }, { status: 400 })
  }
  if (!body?.name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  if (!CLASSES.includes(body?.class)) {
    return NextResponse.json({ error: `class must be one of: ${CLASSES.join(', ')}` }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('chart_of_accounts')
    .insert({ code, name: body.name.trim(), class: body.class })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
