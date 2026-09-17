import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_COOKIE, sha256hex, constantTimeEqual } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const loginSchema = z.object({ secret: z.string().min(1).max(200) });

export async function POST(request: NextRequest) {
  const reqId = `[${new Date().toISOString()}] [admin:login]`;
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }

    const expected = process.env.ADMIN_SECRET;
    if (!expected) {
      return NextResponse.json(
        { success: false, error: 'Admin dashboard is not configured.' },
        { status: 503 }
      );
    }

    if (!constantTimeEqual(parsed.data.secret, expected)) {
      // Fixed delay blunts trivial online brute force against a single shared secret.
      await new Promise((r) => setTimeout(r, 400));
      console.warn(`${reqId} Failed login attempt`);
      return NextResponse.json({ success: false, error: 'Invalid secret' }, { status: 401 });
    }

    const res = NextResponse.json({ success: true });
    res.cookies.set(ADMIN_COOKIE, await sha256hex(expected), {
      httpOnly: true,
      sameSite: 'lax', // 'lax' so a bookmarked /admin link still carries the cookie
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    console.log(`${reqId} Login OK`);
    return res;
  } catch (error) {
    console.error(`${reqId} Error:`, error);
    return NextResponse.json({ success: false, error: 'Login failed' }, { status: 500 });
  }
}
