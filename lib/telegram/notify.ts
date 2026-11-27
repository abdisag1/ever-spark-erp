/**
 * Outbound Telegram notifications via the raw Bot API.
 *
 * Kept free of any dependency on the grammY bot instance (and on
 * lib/finance-actions) so it is safe to import from server routes and from the
 * shared finance actions without creating an import cycle. Every call is
 * best-effort: if the bot token is missing or Telegram errors, it resolves
 * quietly so finance flows are never blocked.
 */
import type { PaymentRequest } from '@/types/finance'

const TOKEN = process.env.TELEGRAM_BOT_TOKEN

function api(method: string) {
  return `https://api.telegram.org/bot${TOKEN}/${method}`
}

function money(amount: number, currency = 'ETB'): string {
  const n = Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${n} ${currency}`
}

/** Minimal MarkdownV2 escaping for user-supplied text. */
function esc(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, (m) => `\\${m}`)
}

async function call(method: string, body: Record<string, unknown>): Promise<void> {
  if (!TOKEN) return
  try {
    await fetch(api(method), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    /* best effort */
  }
}

/** Plain (unformatted) status message — avoids MarkdownV2 escaping pitfalls. */
export async function sendStatusUpdateTelegram(chatId: number, text: string): Promise<void> {
  await call('sendMessage', { chat_id: chatId, text, disable_web_page_preview: true })
}

function approvalText(pr: PaymentRequest): string {
  const lines = [
    `💰 *Payment request for approval*`,
    ``,
    `*Ref:* ${esc(pr.reference ?? '—')}`,
    `*Amount:* ${esc(money(pr.amount, pr.currency))}`,
    `*Purpose:* ${esc(pr.purpose)}`,
  ]
  if (pr.requester?.name) lines.push(`*Requested by:* ${esc(pr.requester.name)}`)
  if (pr.project?.name) lines.push(`*Project:* ${esc(pr.project.name)}`)
  if (pr.requires_check) lines.push(`⚠️ Requires a check \\(over 30,000 ETB\\)`)
  return lines.join('\n')
}

function approvalKeyboard(prId: string) {
  return {
    inline_keyboard: [
      [
        { text: '✅ Approve', callback_data: `fin:approve:${prId}` },
        { text: '❓ Clarify', callback_data: `fin:clarify:${prId}` },
        { text: '❌ Reject', callback_data: `fin:reject:${prId}` },
      ],
    ],
  }
}

/** Send an approval message with inline buttons to each linked approver. */
export async function notifyApproversTelegram(
  pr: PaymentRequest,
  chatIds: number[]
): Promise<void> {
  const text = approvalText(pr)
  const reply_markup = approvalKeyboard(pr.id)
  await Promise.all(
    chatIds.map((chatId) =>
      call('sendMessage', {
        chat_id: chatId,
        text,
        parse_mode: 'MarkdownV2',
        reply_markup,
        disable_web_page_preview: true,
      })
    )
  )
}
