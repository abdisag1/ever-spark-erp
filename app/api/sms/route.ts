import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { recipients, message } = await request.json()
  if (!recipients?.length || !message) {
    return NextResponse.json({ error: 'recipients and message are required' }, { status: 400 })
  }

  const sid   = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from  = process.env.TWILIO_FROM_NUMBER

  const results: Record<string, 'sent' | 'failed'> = {}

  for (const recipient of recipients as string[]) {
    if (sid && token && from) {
      // Twilio live send
      try {
        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({ Body: message, From: from, To: recipient }),
          }
        )
        results[recipient] = res.ok ? 'sent' : 'failed'
      } catch {
        results[recipient] = 'failed'
      }
    } else {
      // No Twilio configured — log as sent (mock mode)
      results[recipient] = 'sent'
    }
  }

  const logs = (recipients as string[]).map((recipient) => ({
    recipient,
    message_content: message,
    status: results[recipient],
    sent_by: user.id,
  }))

  const { data, error } = await supabase.from('sms_logs').insert(logs).select()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const sentCount = Object.values(results).filter((s) => s === 'sent').length
  return NextResponse.json({ success: true, count: data.length, sent: sentCount }, { status: 201 })
}
