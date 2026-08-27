import { prisma } from '@/db/client';
import { ensureOrderCouponColumn } from '@/lib/ensure-coupon-table';

/**
 * Atomically consume (void) the fingerprint-bound coupon that was auto-applied to an
 * order, once that order is paid (status 'success'). Guards with `used: false` so a
 * concurrent flow can't double-void, and records the audit trail (when + which order +
 * which device/ip) on the coupon row. Fails silently if no coupon is attached.
 *
 * Returns the number of coupons consumed (0 or 1) so callers can log/verify.
 */
export async function consumeCouponForOrder(
  orderId: string,
  couponCode?: string | null,
  deviceId?: string | null,
  ip?: string
): Promise<number> {
  // Make sure read/writes referencing Order.couponCode won't hit a missing column.
  await ensureOrderCouponColumn();

  // Prefer the exact coupon recorded on the order; fall back to an unused coupon bound
  // to the same fingerprint (one per order by construction since we consume only one).
  const where = couponCode
    ? { code: couponCode, used: false }
    : deviceId
      ? { issuedByDeviceId: deviceId, used: false }
      : null;

  if (!where) return 0;

  const res = await prisma.coupon.updateMany({
    where: {
      ...where,
      // Only the very first matching coupon is consumed per order (no stacking).
      usedForOrderId: null,
    },
    data: {
      used: true,
      usedAt: new Date(),
      usedForOrderId: orderId,
      usedByDeviceId: deviceId || null,
      usedIp: ip || null,
    },
  });

  return res.count;
}
