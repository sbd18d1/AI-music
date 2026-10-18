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
 * destroy the operator's sales ledger and the customer's proof of purchase. Only the
 * free-trial state is cleared so the device can preview again.
 */
import { prisma } from '@/db/client';
import { tursoClient } from '@/lib/turso-client';
import { ensureCouponTable } from '@/lib/ensure-coupon-table';
import { ensureVisitTable } from '@/lib/ensure-analytics-table';

export interface ResetSummary {
  trialUsage: number;
  trialOrders: number;
  coupons: number;
  visits: number;
  paidOrdersKept: number;
}

export async function resetDeviceData(deviceId: string): Promise<ResetSummary> {
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
  };
}
