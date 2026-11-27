import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // Unauthenticated → send to login (except auth pages)
  if (!user && pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (!user && pathname === '/pending') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Authenticated → check profile status for dashboard access
  if (user && pathname.startsWith('/dashboard')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('status, role')
      .eq('id', user.id)
      .single()

    // Pending or disabled users cannot access the dashboard
    if (profile?.status === 'pending') {
      return NextResponse.redirect(new URL('/pending', request.url))
    }
    if (profile?.status === 'disabled') {
      await supabase.auth.signOut()
      return NextResponse.redirect(new URL('/login?reason=disabled', request.url))
    }

    // Communication route — admin and sales_marketing only
    if (pathname.startsWith('/dashboard/sms') &&
        profile?.role !== 'admin' &&
        profile?.role !== 'sales_marketing') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Finance route — admin, finance and operations only
    if (pathname.startsWith('/dashboard/finance') &&
        profile?.role !== 'admin' &&
        profile?.role !== 'finance' &&
        profile?.role !== 'operations') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // Active authenticated users don't need the pending page
  if (user && pathname === '/pending') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('status')
      .eq('id', user.id)
      .single()
    if (profile?.status === 'active') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // Redirect authenticated users away from auth pages
  if (user && (pathname === '/login' || pathname === '/')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
