import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase.from('vendors').select('*').order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['finance', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Only finance or admin can add vendors' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body?.name?.trim()) return NextResponse.json({ error: 'Vendor name is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('vendors')
    .insert({
      name: body.name.trim(),
      tin: body.tin || null,
      phone: body.phone || null,
      email: body.email || null,
      bank_name: body.bank_name || null,
      bank_account: body.bank_account || null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
