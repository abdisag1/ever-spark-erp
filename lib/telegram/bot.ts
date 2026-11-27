// Telegram bot: payment-request intake + in-chat approvals.
// Writes to the same Supabase tables as the web app, through lib/finance-core.
import { Bot, InlineKeyboard, type Context } from 'grammy'
import { admin, PAYMENT_BUCKET } from '@/lib/finance'
import { createPaymentRequest, notifyApprovers, actOnRequest, type PaymentRow } from '@/lib/finance-core'

interface LinkedProfile { id: string; name: string; role: string }
interface Flow { chat_id: number; user_id: string | null; step: string | null; draft: Record<string, unknown> }

const etb = (n: number) => `ETB ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

async function profileByTelegram(tgId: number): Promise<LinkedProfile | null> {
  const { data } = await admin().from('profiles').select('id, name, role').eq('telegram_user_id', tgId).maybeSingle()
  return (data as LinkedProfile | null) ?? null
}

async function loadFlow(chatId: number): Promise<Flow | null> {
  const { data } = await admin().from('telegram_flow').select('*').eq('chat_id', chatId).maybeSingle()
  return (data as Flow | null) ?? null
}

async function saveFlow(chatId: number, userId: string | null, step: string, draft: Record<string, unknown>): Promise<void> {
  await admin().from('telegram_flow').upsert(
    { chat_id: chatId, user_id: userId, step, draft, updated_at: new Date().toISOString() },
    { onConflict: 'chat_id' }
  )
}

async function clearFlow(chatId: number): Promise<void> {
  await admin().from('telegram_flow').delete().eq('chat_id', chatId)
}

async function notifyRequesterPaid(pr: PaymentRow, title: string, body: string): Promise<number | null> {
  const a = admin()
  await a.from('notifications').insert({ user_id: pr.requester_id, title, message: body, type: 'task_assigned', task_id: null })
  const { data } = await a.from('profiles').select('telegram_user_id').eq('id', pr.requester_id).maybeSingle()
  const tg = (data as { telegram_user_id: number | null } | null)?.telegram_user_id ?? null
  return tg
}

function approverKeyboard(id: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Approve', `act:approve:${id}`)
    .text('❓ Clarify', `act:clarify:${id}`)
    .text('❌ Reject', `act:reject:${id}`)
}

async function startPay(ctx: Context, me: LinkedProfile): Promise<void> {
  const chatId = ctx.chat?.id
  if (chatId === undefined) return
  await saveFlow(chatId, me.id, 'amount', {})
  await ctx.reply(`Hi ${me.name.split(' ')[0]} — new payment request.\nHow much? Enter the amount in ETB (e.g. 4500).`)
}

async function createFromDraft(ctx: Context, me: LinkedProfile, flow: Flow, projectId: string | null): Promise<void> {
  const amount = Number(flow.draft.amount)
  const purpose = String(flow.draft.purpose ?? '')
  const chatId = ctx.chat?.id
  if (chatId === undefined) return

  let pr: PaymentRow
  try {
    pr = await createPaymentRequest({ requester_id: me.id, amount, purpose, project_id: projectId, source_channel: 'telegram' })
  } catch {
    await clearFlow(chatId)
    await ctx.reply('Sorry — could not create the request. Please try again with /pay.')
    return
  }

  // Notify approvers in-app + over Telegram where linked.
  const approvers = await notifyApprovers(pr)
  for (const ap of approvers) {
    if (ap.telegram_user_id) {
      await ctx.api.sendMessage(
        ap.telegram_user_id,
        `🔔 Approval needed\n${pr.reference}\n${etb(pr.amount)} — ${pr.purpose}\nFrom: ${me.name}${pr.requires_check ? '\n⚠️ Over 30,000 — pay by check' : ''}`,
        { reply_markup: approverKeyboard(pr.id) }
      )
    }
  }

  await saveFlow(chatId, me.id, 'receipt', { request_id: pr.id })
  await ctx.reply(`✅ Created ${pr.reference} for ${etb(pr.amount)}.\nSend a photo or file of the proforma/receipt now, or tap /done.`)
}

async function attachReceipt(ctx: Context, flow: Flow, fileId: string, fileName: string, contentType: string): Promise<void> {
  const requestId = String(flow.draft.request_id ?? '')
  if (!requestId || !flow.user_id) return
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return

  const file = await ctx.api.getFile(fileId)
  if (!file.file_path) { await ctx.reply('Could not read that file — please try again.'); return }
  const resp = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`)
  const buffer = Buffer.from(await resp.arrayBuffer())

  const a = admin()
  const path = `${flow.user_id}/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`
  const { error } = await a.storage.from(PAYMENT_BUCKET).upload(path, buffer, { contentType })
  if (error) { await ctx.reply('Upload failed — please try again.'); return }

  await a.from('payment_documents').insert({
    payment_request_id: requestId, kind: 'receipt', url: path, file_name: fileName, uploaded_by: flow.user_id,
  })
  await a.from('payment_events').insert({
    payment_request_id: requestId, actor_id: flow.user_id, action: 'document_added', note: `Added receipt: ${fileName}`,
  })
  await ctx.reply('📎 Receipt attached. Send another, or tap /done.')
}

function registerHandlers(bot: Bot): void {
  bot.command('start', async (ctx) => {
    await ctx.reply(
      'Ever Spark Finance bot.\n\nFirst link your account: open the ERP → Settings → Connect Telegram, then send:\n/link <your code>\n\nThen use /pay to request a payment and /status to track your requests.'
    )
  })

  bot.command('link', async (ctx) => {
    const code = (ctx.match ?? '').trim()
    const tgId = ctx.from?.id
    if (!code) { await ctx.reply('Usage: /link <code> — get the code from the ERP Settings page.'); return }
    if (tgId === undefined) return
    const a = admin()
    const { data: row } = await a.from('telegram_link_codes').select('*').eq('code', code).maybeSingle()
    const link = row as { user_id: string; used: boolean; expires_at: string } | null
    if (!link || link.used || new Date(link.expires_at) < new Date()) {
      await ctx.reply('That code is invalid or expired. Generate a new one in the ERP Settings page.')
      return
    }
    const { error } = await a.from('profiles').update({ telegram_user_id: tgId }).eq('id', link.user_id)
    if (error) { await ctx.reply('Could not link — this Telegram account may already be linked to another profile.'); return }
    await a.from('telegram_link_codes').update({ used: true }).eq('code', code)
    await ctx.reply('✅ Linked! You can now use /pay and /status.')
  })

  bot.command('pay', async (ctx) => {
    const tgId = ctx.from?.id
    if (tgId === undefined) return
    const me = await profileByTelegram(tgId)
    if (!me) { await ctx.reply('Please link your account first: ERP → Settings → Connect Telegram, then /link <code>.'); return }
    await startPay(ctx, me)
  })

  bot.command('done', async (ctx) => {
    const chatId = ctx.chat?.id
    if (chatId !== undefined) await clearFlow(chatId)
    await ctx.reply('Done. Track your requests any time with /status.')
  })

  bot.command('cancel', async (ctx) => {
    const chatId = ctx.chat?.id
    if (chatId !== undefined) await clearFlow(chatId)
    await ctx.reply('Cancelled.')
  })

  bot.command('status', async (ctx) => {
    const tgId = ctx.from?.id
    if (tgId === undefined) return
    const me = await profileByTelegram(tgId)
    if (!me) { await ctx.reply('Please link your account first with /link <code>.'); return }
    const { data } = await admin()
      .from('payment_requests')
      .select('reference, amount, purpose, status')
      .eq('requester_id', me.id)
      .in('status', ['submitted', 'clarification', 'approved', 'paid'])
      .order('created_at', { ascending: false })
      .limit(10)
    const rows = (data as { reference: string; amount: number; purpose: string; status: string }[] | null) ?? []
    if (!rows.length) { await ctx.reply('No open requests. Use /pay to create one.'); return }
    const lines = rows.map((r) => `• ${r.reference} — ${etb(r.amount)} — ${r.status}\n  ${r.purpose}`)
    await ctx.reply(`Your open requests:\n${lines.join('\n')}`)
  })

  // Project selection + approver actions.
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data
    const chatId = ctx.chat?.id
    const tgId = ctx.from?.id

    if (data.startsWith('proj:')) {
      await ctx.answerCallbackQuery()
      if (chatId === undefined || tgId === undefined) return
      const me = await profileByTelegram(tgId)
      const flow = await loadFlow(chatId)
      if (!me || !flow || flow.step !== 'project') return
      const picked = data.slice('proj:'.length)
      const projectId = picked === 'skip' ? null : picked
      await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {})
      await createFromDraft(ctx, me, flow, projectId)
      return
    }

    if (data.startsWith('act:')) {
      if (tgId === undefined) { await ctx.answerCallbackQuery(); return }
      const me = await profileByTelegram(tgId)
      if (!me) { await ctx.answerCallbackQuery({ text: 'Link your account first.', show_alert: true }); return }
      const [, action, id] = data.split(':')

      if (action === 'approve') {
        const res = await actOnRequest({ id, actorId: me.id, actorRole: me.role, action: 'approve' })
        await ctx.answerCallbackQuery({ text: res.ok ? 'Approved' : res.error, show_alert: !res.ok })
        if (res.ok) {
          await ctx.editMessageText(`✅ ${res.pr.reference} approved by ${me.name} — ${etb(res.pr.amount)}`)
          const tg = await notifyRequesterPaid(res.pr, 'Payment approved', `${res.pr.reference} was approved.`)
          if (tg) await ctx.api.sendMessage(tg, `✅ ${res.pr.reference} approved.`)
        }
        return
      }

      if (action === 'reject' || action === 'clarify') {
        await ctx.answerCallbackQuery()
        if (chatId === undefined) return
        await saveFlow(chatId, me.id, 'reason', { reason_action: action, reason_id: id })
        await ctx.reply(action === 'reject' ? 'Send the reason for rejection:' : 'What needs clarifying? Send a note:')
      }
    }
  })

  // Receipt uploads during the /pay flow.
  bot.on('message:photo', async (ctx) => {
    const chatId = ctx.chat?.id
    if (chatId === undefined) return
    const flow = await loadFlow(chatId)
    if (!flow || flow.step !== 'receipt') return
    const photos = ctx.message.photo
    const best = photos[photos.length - 1]
    await attachReceipt(ctx, flow, best.file_id, `telegram-${Date.now()}.jpg`, 'image/jpeg')
  })

  bot.on('message:document', async (ctx) => {
    const chatId = ctx.chat?.id
    if (chatId === undefined) return
    const flow = await loadFlow(chatId)
    if (!flow || flow.step !== 'receipt') return
    const doc = ctx.message.document
    await attachReceipt(ctx, flow, doc.file_id, doc.file_name ?? `telegram-${Date.now()}`, doc.mime_type ?? 'application/octet-stream')
  })

  // Free-text drives the multi-step flow.
  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text.trim()
    if (text.startsWith('/')) return // unknown command
    const chatId = ctx.chat?.id
    const tgId = ctx.from?.id
    if (chatId === undefined || tgId === undefined) return

    const me = await profileByTelegram(tgId)
    if (!me) { await ctx.reply('Please link your account first: /link <code> (get a code in ERP → Settings).'); return }

    const flow = await loadFlow(chatId)
    if (!flow || !flow.step) { await ctx.reply('Send /pay to request a payment, or /status to see your requests.'); return }

    switch (flow.step) {
      case 'amount': {
        const amount = Number(text.replace(/,/g, ''))
        if (!Number.isFinite(amount) || amount <= 0) { await ctx.reply('Enter a valid amount, e.g. 4500.'); return }
        await saveFlow(chatId, me.id, 'purpose', { ...flow.draft, amount })
        await ctx.reply('What is this payment for?')
        break
      }
      case 'purpose': {
        await saveFlow(chatId, me.id, 'project', { ...flow.draft, purpose: text })
        const { data } = await admin().from('projects').select('id, name').eq('status', 'active').order('name').limit(20)
        const projects = (data as { id: string; name: string }[] | null) ?? []
        const kb = new InlineKeyboard()
        for (const p of projects) kb.text(p.name, `proj:${p.id}`).row()
        kb.text('— No project —', 'proj:skip')
        await ctx.reply('Which project is this for?', { reply_markup: kb })
        break
      }
      case 'receipt': {
        await ctx.reply('Send a photo or file of the receipt, or tap /done.')
        break
      }
      case 'reason': {
        const action = String(flow.draft.reason_action ?? '')
        const id = String(flow.draft.reason_id ?? '')
        await clearFlow(chatId)
        if (action !== 'reject' && action !== 'clarify') return
        const res = await actOnRequest({ id, actorId: me.id, actorRole: me.role, action, note: text })
        if (!res.ok) { await ctx.reply(`Could not ${action}: ${res.error}`); return }
        await ctx.reply(action === 'reject' ? `❌ ${res.pr.reference} rejected.` : `❓ ${res.pr.reference} sent back for clarification.`)
        const tg = await notifyRequesterPaid(
          res.pr,
          action === 'reject' ? 'Payment rejected' : 'Clarification requested',
          action === 'reject' ? `${res.pr.reference} was rejected. Reason: ${text}` : `${res.pr.reference}: ${text}`
        )
        if (tg) await ctx.api.sendMessage(tg, action === 'reject' ? `❌ ${res.pr.reference} rejected: ${text}` : `❓ ${res.pr.reference}: ${text}`)
        break
      }
    }
  })
}

let botInstance: Bot | null = null

export function getBot(): Bot {
  if (botInstance) return botInstance
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set')
  const bot = new Bot(token)
  registerHandlers(bot)
  botInstance = bot
  return bot
}
