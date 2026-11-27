import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function admin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// GET — is the current user's Telegram linked?
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase.from('profiles').select('telegram_user_id').eq('id', user.id).single()
  return NextResponse.json({ linked: !!data?.telegram_user_id })
}

// POST — generate a fresh one-time link code (valid 15 minutes).
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 6-char human-friendly code (no ambiguous chars).
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const code = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
  const expires_at = new Date(Date.now() + 15 * 60 * 1000).toISOString()

  // Invalidate any previous unused codes, then insert the new one (service role).
  const a = admin()
  await a.from('telegram_link_codes').update({ used: true }).eq('user_id', user.id).eq('used', false)
  const { error } = await a.from('telegram_link_codes').insert({ code, user_id: user.id, expires_at })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ code, expires_at }, { status: 201 })
}

// DELETE — unlink the current user's Telegram account.
export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await admin().from('profiles').update({ telegram_user_id: null }).eq('id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
