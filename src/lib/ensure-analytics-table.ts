import { tursoClient } from './turso-client';

let visitEnsured = false;
let visitIndexesEnsured = false;
let orderAmountColumnEnsured = false;

/**
 * First-party analytics log. One narrow table serves BOTH page views and named
 * click/conversion beacons, so a single GROUP BY can produce per-path funnels.
 *
 * Geo is country/region/city only, resolved from Vercel's request headers at write
 * time — raw IP is intentionally NOT stored here (Order.ipAddress already exists and
 * is a separate concern). `isBot` rows are kept for auditing but excluded from every
 * aggregate via `WHERE "isBot" = 0`.
 */
const CREATE_VISIT_TABLE = `CREATE TABLE IF NOT EXISTS "Visit" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "type" TEXT NOT NULL DEFAULT 'pageview',
  "path" TEXT NOT NULL,
  "referrer" TEXT,
  "host" TEXT,
  "country" TEXT,
  "region" TEXT,
  "city" TEXT,
  "deviceId" TEXT,
  "sessionId" TEXT,
  "isBot" BOOLEAN NOT NULL DEFAULT false,
  "utmSource" TEXT,
  "utmMedium" TEXT,
  "utmCampaign" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);`;

/**
 * Self-healing schema guards for Turso (same rationale as ensure-coupon-table.ts:
 * Prisma db push can't parse libsql:// URLs, and the production TURSO_DATABASE_URL
 * is only resolvable inside the deployed fn). Use the SAME tursoClient the functions
 * query through so DDL lands in the exact DB/replica the runtime reads.
 * Idempotent; runs once per function instance.
 */
export async function ensureVisitTable(): Promise<void> {
  if (visitEnsured) return;
  await tursoClient.execute(CREATE_VISIT_TABLE);
  visitEnsured = true;
}

/**
 * Indexes are created separately from the table so the hot per-pageview path only
 * pays for the table guard. Called once from the (cold) stats route instead.
 */
export async function ensureVisitIndexes(): Promise<void> {
  if (visitIndexesEnsured) return;
  await tursoClient.execute(`CREATE INDEX IF NOT EXISTS "Visit_createdAt_idx" ON "Visit"("createdAt")`);
  await tursoClient.execute(`CREATE INDEX IF NOT EXISTS "Visit_type_createdAt_idx" ON "Visit"("type","createdAt")`);
  await tursoClient.execute(`CREATE INDEX IF NOT EXISTS "Visit_path_idx" ON "Visit"("path")`);
  await tursoClient.execute(`CREATE INDEX IF NOT EXISTS "Visit_sessionId_idx" ON "Visit"("sessionId")`);
  await tursoClient.execute(`CREATE INDEX IF NOT EXISTS "Visit_country_idx" ON "Visit"("country")`);
  visitIndexesEnsured = true;
}

/**
 * Ensure the `Order.amountPaid` column exists. Order historically had no money column,
 * so revenue could only be guessed from the price constant minus any coupon. The real
 * captured amount is written at payment time so the payment monitor is a ledger, not an
 * estimate. ALTER must be guarded by a pragma check (no IF NOT EXISTS for columns).
 */
export async function ensureOrderAmountColumn(): Promise<void> {
  if (orderAmountColumnEnsured) return;
  const info = await tursoClient.execute(`PRAGMA table_info("Order")`);
  const columns = (info.rows as unknown as { name: string }[]).map((r) => r.name);
  if (!columns.includes('amountPaid')) {
    await tursoClient.execute(`ALTER TABLE "Order" ADD COLUMN "amountPaid" REAL`);
  }
  if (!columns.includes('currency')) {
    await tursoClient.execute(`ALTER TABLE "Order" ADD COLUMN "currency" TEXT`);
  }
  orderAmountColumnEnsured = true;
}
