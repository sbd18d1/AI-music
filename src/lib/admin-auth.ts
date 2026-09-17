import { NextRequest, NextResponse } from 'next/server';

/**
 * Minimal admin gate for the internal monitoring dashboard. This is the project's
 * first auth pattern — there is no session store and exactly one operator, so a single
 * shared secret is the right size of solution.
 *
 * The cookie holds sha256(secret), not the secret itself, so a leaked cookie (browser
 * sync, a shared machine) does not hand over the environment variable.
 */

export const ADMIN_COOKIE = 'admin_session';

export async function sha256hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Length-independent comparison so a mismatch does not leak the shared prefix. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Returns a 401 response when the request is not an authenticated admin, or null when
 * it is. API routes call this rather than relying on the page middleware, so a fetch
 * gets real JSON instead of a 302 to an HTML login page.
 */
export async function requireAdmin(request: NextRequest): Promise<NextResponse | null> {
  const secret = process.env.ADMIN_SECRET;
  // Fail closed: an unconfigured dashboard is unreachable, never open.
  if (!secret) {
    return NextResponse.json(
      { success: false, error: 'Admin dashboard is not configured.' },
      { status: 503 }
    );
  }
  const cookie = request.cookies.get(ADMIN_COOKIE)?.value;
  if (!cookie) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const expected = await sha256hex(secret);
  if (!constantTimeEqual(cookie, expected)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
