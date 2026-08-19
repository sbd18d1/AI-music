// One-off migration script: rename Order.paddleTransactionId -> paypalOrderId
// Run with: npx tsx scripts/rename-paypal-column.ts

import 'dotenv/config';
import { createClient } from '@libsql/client';

async function main() {
  const url = process.env.TURSO_DATABASE_URL || '';
  const token = process.env.TURSO_AUTH_TOKEN;
  if (!url) {
    console.error('TURSO_DATABASE_URL not set');
    process.exit(1);
  }

  const client = createClient({ url, authToken: token });

  // 1. Inspect current columns
  const cols = await client.execute(`PRAGMA table_info("Order")`);
  console.log('Current columns:');
  for (const row of cols.rows) {
    console.log('  -', row.name);
  }

  const hasPaddle = cols.rows.some((r) => r.name === 'paddleTransactionId');
  const hasPaypal = cols.rows.some((r) => r.name === 'paypalOrderId');

  if (hasPaypal && !hasPaddle) {
    console.log('\nAlready migrated: paypalOrderId exists, paddleTransactionId does not. Nothing to do.');
    client.close();
    return;
  }

  if (!hasPaddle) {
    console.log('\npaddleTransactionId column not found. Adding paypalOrderId column...');
    await client.execute(`ALTER TABLE "Order" ADD COLUMN "paypalOrderId" TEXT`);
    console.log('Added paypalOrderId column.');
    client.close();
    return;
  }

  // Has paddleTransactionId — rename it to paypalOrderId (SQLite ≥ 3.25 supports RENAME COLUMN)
  console.log('\nRenaming paddleTransactionId -> paypalOrderId ...');
  await client.execute(`ALTER TABLE "Order" RENAME COLUMN "paddleTransactionId" TO "paypalOrderId"`);
  console.log('Renamed successfully.');

  // 2. Verify
  const colsAfter = await client.execute(`PRAGMA table_info("Order")`);
  console.log('\nColumns after migration:');
  for (const row of colsAfter.rows) {
    console.log('  -', row.name);
  }

  // 3. Rebuild indexes (drop old, create new)
  try {
    await client.execute(`DROP INDEX IF EXISTS "Order_paddleTransactionId_idx"`);
    console.log('\nDropped old index Order_paddleTransactionId_idx');
  } catch (e) {
    console.log('\nOld index drop skipped:', (e as Error).message);
  }
  try {
    await client.execute(`CREATE INDEX IF NOT EXISTS "Order_paypalOrderId_idx" ON "Order"("paypalOrderId")`);
    console.log('Created new index Order_paypalOrderId_idx');
  } catch (e) {
    console.log('New index create skipped:', (e as Error).message);
  }

  client.close();
  console.log('\nMigration complete.');
}

main().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
