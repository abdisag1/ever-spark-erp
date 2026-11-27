import { webhookCallback } from 'grammy'
import { getBot } from '@/lib/telegram/bot'

// grammY + Supabase service role need the Node.js runtime; never cache.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return new Response('Telegram bot is not configured', { status: 500 })
  }

  // Verify the secret token Telegram echoes back on every call.
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET
  if (expected) {
    const got = request.headers.get('x-telegram-bot-api-secret-token')
    if (got !== expected) {
      return new Response('Forbidden', { status: 401 })
    }
  }

  try {
    const bot = await getBot()
    const handle = webhookCallback(bot, 'std/http')
    return await handle(request)
  } catch (err) {
    console.error('Telegram webhook error:', err)
    // Always 200 so Telegram does not hammer retries on a transient failure.
    return new Response('ok', { status: 200 })
  }
}
