import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  /** Evitar redirect a login sobre assets en `public/` (p. ej. logo del loader). */
  const isPublicAsset =
    pathname.startsWith('/brand') ||
    pathname === '/favicon.ico' ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/sw.js'
  if (isPublicAsset) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  let user = null as Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user']
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch (err) {
    // Red caída, URL/claves mal puestas, proxy, etc. → fetch falla en Edge (no siempre hay `cause`).
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[middleware] Supabase auth no alcanzable (getUser/refresh). Revisa NEXT_PUBLIC_SUPABASE_URL, red y .env.local.',
        err
      )
    }
  }

  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/auth') &&
    request.nextUrl.pathname !== '/'
  ) {
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
