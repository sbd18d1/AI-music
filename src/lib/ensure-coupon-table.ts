import { tursoClient } from './turso-client';

let couponEnsured = false;
let orderColumnEnsured = false;

const CREATE_COUPON_TABLE = `CREATE TABLE IF NOT EXISTS "Coupon" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "value" REAL NOT NULL DEFAULT 1.00,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "issuedByOrderId" TEXT,
  "issuedByDeviceId" TEXT,
  "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "used" BOOLEAN NOT NULL DEFAULT false,
  "usedByDeviceId" TEXT,
  "usedIp" TEXT,
  "usedAt" DATETIME,
  "usedForOrderId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);`;

/**
 * Self-healing schema guards for Turso (Prisma db push can't parse libsql:// URLs,
 * and the production TURSO_DATABASE_URL is only resolvable inside the deployed fn).
 * Use the SAME tursoClient the functions query through so DDL lands in the exact
 * DB/replica the runtime reads. Idempotent; runs once per function instance.
 */
export async function ensureCouponTable(): Promise<void> {
  if (couponEnsured) return;
  await tursoClient.execute(CREATE_COUPON_TABLE);
  couponEnsured = true;
}

/**
 * Ensure the `Order.couponCode` column exists (added for coupon audit on paid orders).
 * ALTER must be guarded by a pragma check since there's no IF NOT EXISTS for columns.
 */
export async function ensureOrderCouponColumn(): Promise<void> {
  if (orderColumnEnsured) return;
  const info = await tursoClient.execute(`PRAGMA table_info("Order")`);
  const columns = (info.rows as unknown as { name: string }[]).map((r) => r.name);
  if (!columns.includes('couponCode')) {
    await tursoClient.execute(`ALTER TABLE "Order" ADD COLUMN "couponCode" TEXT`);
  }
  orderColumnEnsured = true;
}
