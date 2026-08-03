// 添加 TrialUsage 和 Order 表的 deviceId 列（如果不存在）
// 用法: node prisma/migrate-add-deviceid.js
require('dotenv').config();
const { createClient } = require('@libsql/client');

async function main() {
  const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN || (process.env.DATABASE_URL || '').match(/[?&]authToken=([^&]+)/)?.[1];

  if (!url) {
    console.error('Missing TURSO_DATABASE_URL');
    process.exit(1);
  }

  const client = createClient({
    url: url.split('?')[0],
    authToken,
  });

  console.log('Checking TrialUsage table schema...');
  try {
    const trialCols = await client.execute("PRAGMA table_info(TrialUsage)");
    console.log('TrialUsage columns:', trialCols.rows.map(r => r.name).join(', '));

    const hasTrialDeviceId = trialCols.rows.some(r => r.name === 'deviceId');
    if (!hasTrialDeviceId) {
      console.log('Adding deviceId column to TrialUsage...');
      await client.execute("ALTER TABLE TrialUsage ADD COLUMN deviceId TEXT");
      console.log('✅ Added deviceId to TrialUsage');
    } else {
      console.log('✅ TrialUsage.deviceId already exists');
    }
  } catch (e) {
    console.error('TrialUsage migration error:', e.message);
  }

  console.log('\nChecking Order table schema...');
  try {
    const orderCols = await client.execute('PRAGMA table_info("Order")');
    console.log('Order columns:', orderCols.rows.map(r => r.name).join(', '));

    const hasOrderDeviceId = orderCols.rows.some(r => r.name === 'deviceId');
    if (!hasOrderDeviceId) {
      console.log('Adding deviceId column to Order...');
      await client.execute('ALTER TABLE "Order" ADD COLUMN deviceId TEXT');
      console.log('✅ Added deviceId to Order');
    } else {
      console.log('✅ Order.deviceId already exists');
    }
  } catch (e) {
    console.error('Order migration error:', e.message);
  }

  console.log('\nChecking indexes...');
  try {
    const indexes = await client.execute("SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND tbl_name IN ('TrialUsage', 'Order')");
    console.log('Existing indexes:', indexes.rows.map(r => `${r.tbl_name}.${r.name}`).join(', '));

    const idxArr = indexes.rows.map(r => r.name);
    if (!idxArr.includes('TrialUsage_deviceId_index')) {
      await client.execute("CREATE INDEX TrialUsage_deviceId_index ON TrialUsage(deviceId)");
      console.log('✅ Created TrialUsage_deviceId_index');
    }
    if (!idxArr.includes('Order_deviceId_index')) {
      await client.execute('CREATE INDEX Order_deviceId_index ON "Order"(deviceId)');
      console.log('✅ Created Order_deviceId_index');
    }
  } catch (e) {
    console.error('Index creation error:', e.message);
  }

  client.close();
  console.log('\n✅ Migration complete');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
