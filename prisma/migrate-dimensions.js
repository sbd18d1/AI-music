import 'dotenv/config';
import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.DATABASE_URL,
});

const sql = `
CREATE TABLE IF NOT EXISTS "SongConfigDimension" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dimensionId" TEXT NOT NULL UNIQUE,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

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

CREATE INDEX IF NOT EXISTS "SongConfigDimension_dimensionId_idx" ON "SongConfigDimension"("dimensionId");
CREATE INDEX IF NOT EXISTS "SongConfigDimension_sortOrder_idx" ON "SongConfigDimension"("sortOrder");
CREATE INDEX IF NOT EXISTS "SongConfigOption_dimensionId_idx" ON "SongConfigOption"("dimensionId");
CREATE INDEX IF NOT EXISTS "SongConfigOption_optionId_idx" ON "SongConfigOption"("optionId");
CREATE INDEX IF NOT EXISTS "SongConfigOption_sortOrder_idx" ON "SongConfigOption"("sortOrder");
`;

async function runMigration() {
  try {
    console.log('Connecting to Turso database...');
    await client.execute('SELECT 1');
    console.log('Connected successfully!');

    console.log('Running dimension tables migration...');
    await client.batch(sql.split(';').filter(s => s.trim()).map(s => s + ';'));
    console.log('Migration completed successfully!');

    const dimCount = await client.execute('SELECT COUNT(*) as count FROM "SongConfigDimension"');
    const optCount = await client.execute('SELECT COUNT(*) as count FROM "SongConfigOption"');
    console.log('SongConfigDimension count:', dimCount.rows[0].count);
    console.log('SongConfigOption count:', optCount.rows[0].count);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runMigration();
