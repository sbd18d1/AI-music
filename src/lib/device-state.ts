import { tursoClient } from './turso-client';

let deviceEnsured = false;

/**
 * One row per browser fingerprint — the closest thing this app has to a "user" table.
 *
 * Historically the device fingerprint was just a column sprinkled across Order,
 * TrialUsage, Visit and Coupon, with no single place to ask "what state is this visitor
 * in?". Trial eligibility was therefore INFERRED by counting rows in two other tables,
 * which made "reset" mean "delete rows" and made the rule impossible to state without
 * reading the code.
 *
 * `canPreview` turns that inference into an explicit switch: new visitors default to
 * true, and anything that consumes the free preview (a successful trial generation or a
 * successful purchase) flips it to false. Resetting a device just sets it back to true
 * — no data is destroyed.
 */
const CREATE_DEVICE_TABLE = `CREATE TABLE IF NOT EXISTS "Device" (
  "deviceId" TEXT NOT NULL PRIMARY KEY,
  "canPreview" BOOLEAN NOT NULL DEFAULT true,
  "reason" TEXT,
  "ipAddress" TEXT,
  "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);`;

export async function ensureDeviceTable(): Promise<void> {
  if (deviceEnsured) return;
  await tursoClient.execute(CREATE_DEVICE_TABLE);
  deviceEnsured = true;
}

/** True when this device may still see a free preview. Unknown devices may. */
export async function canPreview(deviceId: string | null | undefined): Promise<boolean> {
  if (!deviceId) return false;
  await ensureDeviceTable();
  const res = await tursoClient.execute({
    sql: `SELECT "canPreview" FROM "Device" WHERE "deviceId" = ? LIMIT 1`,
    args: [deviceId],
  });
  const row = res.rows[0] as { canPreview?: unknown } | undefined;
  // No row yet = first visit = eligible.
  if (!row) return true;
  return row.canPreview === 1 || row.canPreview === true || row.canPreview === '1';
}

/**
 * Turn the free preview off for this device. Idempotent: the row is created on first
 * use, and an already-disabled device keeps its original reason/timestamp semantics
 * (lastSeenAt is refreshed either way).
 */
export async function disablePreview(deviceId: string, reason: string): Promise<void> {
  if (!deviceId) return;
  await ensureDeviceTable();
  await tursoClient.execute({
    sql: `INSERT INTO "Device" ("deviceId","canPreview","reason","firstSeenAt","lastSeenAt")
          VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT("deviceId") DO UPDATE SET
            "canPreview" = 0,
            "reason" = excluded."reason",
            "lastSeenAt" = CURRENT_TIMESTAMP`,
    args: [deviceId, 0, reason],
  });
}

/** Re-enable the free preview (the reset action). Does not delete any data. */
export async function enablePreview(deviceId: string): Promise<void> {
  if (!deviceId) return;
  await ensureDeviceTable();
  await tursoClient.execute({
    sql: `INSERT INTO "Device" ("deviceId","canPreview","reason","firstSeenAt","lastSeenAt")
          VALUES (?, 1, 'reset', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT("deviceId") DO UPDATE SET
            "canPreview" = 1,
            "reason" = 'reset',
            "lastSeenAt" = CURRENT_TIMESTAMP`,
    args: [deviceId],
  });
}

/** Record where the device was last seen (called on trial requests). */
export async function touchDevice(deviceId: string | null | undefined, ip?: string): Promise<void> {
  if (!deviceId) return;
  try {
    await ensureDeviceTable();
    await tursoClient.execute({
      sql: `INSERT INTO "Device" ("deviceId","ipAddress","firstSeenAt","lastSeenAt")
            VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT("deviceId") DO UPDATE SET
              "ipAddress" = COALESCE(excluded."ipAddress", "Device"."ipAddress"),
              "lastSeenAt" = CURRENT_TIMESTAMP`,
      args: [deviceId, ip || null],
    });
  } catch (e) {
    // Never let bookkeeping break a generation request.
    console.error('[device] touchDevice failed:', e);
  }
}

/**
 * Backfill from existing orders: any device that ever produced a TRIAL order or a
 * successful PAID order has already consumed its free preview and must not get another.
 * Called once at startup-ish time (safe to repeat — it is idempotent).
 */
export async function backfillDevices(): Promise<{ created: number }> {
  await ensureDeviceTable();
  // Insert a disabled row for every device with a consuming history, but never
  // overwrite a row that already exists (so a manual reset is not undone).
  const res = await tursoClient.execute(`
    INSERT INTO "Device" ("deviceId","canPreview","reason","firstSeenAt","lastSeenAt")
    SELECT "deviceId", 0,
           CASE WHEN MAX("isFullVersion") = 1 THEN 'purchased' ELSE 'trial_used' END,
           MIN("createdAt"), MAX("createdAt")
    FROM "Order"
    WHERE "deviceId" IS NOT NULL AND "deviceId" <> ''
      AND ("isFullVersion" = 0 OR ("isFullVersion" = 1 AND "status" = 'success'))
    GROUP BY "deviceId"
    ON CONFLICT("deviceId") DO NOTHING
  `);
  return { created: res.rowsAffected };
}
