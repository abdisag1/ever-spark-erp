import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

interface EmailRecipient {
  email: string
  name: string | null
  lead_id: string | null
  funnel_stage: string | null
}

function createTransporter() {
  const gmailUser = process.env.GMAIL_USER
  const gmailPass = process.env.GMAIL_APP_PASSWORD

  if (gmailUser && gmailPass) {
    // Port 587 + STARTTLS — works through most corporate firewalls
    return nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,       // STARTTLS upgrades the connection
      auth: { user: gmailUser, pass: gmailPass },
      tls: {
        rejectUnauthorized: false, // handle self-signed cert in chain
      },
    })
  }

  // Fallback: Resend via SMTP
  if (process.env.RESEND_API_KEY) {
    return nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 587,
      secure: false,
      auth: { user: 'resend', pass: process.env.RESEND_API_KEY },
    })
  }

  return null
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { recipients, subject, body, fromName, attachments } = await request.json() as {
    recipients: EmailRecipient[]
    subject: string
    body: string
    fromName?: string
    attachments?: { name: string; url: string; type: string }[]
  }

  if (!recipients?.length || !subject || !body) {
    return NextResponse.json({ error: 'recipients, subject and body are required' }, { status: 400 })
  }

  const transporter = createTransporter()
  const fromAddress = process.env.GMAIL_USER ?? process.env.EMAIL_FROM ?? 'noreply@eversparktech.com'
  const senderName = (fromName?.trim()) || process.env.EMAIL_FROM_NAME || 'Ever Spark CRM'

  // Pre-fetch attachments once (same files for every recipient)
  const mailAttachments: { filename: string; content: Buffer; contentType: string }[] = []
  for (const att of attachments ?? []) {
    try {
      const res = await fetch(att.url)
      const buf = Buffer.from(await res.arrayBuffer())
      mailAttachments.push({ filename: att.name, content: buf, contentType: att.type })
    } catch {
      console.error(`Failed to fetch attachment: ${att.url}`)
    }
  }

  const results: { email: string; status: 'sent' | 'failed' }[] = []

  for (const recipient of recipients) {
    const personalised = body
      .replace(/\[Name\]/gi, recipient.name ?? 'there')
      .replace(/\[Email\]/gi, recipient.email)

    let status: 'sent' | 'failed' = 'sent'

    if (transporter) {
      try {
        await transporter.sendMail({
          from: `${senderName} <${fromAddress}>`,
          to: recipient.email,
          subject,
          text: personalised,
          html: personalised.replace(/\n/g, '<br>'),
          attachments: mailAttachments,
        })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`Email send failed to ${recipient.email}: ${msg}`)
        status = 'failed'
        if (results.length === 0) {
          return NextResponse.json({ error: `Gmail error: ${msg}` }, { status: 500 })
        }
      }
    }
    // No transporter configured → mock mode, logs as 'sent'

    results.push({ email: recipient.email, status })
  }

  // Log all to DB
  const attachmentMeta = (attachments ?? []).map(({ name, url, type }) => ({ name, url, type }))
  const logs = recipients.map((r, i) => ({
    recipient_email: r.email,
    recipient_name: r.name,
    subject,
    body,
    status: results[i].status,
    lead_id: r.lead_id,
    funnel_stage: r.funnel_stage,
    sent_by: user.id,
    attachments: attachmentMeta,
  }))

  const { data, error } = await supabase.from('email_logs').insert(logs).select()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const sentCount   = results.filter((r) => r.status === 'sent').length
  const failedCount = results.filter((r) => r.status === 'failed').length

  return NextResponse.json(
    { success: true, sent: sentCount, failed: failedCount, count: data.length },
    { status: 201 }
  )
}
