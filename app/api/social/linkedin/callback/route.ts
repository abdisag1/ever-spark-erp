import { createClient } from '@/lib/supabase/server'
import { exchangeCodeForToken, getLinkedInProfile } from '@/lib/linkedin'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const { searchParams } = new URL(request.url)

  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const storedState = cookieStore.get('linkedin_oauth_state')?.value

  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(new URL('/dashboard/social?error=oauth_failed', request.url))
  }

  cookieStore.delete('linkedin_oauth_state')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  try {
    const { access_token } = await exchangeCodeForToken(code)
    const profile = await getLinkedInProfile(access_token)

    await supabase
      .from('profiles')
      .update({ linkedin_access_token: access_token, linkedin_profile_id: profile.id })
      .eq('id', user.id)

    return NextResponse.redirect(new URL('/dashboard/social?connected=true', request.url))
  } catch {
    return NextResponse.redirect(new URL('/dashboard/social?error=token_failed', request.url))
  }
}
