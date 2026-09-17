import { NextRequest, NextResponse } from 'next/server';
import { tursoClient } from '@/lib/turso-client';
import { ensureOrderAmountColumn } from '@/lib/ensure-analytics-table';
import { ensureOrderCouponColumn, ensureOrderEmailColumn } from '@/lib/ensure-coupon-table';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

type Row = Record<string, unknown>;

const s = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));
const n = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const x = Number(v);
  return isFinite(x) ? x : null;
};

/**
 * GET /api/admin/payments/[id]
 * Full detail for one paid order — the drill-down behind a payment row on the
 * dashboard. Deliberately a separate endpoint rather than widening the stats payload,
 * so the dashboard list stays small and this is fetched only on demand.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const reqId = `[${new Date().toISOString()}] [admin:payment]`;
  try {
    await ensureOrderAmountColumn();
    await ensureOrderCouponColumn();
    await ensureOrderEmailColumn();

    const orderId = params.id;
    if (!orderId) {
      return NextResponse.json({ success: false, error: 'Missing order id' }, { status: 400 });
    }

    const res = await tursoClient.execute({
      sql: `SELECT "id", "status", "amountPaid", "currency", "customerEmail", "userEmail",
                   "couponCode", "trialOrderId", "paypalOrderId", "genre", "recipientName",
                   "personality", "title", "duration", "audioUrl", "ipAddress", "deviceId",
                   "aiRequestId", "emailSentAt",
                   strftime('%Y-%m-%dT%H:%M:%SZ', "createdAt") AS createdAt,
                   strftime('%Y-%m-%dT%H:%M:%SZ', "updatedAt") AS updatedAt
            FROM "Order" WHERE "id" = ? LIMIT 1`,
      args: [orderId],
    });

    const order = res.rows[0] as Row | undefined;
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    // The buyer's location comes from their tracked visits (Order has no geo columns).
    const geoRes = await tursoClient.execute({
      sql: `SELECT "country", "city", "region", "referrer",
                   strftime('%Y-%m-%dT%H:%M:%SZ', "createdAt") AS at
            FROM "Visit"
            WHERE "deviceId" = ? AND "isBot" = 0
            ORDER BY "createdAt" DESC LIMIT 1`,
      args: [s(order.deviceId) ?? ''],
    });
    const geo = (geoRes.rows[0] ?? {}) as Row;

    // Any coupon attached to this order, for the discount breakdown.
    let coupon: Row | null = null;
    const couponCode = s(order.couponCode);
    if (couponCode) {
      const cRes = await tursoClient.execute({
        sql: `SELECT "code", "value", "currency", "used", "issuedAt", "usedAt" FROM "Coupon" WHERE "code" = ? LIMIT 1`,
        args: [couponCode],
      });
      coupon = (cRes.rows[0] as Row | undefined) ?? null;
    }

    return NextResponse.json({
      success: true,
      payment: {
        id: s(order.id),
        status: s(order.status),
        amountPaid: n(order.amountPaid),
        currency: s(order.currency),
        customerEmail: s(order.customerEmail) || s(order.userEmail),
        paypalOrderId: s(order.paypalOrderId),
        couponCode: s(order.couponCode),
        coupon: coupon
          ? {
              code: s(coupon.code),
              value: n(coupon.value),
              currency: s(coupon.currency),
              used: !!coupon.used,
            }
          : null,
        fromTrial: !!order.trialOrderId,
        trialOrderId: s(order.trialOrderId),
        genre: s(order.genre),
        recipientName: s(order.recipientName),
        title: s(order.title),
        duration: s(order.duration),
        ipAddress: s(order.ipAddress),
        deviceId: s(order.deviceId),
        aiRequestId: s(order.aiRequestId),
        emailSentAt: s(order.emailSentAt),
        createdAt: s(order.createdAt),
        updatedAt: s(order.updatedAt),
        location: {
          country: s(geo.country),
          city: s(geo.city),
          region: s(geo.region),
          referrer: s(geo.referrer),
        },
      },
    });
  } catch (error) {
    console.error(`${reqId} Error:`, error);
    return NextResponse.json({ success: false, error: 'Failed to load payment' }, { status: 500 });
  }
}
