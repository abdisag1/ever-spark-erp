import { createClient } from '@/lib/supabase/server'
import { getBot } from '@/lib/telegram/bot'
import { NextResponse } from 'next/server'

// Admin-only: register the Telegram webhook with this deployment's URL.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Only an admin can set the webhook' }, { status: 403 })

  const base = process.env.NEXT_PUBLIC_SITE_URL
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!base) return NextResponse.json({ error: 'NEXT_PUBLIC_SITE_URL is not set' }, { status: 400 })

  const url = `${base.replace(/\/$/, '')}/api/telegram/webhook`
  try {
    const bot = getBot()
    await bot.api.setWebhook(url, secret ? { secret_token: secret } : undefined)
    return NextResponse.json({ ok: true, url })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to set webhook' }, { status: 500 })
  }
}
