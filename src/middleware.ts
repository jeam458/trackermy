import { updateSession as supabaseMiddleware } from '@/core/infrastructure/supabase/middleware'
import { type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  return await supabaseMiddleware(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|brand/|sitemap.xml|robots.txt).*)',
  ],
}
