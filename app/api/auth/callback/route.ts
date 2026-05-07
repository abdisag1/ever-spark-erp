import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Supabase auth callback — handles the redirect after email link verification.
 * The link in the reset-password email points here so the code exchange
 * happens server-side (no browser PKCE verifier needed).
 * After exchange the session is stored in cookies and the user is redirected
 * to the intended page (e.g. /reset-password).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code  = searchParams.get('code')
  const next  = searchParams.get('next') ?? '/reset-password'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ever-spark-erp.vercel.app'

  if (code) {
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll()                { return cookieStore.getAll() },
          setAll(cookiesToSet)    {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Session is now in cookies — send the user to the reset-password form
      return NextResponse.redirect(`${appUrl}${next}`)
    }

    console.error('Auth callback exchange error:', error.message)
  }

  // No code or exchange failed — show the expired message
  return NextResponse.redirect(`${appUrl}/reset-password?error=expired`)
}
