/**
 * grammY bot for Telegram-based finance intake.
 *
 * All money actions go through the shared server functions in
 * lib/finance-actions (same rules as the web PATCH), and the bot never trusts
 * Telegram-supplied identity beyond the linked profile mapping.
 *
 * Conversation state is kept in a Supabase-backed session store
 * (telegram_sessions), so the flow survives the stateless webhook runtime.
 */
import {
  Bot,
  InlineKeyboard,
  session,
  type Context,
  type SessionFlavor,
  type StorageAdapter,
} from 'grammy'
import { createClient as createAdmin, type SupabaseClient } from '@supabase/supabase-js'
import { createPaymentRequest, performAction, attachDocument, formatETB } from '@/lib/finance-actions'
import { PAYMENT_BUCKET, ensurePaymentBucket } from '@/lib/finance-storage'
import {
  PAYMENT_STATUS_LABELS,
  type PaymentRequest,
  type PaymentAction,
} from '@/types/finance'

// ── Session + context types ─────────────────────────────────────────────────
interface PayFlow {
  step: 'amount' | 'purpose' | 'project' | 'document'
  amount?: number
  purpose?: string
  projectId?: string | null
}
interface AwaitingReason {
  action: 'reject' | 'clarify'
  requestId: string
  messageId: number
  chatId: number
}
interface SessionData {
  pay?: PayFlow
  awaitingReason?: AwaitingReason
}

interface ProfileRow {
  id: string
  name: string
  role: string
}

type BotContext = Context & SessionFlavor<SessionData> & { profile?: ProfileRow }

// ── Admin client + session storage ──────────────────────────────────────────
function admin(): SupabaseClient {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function supabaseSessionStorage(): StorageAdapter<SessionData> {
  const db = admin()
  return {
    async read(key) {
      const { data } = await db.from('telegram_sessions').select('value').eq('key', key).maybeSingle()
      return (data?.value as SessionData | undefined) ?? undefined
    },
    async write(key, value) {
      await db.from('telegram_sessions').upsert(
        { key, value, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )
    },
    async delete(key) {
      await db.from('telegram_sessions').delete().eq('key', key)
    },
  }
}

async function resolveProfile(telegramUserId: number): Promise<ProfileRow | null> {
  const { data } = await admin()
    .from('profiles')
    .select('id, name, role, status')
    .eq('telegram_user_id', telegramUserId)
    .maybeSingle()
  if (!data || (data as { status: string }).status !== 'active') return null
  return { id: data.id, name: data.name, role: data.role }
}

// ── File download → private bucket ──────────────────────────────────────────
async function uploadTelegramFile(
  bot: Bot<BotContext>,
  fileId: string,
  fileName: string,
  requestId: string,
  uploadedBy: string
): Promise<string> {
  const file = await bot.api.getFile(fileId)
  const url = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`
  const res = await fetch(url)
  const buffer = Buffer.from(await res.arrayBuffer())

  const db = admin()
  await ensurePaymentBucket(db)
  const safeName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_')
  const path = `${requestId}/${uploadedBy}/${Date.now()}-${safeName}`
  await db.storage.from(PAYMENT_BUCKET).upload(path, buffer, {
    contentType: res.headers.get('content-type') ?? 'application/octet-stream',
  })
  return path
}

// ── Build + configure the bot (memoised, initialised once) ───────────────────
let botPromise: Promise<Bot<BotContext>> | null = null

export function getBot(): Promise<Bot<BotContext>> {
  if (!botPromise) botPromise = buildBot()
  return botPromise
}

async function buildBot(): Promise<Bot<BotContext>> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set')

  const bot = new Bot<BotContext>(token)

  bot.use(session({
    initial: (): SessionData => ({}),
    storage: supabaseSessionStorage(),
    getSessionKey: (ctx) => ctx.from?.id.toString(),
  }))

  // ── /start — open to everyone (explains linking) ──────────────────────────
  bot.command('start', async (ctx) => {
    await ctx.reply(
      'Welcome to the Ever Spark finance bot.\n\n' +
      'To use it, link your ERP account:\n' +
      '1. Open the ERP → Settings → Telegram.\n' +
      '2. Generate a link code.\n' +
      '3. Send it here as:  /link <code>\n\n' +
      'Once linked you can raise payment requests with /pay, check them with /status, ' +
      'and approve requests from inline buttons.'
    )
  })

  // ── /link <code> — open to everyone (performs the mapping) ─────────────────
  bot.command('link', async (ctx) => {
    const tgId = ctx.from?.id
    if (!tgId) return
    const code = (ctx.match ?? '').trim().toUpperCase()
    if (!code) {
      await ctx.reply('Usage: /link <code>. Generate a code in the ERP under Settings → Telegram.')
      return
    }

    const db = admin()
    const { data: row } = await db
      .from('telegram_link_codes')
      .select('*')
      .eq('code', code)
      .eq('used', false)
      .maybeSingle()

    if (!row || new Date(row.expires_at).getTime() < Date.now()) {
      await ctx.reply('That code is invalid or has expired. Generate a fresh one in the ERP.')
      return
    }

    const { error } = await db.from('profiles').update({ telegram_user_id: tgId }).eq('id', row.user_id)
    if (error) {
      await ctx.reply('This Telegram account is already linked to another profile, or linking failed.')
      return
    }
    await db.from('telegram_link_codes').update({ used: true }).eq('id', row.id)
    await ctx.reply('✅ Your Telegram is now linked. Try /pay to raise a payment request.')
  })

  // ── Linkage gate: ignore everyone else who isn't linked ───────────────────
  bot.use(async (ctx, next) => {
    const tgId = ctx.from?.id
    if (!tgId) return
    const profile = await resolveProfile(tgId)
    if (!profile) {
      // Only answer button taps / messages; stay quiet otherwise.
      if (ctx.callbackQuery) await ctx.answerCallbackQuery('Link your ERP account first (/start).')
      else if (ctx.message) await ctx.reply('Your Telegram is not linked yet. Send /start to learn how.')
      return
    }
    ctx.profile = profile
    await next()
  })

  // ── /cancel — abort an in-progress flow ───────────────────────────────────
  bot.command('cancel', async (ctx) => {
    ctx.session.pay = undefined
    ctx.session.awaitingReason = undefined
    await ctx.reply('Cancelled.')
  })

  // ── /pay — start the request flow ─────────────────────────────────────────
  bot.command('pay', async (ctx) => {
    ctx.session.pay = { step: 'amount' }
    await ctx.reply('How much is the payment, in ETB? (e.g. 12500)')
  })

  // ── /status — list the requester's open requests ──────────────────────────
  bot.command('status', async (ctx) => {
    const profile = ctx.profile!
    const { data } = await admin()
      .from('payment_requests')
      .select('reference, amount, currency, status, purpose')
      .eq('requester_id', profile.id)
      .not('status', 'in', '(paid,posted,rejected,cancelled)')
      .order('created_at', { ascending: false })
      .limit(10)

    if (!data?.length) {
      await ctx.reply('You have no open payment requests.')
      return
    }
    const lines = data.map((r) =>
      `• ${r.reference} — ${formatETB(Number(r.amount), r.currency)} — ${PAYMENT_STATUS_LABELS[r.status as keyof typeof PAYMENT_STATUS_LABELS]}\n  ${r.purpose}`
    )
    await ctx.reply(`Your open requests:\n\n${lines.join('\n\n')}`)
  })

  // ── /skip — skip the project step or the document step ────────────────────
  bot.command('skip', async (ctx) => {
    const pay = ctx.session.pay
    if (pay?.step === 'project') {
      pay.projectId = null
      pay.step = 'document'
      await ctx.reply('Send a photo or file of the proforma / receipt, or /skip to submit without one.')
      return
    }
    if (pay?.step === 'document') {
      await submitRequest(bot, ctx)
      return
    }
    await ctx.reply('Nothing to skip.')
  })

  // ── Inline button callbacks ───────────────────────────────────────────────
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data

    // Project chosen during the /pay flow
    if (data.startsWith('payproj:')) {
      const pay = ctx.session.pay
      if (!pay || pay.step !== 'project') { await ctx.answerCallbackQuery(); return }
      const value = data.slice('payproj:'.length)
      pay.projectId = value === 'skip' ? null : value
      pay.step = 'document'
      await ctx.answerCallbackQuery()
      await ctx.reply('Send a photo or file of the proforma / receipt, or /skip to submit without one.')
      return
    }

    // Approval actions: fin:<action>:<requestId>
    if (data.startsWith('fin:')) {
      const [, action, requestId] = data.split(':')
      await handleApprovalCallback(ctx, action as PaymentAction, requestId)
      return
    }

    await ctx.answerCallbackQuery()
  })

  // ── Text messages — drive the amount/purpose steps and reason replies ─────
  bot.on('message:text', async (ctx) => {
    // A pending reject/clarify reason takes priority.
    const ar = ctx.session.awaitingReason
    if (ar) {
      ctx.session.awaitingReason = undefined
      await runApproverAction(ctx, ar.action, ar.requestId, ctx.message.text, ar)
      return
    }

    const pay = ctx.session.pay
    if (!pay) return

    if (pay.step === 'amount') {
      const amount = Number(ctx.message.text.replace(/[, ]/g, ''))
      if (!amount || amount <= 0) { await ctx.reply('Please send a valid amount, e.g. 12500.'); return }
      pay.amount = amount
      pay.step = 'purpose'
      await ctx.reply('What is this payment for?')
      return
    }

    if (pay.step === 'purpose') {
      pay.purpose = ctx.message.text.trim()
      pay.step = 'project'
      const keyboard = await projectKeyboard()
      await ctx.reply('Which project is this for? (or Skip)', { reply_markup: keyboard })
      return
    }
  })

  // ── Photo / document during the document step ─────────────────────────────
  bot.on(['message:photo', 'message:document'], async (ctx) => {
    const pay = ctx.session.pay
    if (!pay || pay.step !== 'document') return
    await submitRequest(bot, ctx)
  })

  bot.catch((err) => {
    console.error('Telegram bot error:', err)
  })

  await bot.init()
  return bot
}

// ── Helpers that need the bot or ctx ────────────────────────────────────────
async function projectKeyboard(): Promise<InlineKeyboard> {
  const { data } = await admin()
    .from('projects')
    .select('id, name')
    .eq('status', 'active')
    .order('name')
    .limit(20)
  const kb = new InlineKeyboard()
  for (const p of data ?? []) kb.text(p.name.slice(0, 40), `payproj:${p.id}`).row()
  kb.text('⏭ Skip (not project related)', 'payproj:skip')
  return kb
}

async function submitRequest(bot: Bot<BotContext>, ctx: BotContext) {
  const profile = ctx.profile!
  const pay = ctx.session.pay
  if (!pay?.amount || !pay.purpose) {
    await ctx.reply('Something went wrong with the request. Start again with /pay.')
    ctx.session.pay = undefined
    return
  }

  try {
    const pr = await createPaymentRequest({
      requesterId: profile.id,
      amount: pay.amount,
      purpose: pay.purpose,
      projectId: pay.projectId ?? null,
      isProjectRelated: !!pay.projectId,
      sourceChannel: 'telegram',
    })

    // Attach a photo / document if one was sent with this message.
    const fileId = ctx.message?.photo?.at(-1)?.file_id ?? ctx.message?.document?.file_id
    if (fileId) {
      const fileName = ctx.message?.document?.file_name ?? `telegram-${Date.now()}.jpg`
      try {
        const path = await uploadTelegramFile(bot, fileId, fileName, pr.id, profile.id)
        await attachDocument({ requestId: pr.id, kind: 'proforma', url: path, fileName, uploadedBy: profile.id })
      } catch {
        await ctx.reply('Request created, but I could not save the attachment.')
      }
    }

    ctx.session.pay = undefined
    await ctx.reply(
      `✅ Request ${pr.reference} submitted for ${formatETB(pr.amount, pr.currency)}.\n` +
      `It has been routed to the ${pr.current_approver_role ?? 'finance'} approver.` +
      (pr.requires_check ? '\n⚠️ Over 30,000 ETB — settlement will require a check (BPV).' : '')
    )
  } catch (e) {
    ctx.session.pay = undefined
    await ctx.reply(`Could not create the request: ${e instanceof Error ? e.message : 'unknown error'}`)
  }
}

async function handleApprovalCallback(ctx: BotContext, action: PaymentAction, requestId: string) {
  if (action === 'reject' || action === 'clarify') {
    // Ask for a short reason, then act on the next text message.
    ctx.session.awaitingReason = {
      action,
      requestId,
      messageId: ctx.callbackQuery!.message?.message_id ?? 0,
      chatId: ctx.chat?.id ?? 0,
    }
    await ctx.answerCallbackQuery()
    await ctx.reply(action === 'reject'
      ? 'Send a short reason for rejecting this request.'
      : 'Send what clarification you need.')
    return
  }

  if (action === 'approve') {
    await runApproverAction(ctx, 'approve', requestId)
    return
  }

  await ctx.answerCallbackQuery()
}

async function runApproverAction(
  ctx: BotContext,
  action: PaymentAction,
  requestId: string,
  reason?: string,
  origin?: AwaitingReason
) {
  const profile = ctx.profile!
  const result = await performAction({
    requestId,
    actorId: profile.id,
    actorRole: profile.role,
    action,
    reason: reason ?? null,
  })

  if (!result.ok) {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery(result.error?.slice(0, 190) ?? 'Action failed')
    else await ctx.reply(result.error ?? 'Action failed')
    return
  }

  const pr = result.request as PaymentRequest
  const summary = outcomeLine(pr, action, profile.name)

  // Edit the original approval message (if we can find it) to show the outcome.
  try {
    if (ctx.callbackQuery?.message) {
      await ctx.editMessageText(summary)
    } else if (origin?.chatId && origin.messageId) {
      await ctx.api.editMessageText(origin.chatId, origin.messageId, summary)
    }
  } catch {
    /* message may be too old to edit */
  }

  if (ctx.callbackQuery) await ctx.answerCallbackQuery('Done')
  else await ctx.reply(summary)
}

function outcomeLine(pr: PaymentRequest, action: PaymentAction, actorName: string): string {
  const base = `${pr.reference} — ${formatETB(pr.amount, pr.currency)}\n${pr.purpose}`
  const verb: Record<PaymentAction, string> = {
    approve: `✅ Approved by ${actorName}`,
    reject: `❌ Rejected by ${actorName}${pr.rejected_reason ? ` — ${pr.rejected_reason}` : ''}`,
    clarify: `❓ Clarification requested by ${actorName}`,
    pay: `💵 Paid by ${actorName}`,
    post: `📘 Posted by ${actorName}`,
    cancel: `🚫 Cancelled`,
  }
  return `${base}\n\n${verb[action]}`
}
