/**
 * 添加 keywords 列到 SongConfigOption 表
 */
require('dotenv').config();
const { createClient } = require('@libsql/client');

async function addKeywordsColumn() {
  const dbUrl = process.env.PROD_TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL;
  const dbToken = process.env.PROD_TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;

  if (!dbUrl || !dbToken) {
    console.error('❌ 缺少数据库环境变量');
    process.exit(1);
  }

  console.log(`🔗 连接数据库: ${dbUrl}`);
  const client = createClient({ url: dbUrl, authToken: dbToken });

  try {
    await client.execute('ALTER TABLE "SongConfigOption" ADD COLUMN "keywords" TEXT');
    console.log('✅ keywords 列添加成功');
  } catch (e) {
    if (e.message.includes('duplicate column')) {
      console.log('⏭️  keywords 列已存在');
    } else {
      console.error('❌ 添加失败:', e.message);
    }
  }

  // 验证
  const cols = await client.execute('PRAGMA table_info("SongConfigOption")');
  const colNames = cols.rows.map(r => r.name).join(', ');
  console.log(`📊 SongConfigOption 列: ${colNames}`);

  client.close();
}

addKeywordsColumn().catch(e => {
  console.error('失败:', e);
  process.exit(1);
});
