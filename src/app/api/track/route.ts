import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { tursoClient } from '@/lib/turso-client';
import { ensureVisitTable } from '@/lib/ensure-analytics-table';
import { getGeo } from '@/lib/request-ip';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
// Deliberately short: this endpoint fires on every page view, so a runaway invocation
// must be cheap. It does one INSERT (plus at most one dedupe SELECT).
export const maxDuration = 10;

const trackSchema = z.object({
  // 'identify' is the deferred-fingerprint beacon (see components/Analytics.tsx) —
  // it carries a deviceId for an already-counted page view and must be excluded from
  // click/event counts on the dashboard.
  type: z.enum(['pageview', 'identify', 'trial_start', 'checkout_start', 'share', 'download']).default('pageview'),
  path: z.string().max(300),
  referrer: z.string().max(300).optional(),
  deviceId: z.string().max(200).optional(),
  sessionId: z.string().max(64).optional(),
  utmSource: z.string().max(100).optional(),
  utmMedium: z.string().max(100).optional(),
  utmCampaign: z.string().max(100).optional(),
});

// Server-side bot detection — a client can lie, so this cannot live in the browser.
// An empty User-Agent is treated as a bot: almost always a script, never a browser.
const BOT_RE =
  /bot|crawl|spider|slurp|bingpreview|headlesschrome|facebookexternalhit|whatsapp|telegrambot|semrush|ahrefs|petalbot|yandex|baiduspider|gptbot|claudebot|perplexity/i;

/** Normalize a referrer to its host only — full URLs can carry PII in query strings. */
function referrerHost(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const host = new URL(raw).hostname.replace(/^www\./, '');
    return host ? host.slice(0, 200) : null;
  } catch {
    return null;
  }
}

/**
 * POST /api/track
 * Public, fire-and-forget first-party analytics beacon. Called via navigator.sendBeacon
 * from the client tracker, so it MUST never surface an error the browser will log or
 * retry on — every failure path returns 200.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = trackSchema.safeParse(body);
    if (!parsed.success) {
      // 200 (not 400) on purpose: this is a beacon, a rejection is not actionable.
      return NextResponse.json({ success: false });
    }

    const { type, path, referrer, deviceId, sessionId, utmSource, utmMedium, utmCampaign } =
      parsed.data;

    // Anything not a site-relative path is coerced to '/' — cheap spam guard, and it
    // keeps the stored value something we'd actually render.
    const safePath = path.startsWith('/') ? path : '/';

    const ua = request.headers.get('user-agent') || '';
    const isBot = !ua || BOT_RE.test(ua);

    const { country, region, city } = getGeo(request);
    const host = (request.headers.get('host') || '').slice(0, 200) || null;

    await ensureVisitTable();

    // Dedupe: a beacon can fire twice for one view (React StrictMode double-effect in
    // dev, bfcache restores). Skipped entirely when there is no sessionId, because a
    // NULL would match every anonymous row.
    if (type === 'pageview' && sessionId) {
      const dup = await tursoClient.execute({
        sql: `SELECT 1 FROM "Visit"
              WHERE "type" = 'pageview' AND "sessionId" = ? AND "path" = ?
                AND "createdAt" > datetime('now','-30 seconds')
              LIMIT 1`,
        args: [sessionId, safePath],
      });
      if (dup.rows.length > 0) {
        return NextResponse.json({ success: true, deduped: true });
      }
    }

    await tursoClient.execute({
      sql: `INSERT INTO "Visit"
              ("id","type","path","referrer","host","country","region","city",
               "deviceId","sessionId","isBot","utmSource","utmMedium","utmCampaign")
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [
        crypto.randomUUID(),
        type,
        safePath,
        referrerHost(referrer),
        host,
        country,
        region,
        city,
        deviceId ?? null,
        sessionId ?? null,
        isBot ? 1 : 0,
        utmSource ?? null,
        utmMedium ?? null,
        utmCampaign ?? null,
      ],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    // Never 500 — a failing beacon must be invisible to the user and to monitoring.
    console.error(`[${new Date().toISOString()}] [track] Error:`, error);
    return NextResponse.json({ success: false });
  }
}
