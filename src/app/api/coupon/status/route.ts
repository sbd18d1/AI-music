import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/db/client';
import { ensureCouponTable } from '@/lib/ensure-coupon-table';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/**
 * GET /api/coupon/status?deviceId=<fingerprint>
 * Returns whether this fingerprint has an unused coupon (and its value), so the UI can
 * tell the user a discount will be applied automatically. No code is exposed.
 */
export async function GET(request: NextRequest) {
  try {
    await ensureCouponTable();
    const deviceId = new URL(request.url).searchParams.get('deviceId');
    if (!deviceId) {
      return NextResponse.json({ hasCoupon: false });
    }

    const coupon = await prisma.coupon.findFirst({
      where: { issuedByDeviceId: deviceId, used: false },
      select: { value: true },
    });

    if (!coupon) {
      return NextResponse.json({ hasCoupon: false, value: 0 });
    }
    return NextResponse.json({ hasCoupon: true, value: Number(coupon.value) });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] [coupon:status] Error:`, error);
    return NextResponse.json({ hasCoupon: false, value: 0 });
  }
}
