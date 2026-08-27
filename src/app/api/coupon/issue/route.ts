import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/db/client';
import { ensureCouponTable, ensureOrderCouponColumn } from '@/lib/ensure-coupon-table';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const maxDuration = 60;

const issueSchema = z.object({
  deviceId: z.string().min(1).max(200), // browser fingerprint (getDeviceId) — coupon owner
});

const COUPON_VALUE = 0.5; // USD — deduction applied to the next purchase

/** Internal, collision-safe code. Never shown to the user — only used to track/audit. */
function generateCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let raw = '';
  const buf = randomBytes(6);
  for (let i = 0; i < buf.length; i++) raw += alphabet[buf[i] % alphabet.length];
  return `INT-${raw}`;
}

/**
 * POST /api/coupon/issue
 * Awards the user (identified by browser fingerprint) ONE $2 coupon that is bound to
 * that fingerprint and auto-applied on their NEXT purchase. A user earns it by sharing
 * after PAID to unlock a full song. Idempotent: once an unused coupon exists for this
 * device, repeat calls return the same record (first-share = one coupon).
 */
export async function POST(request: NextRequest) {
  const reqId = `[${new Date().toISOString()}] [coupon:issue]`;
  try {
    await ensureCouponTable();
    await ensureOrderCouponColumn();
    const body = await request.json().catch(() => ({}));
    const parsed = issueSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Missing device fingerprint.' },
        { status: 400 }
      );
    }

    const { deviceId } = parsed.data;

    // The user must have actually PAID to unlock a full song before they can earn a coupon.
    const paidOrderExists = await prisma.order.findFirst({
      where: { deviceId, isFullVersion: true, status: 'success' },
    });
    if (!paidOrderExists) {
      return NextResponse.json(
        { success: false, error: 'Unlock a full song first, then share to earn a coupon.' },
        { status: 400 }
      );
    }

    // Idempotent: an unused coupon already exists for this fingerprint → return it (no new one).
    const existing = await prisma.coupon.findFirst({
      where: { issuedByDeviceId: deviceId, used: false },
    });
    if (existing) {
      console.log(`${reqId} Reusing existing coupon for deviceId=${deviceId.slice(0, 12)}… ` +
        `(value=$ ${Number(existing.value).toFixed(2)}, code=${existing.code})`);
      return NextResponse.json({ success: true, value: Number(existing.value) });
    }

    // Issue a fresh coupon bound to this fingerprint. "First share" is enforced by the dedupe
    // above: once one unused coupon exists, no second is created.
    let coupon = null;
    for (let attempt = 0; attempt < 5 && !coupon; attempt++) {
      try {
        coupon = await prisma.coupon.create({
          data: {
            code: generateCode(),
            value: COUPON_VALUE,
            currency: 'USD',
            issuedByDeviceId: deviceId,
            used: false,
          },
        });
      } catch (err) {
        if ((err as { code?: string })?.code !== 'P2002') throw err;
      }
    }

    if (!coupon) {
      return NextResponse.json({ success: false, error: 'Could not create a coupon, try again.' }, { status: 500 });
    }

    console.log(`${reqId} Issued $${COUPON_VALUE.toFixed(2)} coupon (code=${coupon.code}) to deviceId=${deviceId.slice(0, 12)}…`);
    // NOTE: we deliberately do NOT return `code` to the frontend — the coupon is owned by
    // the fingerprint and auto-applied server-side on the next purchase.
    return NextResponse.json({ success: true, value: COUPON_VALUE });
  } catch (error) {
    console.error(`${reqId} Error:`, error);
    return NextResponse.json({ success: false, error: 'Failed to issue coupon' }, { status: 500 });
  }
}
