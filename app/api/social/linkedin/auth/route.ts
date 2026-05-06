import { createClient } from '@/lib/supabase/server'
import { buildAuthUrl } from '@/lib/linkedin'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const state = crypto.randomBytes(16).toString('hex')
  const cookieStore = await cookies()
  cookieStore.set('linkedin_oauth_state', state, { httpOnly: true, maxAge: 600, path: '/' })

  return NextResponse.redirect(buildAuthUrl(state))
}
