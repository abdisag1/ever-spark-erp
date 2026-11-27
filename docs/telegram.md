# Telegram finance intake

The ERP accepts payment requests and approvals through a Telegram bot. Every
money action still runs through the same shared server logic as the web app
(`lib/finance-actions.ts`), so segregation-of-duties, routing and the audit
trail are identical regardless of channel.

## 1. Create the bot (BotFather)

1. In Telegram, open [@BotFather](https://t.me/BotFather).
2. Send `/newbot`, choose a name (e.g. `Ever Spark Finance`) and a username
   (e.g. `everspark_finance_bot`).
3. BotFather returns a **bot token** — this is `TELEGRAM_BOT_TOKEN`.
4. (Optional) `/setcommands` → paste:
   ```
   start - How to link your account
   link - Link your ERP account: /link <code>
   pay - Raise a new payment request
   status - Show your open requests
   cancel - Cancel the current step
   ```

## 2. Environment variables

Set these for the deployment (and in `.env.local` for local dev):

| Variable | Purpose |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | Bot token from BotFather. |
| `TELEGRAM_WEBHOOK_SECRET` | Any random string. Telegram echoes it in the `X-Telegram-Bot-Api-Secret-Token` header; the webhook route rejects calls that don't match. |
| `NEXT_PUBLIC_SITE_URL` | Public base URL of the app, e.g. `https://erp.eversparktech.com`. Used to build the webhook URL. |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | *(optional)* Bot username (no `@`) shown in the Settings → Telegram panel. |

The finance module also relies on the usual Supabase variables:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`.

Generate a webhook secret with e.g. `openssl rand -hex 32`.

## 3. Register the webhook

Once the app is deployed with the variables above, register the webhook. Either:

- **In-app (admin):** `POST /api/telegram/set-webhook` while signed in as an
  admin. It calls Telegram's `setWebhook` with the correct URL and secret.
- **By hand:**
  ```bash
  curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
    -H 'Content-Type: application/json' \
    -d '{
      "url": "https://YOUR_SITE/api/telegram/webhook",
      "secret_token": "YOUR_WEBHOOK_SECRET",
      "allowed_updates": ["message", "callback_query"]
    }'
  ```

Verify with:
```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"
```

## 4. Link an account

Each user links their own Telegram once:

1. ERP → **Settings → Telegram → Generate link code**.
2. In Telegram, open the bot, `/start`, then `/link <code>` (the code is valid
   for 15 minutes).

The bot ignores every update from an unlinked Telegram account except `/start`
and `/link`. Identity is **only** ever taken from this mapping — never from the
Telegram-supplied name.

## 5. Using it

- **Raise a request:** `/pay` → amount → purpose → pick a project (or skip) →
  send a photo/file of the proforma or receipt (or `/skip`). The request is
  created with `source_channel = 'telegram'` and routed to the correct approver.
- **Approve:** linked approvers receive the request with inline
  **✅ Approve / ❓ Clarify / ❌ Reject** buttons. Reject/Clarify prompt for a
  short reason. The action enforces the same role + segregation-of-duties +
  status rules as the web app and is written to `payment_events`.
- **Track:** `/status` lists your open requests.

## Security notes

- The webhook secret is verified on **every** call.
- Telegram identity is trusted only through the linked `profiles.telegram_user_id`.
- All money actions go through `lib/finance-actions.ts` and are logged to the
  append-only `payment_events` table.
- Receipts are uploaded to the **private** `payment-documents` bucket and served
  via short-lived signed URLs.
