import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// POST — register (or refresh) the Telegram webhook. Admin only.
// Points Telegram at <NEXT_PUBLIC_SITE_URL>/api/telegram/webhook and sets the
// secret token so the webhook route can verify inbound calls.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can register the webhook' }, { status: 403 })
  }

  const token = process.env.TELEGRAM_BOT_TOKEN
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!token || !siteUrl) {
    return NextResponse.json(
      { error: 'TELEGRAM_BOT_TOKEN and NEXT_PUBLIC_SITE_URL must be set' },
      { status: 500 }
    )
  }

  const webhookUrl = `${siteUrl.replace(/\/$/, '')}/api/telegram/webhook`
  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secret || undefined,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: true,
    }),
  })
  const result = await res.json().catch(() => ({}))

  if (!res.ok || !result.ok) {
    return NextResponse.json({ error: result.description ?? 'Failed to set webhook', result }, { status: 502 })
  }
  return NextResponse.json({ ok: true, webhookUrl, result })
}
