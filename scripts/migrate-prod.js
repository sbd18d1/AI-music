/**
 * 生产数据库完整迁移脚本
 * 对比 Prisma schema 和生产数据库，自动添加缺失的列和索引
 * 用法: node scripts/migrate-prod.js
 */
require('dotenv').config();
const { createClient } = require('@libsql/client');

// Prisma schema 中定义的所有列
const SCHEMA = {
  Order: {
    columns: [
      'id', 'recipientName', 'personality', 'genre', 'userEmail', 'customerEmail',
      'selectedStyle', 'selectedArtistStyle', 'songConfig', 'status',
      'paddleTransactionId', 'aiRequestId', 'audioUrl', 'lyrics', 'title',
      'coverImageUrl', 'duration', 'isFullVersion', 'ipAddress', 'deviceId',
      'trialOrderId', 'createdAt', 'updatedAt'
    ],
    columnTypes: {
      'id': 'TEXT PRIMARY KEY',
      'recipientName': 'TEXT NOT NULL',
      'personality': 'TEXT NOT NULL',
      'genre': 'TEXT NOT NULL',
      'userEmail': 'TEXT',
      'customerEmail': 'TEXT',
      'selectedStyle': 'TEXT',
      'selectedArtistStyle': 'TEXT',
      'songConfig': 'TEXT',
      'status': 'TEXT NOT NULL DEFAULT \'pending\'',
      'paddleTransactionId': 'TEXT',
      'aiRequestId': 'TEXT',
      'audioUrl': 'TEXT',
      'lyrics': 'TEXT',
      'title': 'TEXT',
      'coverImageUrl': 'TEXT',
      'duration': 'TEXT',
      'isFullVersion': 'BOOLEAN NOT NULL DEFAULT 0',
      'ipAddress': 'TEXT',
      'deviceId': 'TEXT',
      'trialOrderId': 'TEXT',
      'createdAt': 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP',
      'updatedAt': 'TEXT NOT NULL',
    },
    indexes: [
      'paddleTransactionId', 'aiRequestId', 'status', 'ipAddress', 'deviceId', 'trialOrderId'
    ]
  },
  TrialUsage: {
    columns: ['id', 'ipAddress', 'deviceId', 'usedAt'],
    columnTypes: {
      'id': 'TEXT PRIMARY KEY',
      'ipAddress': 'TEXT',
      'deviceId': 'TEXT',
      'usedAt': 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP',
    },
    indexes: ['ipAddress', 'deviceId', 'usedAt']
  }
};

async function migrateProd() {
  const dbUrl = process.env.PROD_TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL;
  const dbToken = process.env.PROD_TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;

  if (!dbUrl || !dbToken) {
    console.error('❌ 缺少生产数据库环境变量');
    process.exit(1);
  }

  console.log(`🔗 连接生产数据库: ${dbUrl}\n`);

  const client = createClient({
    url: dbUrl,
    authToken: dbToken,
  });

  for (const [tableName, schema] of Object.entries(SCHEMA)) {
    console.log(`📋 处理表: ${tableName}`);

    // 检查表是否存在
    let tableExists = false;
    try {
      const tableCheck = await client.execute({
        sql: "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        args: [tableName],
      });
      tableExists = tableCheck.rows.length > 0;
    } catch (e) {
      // ignore
    }

    if (!tableExists) {
      // 创建表
      const colDefs = schema.columns.map(c => `\`${c}\` ${schema.columnTypes[c]}`).join(', ');
      const createSql = `CREATE TABLE \`${tableName}\` (${colDefs})`;
      try {
        await client.execute(createSql);
        console.log(`  ✅ 创建表: ${tableName}`);
      } catch (e) {
        console.error(`  ❌ 创建表失败: ${tableName} - ${e.message}`);
        continue;
      }
    } else {
      // 获取现有列
      let existingCols = [];
      try {
        const colsResult = await client.execute(`PRAGMA table_info(\`${tableName}\`)`);
        existingCols = colsResult.rows.map(r => r.name);
      } catch (e) {
        console.error(`  ❌ 无法读取 ${tableName} 列信息: ${e.message}`);
        continue;
      }

      // 添加缺失的列
      for (const col of schema.columns) {
        if (!existingCols.includes(col)) {
          const colType = schema.columnTypes[col] || 'TEXT';
          try {
            await client.execute(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${col}\` ${colType}`);
            console.log(`  ✅ 添加列: ${tableName}.${col}`);
          } catch (e) {
            console.error(`  ❌ 添加列失败: ${tableName}.${col} - ${e.message}`);
          }
        } else {
          console.log(`  ⏭️  跳过: ${tableName}.${col} (已存在)`);
        }
      }
    }

    // 创建索引
    for (const col of schema.indexes) {
      const indexName = `${tableName}_${col}_index`;
      try {
        await client.execute(`CREATE INDEX IF NOT EXISTS \`${indexName}\` ON \`${tableName}\`(\`${col}\`)`);
        console.log(`  ✅ 索引: ${indexName}`);
      } catch (e) {
        console.error(`  ❌ 索引失败: ${indexName} - ${e.message}`);
      }
    }

    console.log('');
  }

  // 验证最终 schema
  console.log('📋 验证 Schema:\n');
  for (const tableName of Object.keys(SCHEMA)) {
    try {
      const cols = await client.execute(`PRAGMA table_info(\`${tableName}\`)`);
      const colNames = cols.rows.map(r => r.name).join(', ');
      console.log(`📊 ${tableName}: ${colNames}`);
    } catch (e) {
      console.error(`❌ 无法读取 ${tableName}: ${e.message}`);
    }
  }

  client.close();
  console.log('\n✨ 迁移完成!');
}

migrateProd().catch(e => {
  console.error('迁移失败:', e);
  process.exit(1);
});
