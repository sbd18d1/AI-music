/**
 * Delete every record belonging to ONE device fingerprint.
 *
 * This is the "reset" the user can trigger from the site: it must erase exactly that
 * browser's data and nothing else.
 *
 * The previous implementation also matched on `ipAddress`, which is wrong: many people
 * share one public IP (home NAT, office, mobile carrier). Matching by IP deleted OTHER
 * users' trial usage and orders, and could burn their free trial. A device fingerprint
 * is per-browser, and it is the identity the rest of the app already uses (Order.deviceId,
 * TrialUsage.deviceId, coupon binding), so it is the only correct key here.
 *
 * Paid orders are deliberately KEPT: they represent real money. Deleting them would
 * destroy the operator's sales ledger and the customer's proof of purchase.
 *
 * Trial eligibility itself is no longer derived from these rows — it is the explicit
 * `canPreview` flag on the Device row, which this function flips back to true. The
 * deletions below only clear stale per-trial bookkeeping.
 */
import { prisma } from '@/db/client';
import { tursoClient } from '@/lib/turso-client';
import { ensureCouponTable } from '@/lib/ensure-coupon-table';
import { ensureVisitTable } from '@/lib/ensure-analytics-table';
import { enablePreview } from '@/lib/device-state';

export interface ResetSummary {
  trialUsage: number;
  trialOrders: number;
  coupons: number;
  visits: number;
  paidOrdersKept: number;
  previewReenabled: boolean;
}

export async function resetDeviceData(deviceId: string): Promise<ResetSummary> {
  // The explicit preview switch is the authoritative gate now — flip it back first.
  // This is the whole point of the reset: no rows need deleting for preview to work.
  await enablePreview(deviceId);
  // Everything below is scoped by deviceId ONLY — never by IP.
  const deletedUsage = await prisma.trialUsage.deleteMany({ where: { deviceId } });

  const deletedOrders = await prisma.order.deleteMany({
    where: { deviceId, isFullVersion: false },
  });

  const paidOrdersKept = await prisma.order.count({
    where: { deviceId, isFullVersion: true },
  });

  let coupons = 0;
  await ensureCouponTable();
  const couponRes = await prisma.coupon.updateMany({
    where: { issuedByDeviceId: deviceId, used: false },
    data: { used: true, usedAt: new Date(), usedForOrderId: 'reset' },
  });
  coupons = couponRes.count;

  let visits = 0;
  await ensureVisitTable();
  const visitRes = await tursoClient.execute({
    sql: `DELETE FROM "Visit" WHERE "deviceId" = ?`,
    args: [deviceId],
  });
  visits = visitRes.rowsAffected;

  return {
    trialUsage: deletedUsage.count,
    trialOrders: deletedOrders.count,
    coupons,
    visits,
    paidOrdersKept,
    previewReenabled: true,
  };
}
