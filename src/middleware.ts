import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.delete(name)
        },
      },
    }
  )

  // 300 IQ: Use getUser() for server-side security validation. 
  // It fetches the user from the database, making it impossible to spoof via cookies.
  const { data: { user } } = await supabase.auth.getUser()

  const url = request.nextUrl.clone()
  const isLoginPage = url.pathname === '/admin/login'
  const isAdminRoute = url.pathname.startsWith('/admin')

  // 1. SECURITY BOUNCER: If trying to access ANY /admin page but NOT logged in -> Redirect to Login
  // This covers /admin, /admin/applicants, /admin/dashboard, etc.
  if (isAdminRoute && !isLoginPage && !user) {
    url.pathname = '/admin/login'
    return NextResponse.redirect(url)
  }

  // 2. AUTO-FORWARD: If already logged in and tries to access the Login page -> Send to Dashboard
  if (isLoginPage && user) {
    url.pathname = '/admin/applicants'
    return NextResponse.redirect(url)
  }

  // 3. BASE REDIRECT: If someone types exactly "/admin" and is logged in -> Send to Dashboard
  if (url.pathname === '/admin' && user) {
    url.pathname = '/admin/applicants'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  // CRITICAL: Added '/admin' to the matcher to catch the root admin URL
  matcher: ['/admin', '/admin/:path*'],
}