import type { NextRequest } from 'next/server';

/**
 * Client IP from the proxy headers. Extracted here so new code doesn't add a sixth
 * copy — the existing routes still carry their own inline versions (a separate,
 * isolated refactor).
 */
export function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return request.headers.get('x-real-ip') || request.ip || 'unknown';
}

export interface RequestGeo {
  country: string | null;
  region: string | null;
  city: string | null;
}

/**
 * Approximate location from Vercel's request headers. These are populated only on a
 * Vercel deployment — locally they are absent and every field is null, which is
 * expected (the dashboard's geo sections are simply empty in dev).
 *
 * Vercel URL-encodes the city ("San%20Francisco", "M%C3%BCnchen"), so it must be
 * decoded or the dashboard shows the percent escapes verbatim.
 */
export function getGeo(request: NextRequest): RequestGeo {
  const decode = (v: string | null): string | null => {
    if (!v) return null;
    try {
      return decodeURIComponent(v).slice(0, 100);
    } catch {
      return v.slice(0, 100);
    }
  };

  return {
    country: request.headers.get('x-vercel-ip-country')?.slice(0, 2).toUpperCase() || null,
    region: request.headers.get('x-vercel-ip-country-region')?.slice(0, 10) || null,
    city: decode(request.headers.get('x-vercel-ip-city')),
  };
}
