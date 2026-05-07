import { createClient as createAdmin } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

function createTransporter() {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  if (!user || !pass) return null
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  })
}

export async function POST(request: NextRequest) {
  const { email } = await request.json()
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

  // Always use the server-side env var so the link points to production,
  // never to whatever origin the client happens to be on (e.g. localhost).
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||           // set on Vercel
    request.headers.get('origin') ||            // fallback for local dev
    'https://ever-spark-erp.vercel.app'         // absolute fallback

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Generate the password reset link using the Admin API
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: {
      redirectTo: `${appUrl}/reset-password`,
    },
  })

  if (error) {
    // Don't reveal whether the email exists — always return success to the client
    console.error('generateLink error:', error.message)
    return NextResponse.json({ success: true })
  }

  const resetLink = data.properties.action_link

  // Send via Gmail
  const transporter = createTransporter()
  if (transporter && resetLink) {
    try {
      const senderName = process.env.EMAIL_FROM_NAME ?? 'Ever Spark Tech ERP'
      const fromAddress = process.env.GMAIL_USER!
      await transporter.sendMail({
        from: `${senderName} <${fromAddress}>`,
        to: email,
        subject: 'Reset your Ever Spark Tech ERP password',
        text: `You requested a password reset.\n\nClick the link below to set a new password:\n${resetLink}\n\nThis link expires in 1 hour. If you didn't request this, you can safely ignore this email.`,
        html: `
<!DOCTYPE html>
<html>
<body style="font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;padding:40px 0;margin:0;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:#1b4332;padding:28px 32px;text-align:center;">
      <p style="color:#86c5a3;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin:0 0 4px;">Ever Spark Tech</p>
      <p style="color:#fff;font-size:18px;font-weight:700;margin:0;">ERP System</p>
    </div>
    <div style="padding:32px;">
      <h2 style="color:#1a2010;font-size:20px;margin:0 0 12px;">Reset your password</h2>
      <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 24px;">
        We received a request to reset your password. Click the button below to choose a new one.
      </p>
      <div style="text-align:center;margin-bottom:24px;">
        <a href="${resetLink}" style="display:inline-block;background:#1db89d;color:#fff;font-weight:600;font-size:14px;padding:12px 32px;border-radius:8px;text-decoration:none;">
          Reset Password
        </a>
      </div>
      <p style="color:#94a3b8;font-size:12px;margin:0 0 8px;">This link expires in <strong>1 hour</strong>.</p>
      <p style="color:#94a3b8;font-size:12px;margin:0;">If you didn't request a password reset, you can safely ignore this email.</p>
    </div>
    <div style="background:#f8fafc;padding:16px 32px;text-align:center;border-top:1px solid #e2e8f0;">
      <p style="color:#cbd5e1;font-size:11px;margin:0;">Ever Spark Technologies · HR &amp; Operations</p>
    </div>
  </div>
</body>
</html>`,
      })
    } catch (mailErr) {
      console.error('Gmail send error:', mailErr)
      // Still return success — the link was generated even if email failed
    }
  }

  return NextResponse.json({ success: true })
}
