import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET → list DOA thresholds (finance/admin only)
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'finance' && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase.from('approval_thresholds').select('*')
    .order('kind', { ascending: true }).order('min_amount', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PATCH { id, min_amount?, max_amount?, required_role?, requires_check? } → admin (GM) only
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Only the GM (admin) can change approval limits' }, { status: 403 })

  const { id, min_amount, max_amount, required_role, requires_check } = await request.json()
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  if (required_role && !['finance', 'admin'].includes(required_role)) {
    return NextResponse.json({ error: 'required_role must be finance or admin' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}
  if (min_amount !== undefined) patch.min_amount = min_amount
  if (max_amount !== undefined) patch.max_amount = max_amount
  if (required_role !== undefined) patch.required_role = required_role
  if (requires_check !== undefined) patch.requires_check = requires_check

  const { data, error } = await supabase.from('approval_thresholds').update(patch).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
