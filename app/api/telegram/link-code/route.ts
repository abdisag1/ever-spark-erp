import { createClient } from '@/lib/supabase/server'
import { admin } from '@/lib/finance'
import { NextResponse } from 'next/server'

function genCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)]
  return s
}

// GET → current link status for the signed-in user.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await admin().from('profiles').select('telegram_user_id').eq('id', user.id).maybeSingle()
  const linked = !!(data as { telegram_user_id: number | null } | null)?.telegram_user_id
  return NextResponse.json({ linked })
}

// POST → generate a fresh one-time link code (valid 15 minutes).
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const code = genCode()
  const expires_at = new Date(Date.now() + 15 * 60 * 1000).toISOString()
  const { error } = await admin().from('telegram_link_codes').insert({ code, user_id: user.id, expires_at })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ code, expires_at })
}
