import 'dotenv/config';
import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_TOKEN,
});

const sql = `
-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipientName" TEXT NOT NULL,
    "personality" TEXT NOT NULL,
    "genre" TEXT NOT NULL,
    "userEmail" TEXT,
    "customerEmail" TEXT,
    "selectedStyle" TEXT,
    "selectedArtistStyle" TEXT,
    "songConfig" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "stripeSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "paypalOrderId" TEXT,
    "aiRequestId" TEXT,
    "audioUrl" TEXT,
    "lyrics" TEXT,
    "title" TEXT,
    "coverImageUrl" TEXT,
    "duration" TEXT,
    "isFullVersion" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TrialUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ipAddress" TEXT NOT NULL,
    "usedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Order_stripeSessionId_idx" ON "Order"("stripeSessionId");

-- CreateIndex
CREATE INDEX "Order_paypalOrderId_idx" ON "Order"("paypalOrderId");

-- CreateIndex
CREATE INDEX "Order_aiRequestId_idx" ON "Order"("aiRequestId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "TrialUsage_ipAddress_idx" ON "TrialUsage"("ipAddress");

-- CreateIndex
CREATE INDEX "TrialUsage_usedAt_idx" ON "TrialUsage"("usedAt");

-- CreateTable SongConfigDimension
CREATE TABLE IF NOT EXISTS "SongConfigDimension" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dimensionId" TEXT NOT NULL UNIQUE,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable SongConfigOption
CREATE TABLE IF NOT EXISTS "SongConfigOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "optionId" TEXT NOT NULL UNIQUE,
    "dimensionId" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "styleTag" TEXT,
    "lyricInstruction" TEXT,
    "genreValue" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex SongConfigDimension
CREATE INDEX IF NOT EXISTS "SongConfigDimension_dimensionId_idx" ON "SongConfigDimension"("dimensionId");
CREATE INDEX IF NOT EXISTS "SongConfigDimension_sortOrder_idx" ON "SongConfigDimension"("sortOrder");

-- CreateIndex SongConfigOption
CREATE INDEX IF NOT EXISTS "SongConfigOption_dimensionId_idx" ON "SongConfigOption"("dimensionId");
CREATE INDEX IF NOT EXISTS "SongConfigOption_optionId_idx" ON "SongConfigOption"("optionId");
CREATE INDEX IF NOT EXISTS "SongConfigOption_sortOrder_idx" ON "SongConfigOption"("sortOrder");
`;

async function runMigration() {
  try {
    console.log('Connecting to Turso database...');
    await client.execute('SELECT 1');
    console.log('Connected successfully!');

    console.log('Running migration...');
    await client.batch(sql.split(';').filter(s => s.trim()).map(s => s + ';'));
    console.log('Migration completed successfully!');

    const result = await client.execute('SELECT COUNT(*) as count FROM "Order"');
    console.log('Order table row count:', result.rows[0].count);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runMigration();
