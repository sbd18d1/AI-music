import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, sha256hex } from '@/lib/admin-auth';

// Guards the dashboard PAGE only. /api/admin/* does its own check so it can answer
// with a 401 JSON body instead of a redirect that callers would try to JSON.parse.
export const config = { matcher: ['/admin/:path*'] };

export async function middleware(request: NextRequest) {
  const secret = process.env.ADMIN_SECRET;

  // Fail closed: without a configured secret the dashboard does not open at all.
  if (!secret) {
    return new NextResponse('Admin dashboard is not configured.', { status: 503 });
  }

  const { pathname } = request.nextUrl;

  // The login page must stay reachable while logged out, or this becomes an
  // infinite redirect loop.
  if (pathname === '/admin/login') {
    // Already authenticated → skip the form.
    const cookie = request.cookies.get(ADMIN_COOKIE)?.value;
    if (cookie) {
      const expected = await sha256hex(secret);
      if (cookie === expected) {
        return NextResponse.redirect(new URL('/admin', request.url));
      }
    }
    return NextResponse.next();
  }

  const cookie = request.cookies.get(ADMIN_COOKIE)?.value;
  if (!cookie) {
    return redirectToLogin(request);
  }
  const expected = await sha256hex(secret);
  if (cookie !== expected) {
    return redirectToLogin(request);
  }

  return NextResponse.next();
}

function redirectToLogin(request: NextRequest) {
  const url = new URL('/admin/login', request.url);
  url.searchParams.set('next', request.nextUrl.pathname);
  return NextResponse.redirect(url);
}
