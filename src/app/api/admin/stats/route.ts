import { NextRequest, NextResponse } from 'next/server';
import { tursoClient } from '@/lib/turso-client';
import { ensureVisitTable, ensureVisitIndexes, ensureOrderAmountColumn } from '@/lib/ensure-analytics-table';
import { ensureOrderCouponColumn, ensureOrderEmailColumn } from '@/lib/ensure-coupon-table';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const maxDuration = 60;

/**
 * Preset ranges (in days, inclusive of today) plus `custom`, which supplies explicit
 * `from`/`to` dates. `all` has no lower bound.
 */
const RANGES: Record<string, number> = { '1d': 1, '3d': 3, '7d': 7, '30d': 30 };

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD (UTC) for `offsetDays` ago, matching how SQLite's date() buckets rows. */
function isoDay(offsetDays: number): string {
  const d = new Date(Date.now() - offsetDays * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** Whole days between two YYYY-MM-DD dates, inclusive. */
function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (!isFinite(a) || !isFinite(b)) return 1;
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
}

/** Zero-fill a day-keyed series so a missing day renders as 0, not as a gap. */
function fillDays<T extends Record<string, unknown>>(
  rows: T[],
  days: number | null,
  make: (day: string) => T,
  key = 'day',
  endDay?: string
): T[] {
  if (days === null) return rows; // 'all' → return whatever exists
  const byDay = new Map(rows.map((r) => [String(r[key]), r]));
  const out: T[] = [];
  // Anchor the fill to the range's end day so a custom past window isn't zero-padded
  // out to today.
  const anchor = endDay ? Date.parse(`${endDay}T00:00:00Z`) : Date.now();
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(anchor - i * 86_400_000).toISOString().slice(0, 10);
    out.push(byDay.get(day) ?? make(day));
  }
  return out;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return isFinite(n) ? n : 0;
};

/** Rate as a fraction, or null when the denominator is 0 (0 would read as "0%"). */
function rate(numerator: number, denominator: number): number | null {
  if (!denominator) return null;
  return Math.round((numerator / denominator) * 1000) / 1000;
}

type Row = Record<string, unknown>;

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const reqId = `[${new Date().toISOString()}] [admin:stats]`;
  try {
    const params = new URL(request.url).searchParams;
    const rangeParam = params.get('range') || '7d';

    // Resolve the window. Only preset ids and validated YYYY-MM-DD dates ever reach the
    // SQL below, so the interpolation there is safe.
    let days: number | null;
    let fromDay: string | null; // inclusive lower bound (YYYY-MM-DD), null = unbounded
    let toDay: string; // inclusive upper bound (YYYY-MM-DD)

    const fromParam = params.get('from');
    const toParam = params.get('to');
    if (rangeParam === 'custom' && fromParam && toParam && DAY_RE.test(fromParam) && DAY_RE.test(toParam)) {
      // Normalize a reversed selection rather than rejecting it.
      const lo = fromParam <= toParam ? fromParam : toParam;
      const hi = fromParam <= toParam ? toParam : fromParam;
      const span = daysBetween(lo, hi);
      if (span > 366) {
        // Cap a very wide custom range so the chart stays readable.
        days = 366;
        fromDay = new Date(Date.parse(`${hi}T00:00:00Z`) - 365 * 86_400_000)
          .toISOString()
          .slice(0, 10);
      } else {
        days = span;
        fromDay = lo;
      }
      toDay = hi;
    } else if (rangeParam === 'all') {
      days = null;
      fromDay = null;
      toDay = isoDay(0);
    } else {
      const preset = RANGES[rangeParam] ?? RANGES['7d'];
      days = preset;
      fromDay = isoDay(preset - 1);
      toDay = isoDay(0);
    }

    // Inclusive upper bound → exclusive for the SQL comparison.
    const endExclusive = new Date(Date.parse(`${toDay}T00:00:00Z`) + 86_400_000)
      .toISOString()
      .slice(0, 10);

    // Indexes are created here (the cold path) rather than on every page-view beacon.
    await ensureVisitTable();
    await ensureVisitIndexes();
    // The aggregation reads Order columns added by earlier self-healing guards, so
    // ensure them too — otherwise a deployment that never ran the coupon/email flow
    // would 500 here on a missing column.
    await ensureOrderAmountColumn();
    await ensureOrderCouponColumn();
    await ensureOrderEmailColumn();

    // Window clauses shared by every query. `fromDay`/`endExclusive`/`toDay` are either
    // preset-derived or validated YYYY-MM-DD strings, never raw user input, so the
    // interpolation below is safe.
    const lower = fromDay ? `AND "createdAt" >= '${fromDay}'` : '';
    const lowerUpd = fromDay ? `AND "updatedAt" >= '${fromDay}'` : '';
    const upper = `AND "createdAt" < '${endExclusive}'`;
    const upperUpd = `AND "updatedAt" < '${endExclusive}'`;

    const vWindow = `${lower} ${upper}`;
    const oWindow = `${lower} ${upper}`;
    const oUpdWindow = `${lowerUpd} ${upperUpd}`;

    // Previous equal-length window immediately before this one, for delta tiles.
    const prevWindow = days
      ? `AND "createdAt" >= '${new Date(Date.parse(`${fromDay}T00:00:00Z`) - days * 86_400_000)
          .toISOString()
          .slice(0, 10)}' AND "createdAt" < '${fromDay}'`
      : `AND 1 = 0`;

    const exec = (sql: string, args: (string | number)[] = []) => tursoClient.execute({ sql, args });

    const [
      visitsByDayRes,
      topPathsRes,
      topReferrersRes,
      geoSplitRes,
      gensByDayRes,
      outcomesByDayRes,
      paysByDayRes,
      freeByDayRes,
      funnelRes,
      totalsRes,
      prevTotalsRes,
      recentRes,
      paymentsRes,
    ] = await Promise.all([
      exec(`SELECT strftime('%Y-%m-%d', "createdAt") AS day,
                   COUNT(*) AS views,
                   COUNT(DISTINCT COALESCE("deviceId","sessionId")) AS visitors,
                   SUM(CASE WHEN "type" NOT IN ('pageview','identify') THEN 1 ELSE 0 END) AS events
            FROM "Visit"
            WHERE "isBot" = 0 ${vWindow}
            GROUP BY day ORDER BY day ASC`),

      exec(`SELECT "path" AS label, COUNT(*) AS views,
                   COUNT(DISTINCT COALESCE("deviceId","sessionId")) AS visitors
            FROM "Visit"
            WHERE "isBot" = 0 AND "type" = 'pageview' ${vWindow}
            GROUP BY "path" ORDER BY views DESC LIMIT 10`),

      exec(`SELECT "referrer" AS label, COUNT(*) AS views
            FROM "Visit"
            WHERE "isBot" = 0 AND "type" = 'pageview' AND "referrer" IS NOT NULL AND "referrer" <> '' ${vWindow}
            GROUP BY "referrer" ORDER BY views DESC LIMIT 10`),

      exec(`SELECT COALESCE("country",'??') AS country, COALESCE("city",'') AS city,
                   COUNT(*) AS views,
                   COUNT(DISTINCT COALESCE("deviceId","sessionId")) AS visitors
            FROM "Visit"
            WHERE "isBot" = 0 AND "type" = 'pageview' ${vWindow}
            GROUP BY country, city ORDER BY views DESC LIMIT 200`),

      // Generation calls: one Order row per attempt. `createdAt` = submitted.
      exec(`SELECT strftime('%Y-%m-%d', "createdAt") AS day,
                   SUM(CASE WHEN "isFullVersion" = 0 THEN 1 ELSE 0 END) AS trialCalls,
                   SUM(CASE WHEN "isFullVersion" = 1 THEN 1 ELSE 0 END) AS paidCalls
            FROM "Order"
            WHERE 1=1 ${oWindow}
            GROUP BY day ORDER BY day ASC`),

      // Outcomes settle later, so these bucket on updatedAt. A slow generation can
      // therefore land in a different bucket than the call it belongs to.
      exec(`SELECT strftime('%Y-%m-%d', "updatedAt") AS day,
                   SUM(CASE WHEN "status" = 'success' THEN 1 ELSE 0 END) AS success,
                   SUM(CASE WHEN "status" = 'failed' THEN 1 ELSE 0 END) AS failed,
                   SUM(CASE WHEN "status" IN ('pending','processing','generating','testing') THEN 1 ELSE 0 END) AS inFlight
            FROM "Order"
            WHERE 1=1 ${oUpdWindow}
            GROUP BY day ORDER BY day ASC`),

      // Payments that actually went through PayPal.
      exec(`SELECT strftime('%Y-%m-%d', "updatedAt") AS day,
                   COUNT(*) AS payments,
                   COALESCE(SUM("amountPaid"), 0) AS revenue,
                   SUM(CASE WHEN "couponCode" IS NOT NULL THEN 1 ELSE 0 END) AS discounted,
                   SUM(CASE WHEN "trialOrderId" IS NOT NULL THEN 1 ELSE 0 END) AS fromTrial
            FROM "Order"
            WHERE "isFullVersion" = 1 AND "status" = 'success'
              AND "paypalOrderId" IS NOT NULL ${oUpdWindow}
            GROUP BY day ORDER BY day ASC`),

      // Paid songs unlocked for $0 by a coupon — counted separately, otherwise the
      // paid-order count and the payment count silently disagree.
      exec(`SELECT strftime('%Y-%m-%d', "updatedAt") AS day, COUNT(*) AS freeViaCoupon
            FROM "Order"
            WHERE "isFullVersion" = 1 AND "status" = 'success'
              AND "paypalOrderId" IS NULL ${oUpdWindow}
            GROUP BY day ORDER BY day ASC`),

      exec(`SELECT
              (SELECT COUNT(DISTINCT COALESCE("deviceId","sessionId")) FROM "Visit"
                WHERE "isBot" = 0 AND "type" = 'pageview' ${vWindow}) AS visitors,
              (SELECT COUNT(*) FROM "Order" WHERE "isFullVersion" = 0 ${oWindow}) AS trialsStarted,
              (SELECT COUNT(*) FROM "Order" WHERE "isFullVersion" = 0 AND "status" = 'success' ${oWindow}) AS trialsCompleted,
              (SELECT COUNT(*) FROM "Order" WHERE "isFullVersion" = 1 ${oWindow}) AS checkoutsStarted,
              (SELECT COUNT(*) FROM "Order" WHERE "isFullVersion" = 1 AND "status" = 'success' ${oWindow}) AS paid`),

      exec(`SELECT
              (SELECT COUNT(*) FROM "Visit" WHERE "isBot" = 0 AND "type" = 'pageview' ${vWindow}) AS views,
              (SELECT COUNT(DISTINCT COALESCE("deviceId","sessionId")) FROM "Visit"
                WHERE "isBot" = 0 AND "type" = 'pageview' ${vWindow}) AS visitors,
              (SELECT COUNT(*) FROM "Order" WHERE "isFullVersion" = 0 ${oWindow}) AS trialsStarted,
              (SELECT COUNT(*) FROM "Order" WHERE "isFullVersion" = 0 AND "status" = 'success' ${oWindow}) AS trialsCompleted,
              (SELECT COUNT(*) FROM "Order" WHERE "isFullVersion" = 1 ${oWindow}) AS checkoutsStarted,
              (SELECT COUNT(*) FROM "Order" WHERE "isFullVersion" = 1 AND "status" = 'success' ${oWindow}) AS paid,
              (SELECT COALESCE(SUM("amountPaid"),0) FROM "Order"
                WHERE "isFullVersion" = 1 AND "status" = 'success' AND "paypalOrderId" IS NOT NULL ${oUpdWindow}) AS revenue`),

      exec(`SELECT
              (SELECT COUNT(*) FROM "Visit" WHERE "isBot" = 0 AND "type" = 'pageview' ${prevWindow}) AS views,
              (SELECT COUNT(DISTINCT COALESCE("deviceId","sessionId")) FROM "Visit"
                WHERE "isBot" = 0 AND "type" = 'pageview' ${prevWindow}) AS visitors,
              (SELECT COUNT(*) FROM "Order" WHERE "isFullVersion" = 0 ${prevWindow}) AS trialsStarted,
              (SELECT COUNT(*) FROM "Order" WHERE "isFullVersion" = 0 AND "status" = 'success' ${prevWindow}) AS trialsCompleted,
              (SELECT COUNT(*) FROM "Order" WHERE "isFullVersion" = 1 ${prevWindow}) AS checkoutsStarted,
              (SELECT COUNT(*) FROM "Order" WHERE "isFullVersion" = 1 AND "status" = 'success' ${prevWindow}) AS paid,
              (SELECT COALESCE(SUM("amountPaid"),0) FROM "Order"
                WHERE "isFullVersion" = 1 AND "status" = 'success' AND "paypalOrderId" IS NOT NULL ${prevWindow}) AS revenue`),

      exec(`SELECT "type", "path", "country", "city", "deviceId", "referrer",
                   strftime('%Y-%m-%dT%H:%M:%SZ', "createdAt") AS at
            FROM "Visit"
            WHERE "isBot" = 0 ${vWindow}
            ORDER BY "createdAt" DESC LIMIT 50`),

      // Paid orders, so the dashboard can list them and open a detail view per row.
      // Location lives on Visit (Order has no geo columns), so join the buyer's most
      // recent visit; it may be null for older orders placed before tracking existed.
      exec(`SELECT o."id", o."status", o."amountPaid", o."currency", o."customerEmail",
                   o."couponCode", o."trialOrderId", o."paypalOrderId", o."genre",
                   o."ipAddress", o."deviceId", o."recipientName", o."title",
                   strftime('%Y-%m-%dT%H:%M:%SZ', o."createdAt") AS createdAt,
                   strftime('%Y-%m-%dT%H:%M:%SZ', o."updatedAt") AS updatedAt,
                   (SELECT v."country" FROM "Visit" v
                     WHERE v."deviceId" = o."deviceId" AND v."isBot" = 0
                     ORDER BY v."createdAt" DESC LIMIT 1) AS country,
                   (SELECT v."city" FROM "Visit" v
                     WHERE v."deviceId" = o."deviceId" AND v."isBot" = 0
                     ORDER BY v."createdAt" DESC LIMIT 1) AS city
            FROM "Order" o
            WHERE o."isFullVersion" = 1 AND o."status" = 'success' ${oUpdWindow.replace(/"([a-zA-Z]+)"/g, 'o."$1"')}
            ORDER BY o."updatedAt" DESC LIMIT 200`),
    ]);

    const r = (res: { rows: unknown[] }) => res.rows as unknown as Row[];

    const visitsByDay = fillDays(
      r(visitsByDayRes).map((row) => ({
        day: String(row.day),
        views: num(row.views),
        visitors: num(row.visitors),
        events: num(row.events),
      })),
      days,
      (day) => ({ day, views: 0, visitors: 0, events: 0 }),
      'day',
      toDay
    );

    const gensByDay = fillDays(
      r(gensByDayRes).map((row) => ({
        day: String(row.day),
        trialCalls: num(row.trialCalls),
        paidCalls: num(row.paidCalls),
      })),
      days,
      (day) => ({ day, trialCalls: 0, paidCalls: 0 }),
      'day',
      toDay
    );

    const outcomesByDay = fillDays(
      r(outcomesByDayRes).map((row) => ({
        day: String(row.day),
        success: num(row.success),
        failed: num(row.failed),
        inFlight: num(row.inFlight),
      })),
      days,
      (day) => ({ day, success: 0, failed: 0, inFlight: 0 }),
      'day',
      toDay
    );

    const freeByDayMap = new Map(
      r(freeByDayRes).map((row) => [String(row.day), num(row.freeViaCoupon)])
    );
    const paysByDay = fillDays(
      r(paysByDayRes).map((row) => ({
        day: String(row.day),
        payments: num(row.payments),
        revenue: Math.round(num(row.revenue) * 100) / 100,
        discounted: num(row.discounted),
        fromTrial: num(row.fromTrial),
        freeViaCoupon: freeByDayMap.get(String(row.day)) ?? 0,
      })),
      days,
      (day) => ({ day, payments: 0, revenue: 0, discounted: 0, fromTrial: 0, freeViaCoupon: 0 }),
      'day',
      toDay
    );

    // Geo: one query grouped by country+city, split here so a city always has its country.
    const geoRows = r(geoSplitRes);
    const countryMap = new Map<string, { views: number; visitors: number }>();
    for (const row of geoRows) {
      const c = String(row.country);
      const cur = countryMap.get(c) ?? { views: 0, visitors: 0 };
      cur.views += num(row.views);
      cur.visitors += num(row.visitors);
      countryMap.set(c, cur);
    }
    const countries = [...countryMap.entries()]
      .map(([label, v]) => ({ label, ...v }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 12);
    const cities = geoRows
      .filter((row) => String(row.city))
      .map((row) => ({
        label: `${String(row.city)}, ${String(row.country)}`,
        views: num(row.views),
        visitors: num(row.visitors),
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 12);

    const f = (r(funnelRes)[0] ?? {}) as Row;
    const t = (r(totalsRes)[0] ?? {}) as Row;
    const p = (r(prevTotalsRes)[0] ?? {}) as Row;

    const funnel = {
      visitors: num(f.visitors),
      trialsStarted: num(f.trialsStarted),
      trialsCompleted: num(f.trialsCompleted),
      checkoutsStarted: num(f.checkoutsStarted),
      paid: num(f.paid),
      rates: {
        visitToTrial: rate(num(f.trialsStarted), num(f.visitors)),
        trialToComplete: rate(num(f.trialsCompleted), num(f.trialsStarted)),
        completeToCheckout: rate(num(f.checkoutsStarted), num(f.trialsCompleted)),
        checkoutToPaid: rate(num(f.paid), num(f.checkoutsStarted)),
        visitToPaid: rate(num(f.paid), num(f.visitors)),
      },
    };

    const totals = {
      views: num(t.views),
      visitors: num(t.visitors),
      trialsStarted: num(t.trialsStarted),
      trialsCompleted: num(t.trialsCompleted),
      checkoutsStarted: num(t.checkoutsStarted),
      paid: num(t.paid),
      revenue: Math.round(num(t.revenue) * 100) / 100,
      topCountry: countries[0]?.label ?? null,
      topCity: cities[0]?.label ?? null,
    };
    const previousTotals = {
      views: num(p.views),
      visitors: num(p.visitors),
      trialsStarted: num(p.trialsStarted),
      trialsCompleted: num(p.trialsCompleted),
      checkoutsStarted: num(p.checkoutsStarted),
      paid: num(p.paid),
      revenue: Math.round(num(p.revenue) * 100) / 100,
    };

    // 'all' has no preceding window, so there is no baseline for a delta.
    const hasPrevious = days !== null;

    return NextResponse.json({
      success: true,
      range: days ? rangeParam : 'all',
      // The resolved window, so the UI can display exactly what is being shown.
      window: { fromDay, toDay, days },
      // Shape is forward-compatible with a future daily-rollup table.
      visitsByDay,
      generationsByDay: gensByDay,
      outcomesByDay,
      paymentsByDay: paysByDay,
      topPaths: r(topPathsRes).map((row) => ({
        label: String(row.label),
        views: num(row.views),
        visitors: num(row.visitors),
      })),
      topReferrers: r(topReferrersRes).map((row) => ({
        label: String(row.label),
        views: num(row.views),
      })),
      countries,
      cities,
      funnel,
      totals,
      previousTotals: hasPrevious ? previousTotals : null,
      // Successful paid orders in the window. `amountPaid` is null for orders placed
      // before that column existed, so the UI labels those as unknown rather than $0.
      payments: r(paymentsRes).map((row) => ({
        id: String(row.id),
        status: String(row.status),
        amountPaid: row.amountPaid === null || row.amountPaid === undefined ? null : num(row.amountPaid),
        currency: row.currency ? String(row.currency) : null,
        customerEmail: row.customerEmail ? String(row.customerEmail) : null,
        couponCode: row.couponCode ? String(row.couponCode) : null,
        fromTrial: !!row.trialOrderId,
        paypalOrderId: row.paypalOrderId ? String(row.paypalOrderId) : null,
        genre: row.genre ? String(row.genre) : null,
        country: row.country ? String(row.country) : null,
        city: row.city ? String(row.city) : null,
        ipAddress: row.ipAddress ? String(row.ipAddress) : null,
        deviceId: row.deviceId ? String(row.deviceId) : null,
        recipientName: row.recipientName ? String(row.recipientName) : null,
        title: row.title ? String(row.title) : null,
        createdAt: row.createdAt ? String(row.createdAt) : null,
        updatedAt: row.updatedAt ? String(row.updatedAt) : null,
      })),
      recent: r(recentRes).map((row) => ({
        type: String(row.type),
        path: String(row.path),
        country: row.country ? String(row.country) : null,
        city: row.city ? String(row.city) : null,
        deviceId: row.deviceId ? String(row.deviceId) : null,
        referrer: row.referrer ? String(row.referrer) : null,
        at: row.at ? String(row.at) : null,
      })),
    });
  } catch (error) {
    console.error(`${reqId} Error:`, error);
    return NextResponse.json({ success: false, error: 'Failed to load stats' }, { status: 500 });
  }
}
