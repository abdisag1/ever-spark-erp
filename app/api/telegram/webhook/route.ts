import { getBot } from '@/lib/telegram/bot'
import { webhookCallback } from 'grammy'

export const dynamic = 'force-dynamic'

let handler: ((req: Request) => Promise<Response>) | null = null

// Telegram posts updates here. The secret token header is verified by grammy.
export async function POST(req: Request): Promise<Response> {
  try {
    if (!handler) {
      const bot = getBot()
      await bot.init()
      handler = webhookCallback(bot, 'std/http', { secretToken: process.env.TELEGRAM_WEBHOOK_SECRET })
    }
    return await handler(req)
  } catch {
    // Never make Telegram retry-storm on an internal error.
    return new Response('ok', { status: 200 })
  }
}
