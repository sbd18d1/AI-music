/**
 * 生产数据库迁移脚本
 * 直接使用 libsql client 对生产 Turso 数据库执行 schema 变更
 * 用法: node scripts/migrate-prod.js
 */
require('dotenv').config();
const { createClient } = require('@libsql/client');

async function migrateProd() {
  // 使用生产数据库 URL（可通过环境变量覆盖）
  const dbUrl = process.env.PROD_TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL;
  const dbToken = process.env.PROD_TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;

  if (!dbUrl || !dbToken) {
    console.error('❌ 缺少生产数据库环境变量');
    console.error('请设置 PROD_TURSO_DATABASE_URL 和 PROD_TURSO_AUTH_TOKEN');
    console.error('或者 TURSO_DATABASE_URL 和 TURSO_AUTH_TOKEN');
    process.exit(1);
  }

  console.log(`🔗 连接生产数据库: ${dbUrl}`);

  const client = createClient({
    url: dbUrl,
    authToken: dbToken,
  });

  const migrations = [
    // Order 表 - 添加 deviceId 列
    {
      name: 'Add deviceId to Order',
      check: "SELECT COUNT(*) as cnt FROM pragma_table_info('Order') WHERE name='deviceId'",
      sql: "ALTER TABLE `Order` ADD COLUMN `deviceId` TEXT",
    },
    // TrialUsage 表 - 添加 deviceId 列
    {
      name: 'Add deviceId to TrialUsage',
      check: "SELECT COUNT(*) as cnt FROM pragma_table_info('TrialUsage') WHERE name='deviceId'",
      sql: "ALTER TABLE `TrialUsage` ADD COLUMN `deviceId` TEXT",
    },
    // Order 表 - 添加 trialOrderId 列
    {
      name: 'Add trialOrderId to Order',
      check: "SELECT COUNT(*) as cnt FROM pragma_table_info('Order') WHERE name='trialOrderId'",
      sql: "ALTER TABLE `Order` ADD COLUMN `trialOrderId` TEXT",
    },
    // Order 表 - 添加 selectedArtistStyle 列
    {
      name: 'Add selectedArtistStyle to Order',
      check: "SELECT COUNT(*) as cnt FROM pragma_table_info('Order') WHERE name='selectedArtistStyle'",
      sql: "ALTER TABLE `Order` ADD COLUMN `selectedArtistStyle` TEXT",
    },
    // Order 表 - 添加 coverImageUrl 列
    {
      name: 'Add coverImageUrl to Order',
      check: "SELECT COUNT(*) as cnt FROM pragma_table_info('Order') WHERE name='coverImageUrl'",
      sql: "ALTER TABLE `Order` ADD COLUMN `coverImageUrl` TEXT",
    },
    // Order 表 - 添加 duration 列
    {
      name: 'Add duration to Order',
      check: "SELECT COUNT(*) as cnt FROM pragma_table_info('Order') WHERE name='duration'",
      sql: "ALTER TABLE `Order` ADD COLUMN `duration` TEXT",
    },
  ];

  console.log('\n📋 开始迁移...\n');

  for (const migration of migrations) {
    try {
      // 检查列是否已存在
      const checkResult = await client.execute(migration.check);
      const count = checkResult.rows[0]?.cnt || 0;

      if (count > 0) {
        console.log(`⏭️  跳过: ${migration.name} (列已存在)`);
        continue;
      }

      // 执行迁移
      await client.execute(migration.sql);
      console.log(`✅ 完成: ${migration.name}`);
    } catch (error) {
      console.error(`❌ 失败: ${migration.name}`);
      console.error(`   错误: ${error.message}`);
      // 继续执行下一个迁移
    }
  }

  // 创建索引（如果不存在）
  const indexes = [
    {
      name: 'Order_deviceId_index',
      sql: 'CREATE INDEX IF NOT EXISTS `Order_deviceId_index` ON `Order`(`deviceId`)',
    },
    {
      name: 'TrialUsage_deviceId_index',
      sql: 'CREATE INDEX IF NOT EXISTS `TrialUsage_deviceId_index` ON `TrialUsage`(`deviceId`)',
    },
    {
      name: 'Order_trialOrderId_index',
      sql: 'CREATE INDEX IF NOT EXISTS `Order_trialOrderId_index` ON `Order`(`trialOrderId`)',
    },
  ];

  console.log('\n📋 创建索引...\n');

  for (const index of indexes) {
    try {
      await client.execute(index.sql);
      console.log(`✅ 索引: ${index.name}`);
    } catch (error) {
      console.error(`❌ 索引失败: ${index.name} - ${error.message}`);
    }
  }

  // 验证最终 schema
  console.log('\n📋 验证 Schema:\n');

  const tables = ['Order', 'TrialUsage'];
  for (const table of tables) {
    try {
      const cols = await client.execute(`PRAGMA table_info(${table})`);
      const colNames = cols.rows.map(r => r.name).join(', ');
      console.log(`📊 ${table}: ${colNames}`);
    } catch (error) {
      console.error(`❌ 无法读取 ${table} schema: ${error.message}`);
    }
  }

  client.close();
  console.log('\n✨ 迁移完成!');
}

migrateProd().catch(e => {
  console.error('迁移失败:', e);
  process.exit(1);
});
