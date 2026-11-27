# Telegram payment intake — setup

The bot lets staff raise payment requests and lets managers approve/reject them from Telegram. It writes to the same Supabase tables as the web Finance module.

## 1. Run the migrations
In the Supabase SQL editor, run (in order):
- `supabase/migrations/0001_finance_phase1.sql`
- `supabase/migrations/0002_telegram.sql`

## 2. Create the bot
1. In Telegram, message **@BotFather** → `/newbot` → follow prompts.
2. Copy the **bot token** it gives you.

## 3. Set environment variables
Add to your hosting env (and `.env.local` for dev):
```
TELEGRAM_BOT_TOKEN=123456:ABC-...            # from BotFather
TELEGRAM_WEBHOOK_SECRET=<any long random string>
NEXT_PUBLIC_SITE_URL=https://your-deployed-app.com
```
`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` are already used by the app.

## 4. Register the webhook
Deploy the app, then — signed in as an **admin** — POST to `/api/telegram/set-webhook` (e.g. from the browser console):
```js
await fetch('/api/telegram/set-webhook', { method: 'POST' }).then(r => r.json())
```
It points Telegram at `NEXT_PUBLIC_SITE_URL/api/telegram/webhook` with your secret token.

> The webhook must be a public HTTPS URL — it won't work against `localhost`. For local testing, expose your dev server with a tunnel (e.g. ngrok) and set `NEXT_PUBLIC_SITE_URL` to the tunnel URL before calling set-webhook.

## 5. Link accounts
Each user: **ERP → Settings → Connect Telegram → Generate link code**, then send `/link <code>` to the bot. A Telegram account can only be linked to one profile.

## Commands
- `/pay` — guided flow: amount → purpose → project → attach proforma/receipt photo.
- `/status` — your open requests.
- `/done`, `/cancel` — end the current flow.
- Approvers receive each new request with **Approve / Clarify / Reject** buttons; reject and clarify prompt for a reason.

## Security notes
- Only linked Telegram accounts can do anything; unlinked users are told to link first.
- Every webhook call is verified against `TELEGRAM_WEBHOOK_SECRET`.
- All money actions go through `lib/finance-core.ts`, enforcing the same approval tiers and segregation of duties as the web app, and are written to the `payment_events` audit trail.
