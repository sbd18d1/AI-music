/**
 * 将静态配置中的 5 个新选项同步到数据库
 * 同时修正已有选项的 sortOrder，确保 audience 新增项在最前面
 */
require('dotenv').config();
const { createClient } = require('@libsql/client');
const crypto = require('crypto');
function uuid() {
  return crypto.randomUUID();
}

// 静态配置中的全部维度（用于排序参考）
const STATIC_CONFIG = {
  musicStyle: [
    'nashville_acoustic',
    'texas_honky_tonk',
    'west_coast_rock',
    'folk_revival_60s',
    'modern_acoustic_pop',  // NEW
    'upbeat_party_pop',     // NEW
  ],
  audience: [
    'partner',              // NEW (top)
    'parents',              // NEW (top)
    'adults',
    'toddler_lullaby',
    'playful_childhood',
    'campfire_singalong',
  ],
  vocalCharacter: [
    'deep_baritone',
    'golden_songstress',
    'velvet_crooner',
    'pure_folk_whisperer',
    'modern_duet',          // NEW
  ],
};

const NEW_OPTIONS = {
  musicStyle: [
    {
      optionId: 'modern_acoustic_pop',
      icon: '✨',
      name: 'Modern Acoustic Pop',
      description: 'Ed Sheeran style warm pop',
      styleTag: 'modern acoustic pop, warm polished production, fingerpicked acoustic guitar, intimate pop tempo',
      lyricInstruction: null,
      genreValue: 'Modern Pop',
      keywords: JSON.stringify(['modern acoustic pop', 'catchy guitar riff', 'upbeat acoustic groove', 'polished radio master', 'intimate pop tempo']),
    },
    {
      optionId: 'upbeat_party_pop',
      icon: '🎉',
      name: 'Upbeat Party Pop',
      description: 'Energetic & cheerful pop dance',
      styleTag: 'upbeat party pop, energetic danceable rhythm, bright synth pads, fun uplifting beat',
      lyricInstruction: null,
      genreValue: 'Modern Pop',
      keywords: JSON.stringify(['energetic pop', 'danceable rhythm', 'bright synth pads', 'fun uplifting beat', 'modern pop production']),
    },
  ],
  audience: [
    {
      optionId: 'partner',
      icon: '❤️',
      name: 'For My Partner / Spouse',
      description: 'Romantic love story',
      styleTag: 'intimate romantic delivery, emotional depth, passionate vocal phrasing',
      lyricInstruction: 'romantic themes, celebrating love story, shared memories, deep affection',
      genreValue: null,
      keywords: JSON.stringify(['intimate romantic delivery', 'emotional depth', 'passionate vocal phrasing']),
    },
    {
      optionId: 'parents',
      icon: '🏡',
      name: 'For Parents / Grandparents',
      description: 'Gratitude & nostalgia',
      styleTag: 'warm nostalgic delivery, honoring tone, heartfelt comforting resonance',
      lyricInstruction: 'themes of gratitude, wisdom, lifetime memories, family heritage and appreciation',
      genreValue: null,
      keywords: JSON.stringify(['warm nostalgic delivery', 'honoring tone', 'heartfelt comforting resonance']),
    },
  ],
  vocalCharacter: [
    {
      optionId: 'modern_duet',
      icon: '🎤',
      name: 'Harmonious Duet',
      description: 'Male & Female duet',
      styleTag: 'male and female vocal duet, blended vocal harmonies, intertwining chorus lines, dynamic emotional back-and-forth',
      lyricInstruction: null,
      genreValue: null,
      keywords: JSON.stringify(['male and female vocal duet', 'blended vocal harmonies', 'intertwining chorus lines', 'dynamic emotional back-and-forth']),
    },
  ],
};

async function syncDb() {
  const dbUrl = process.env.PROD_TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL;
  const dbToken = process.env.PROD_TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;

  if (!dbUrl || !dbToken) {
    console.error('❌ 缺少数据库环境变量');
    process.exit(1);
  }

  console.log(`🔗 连接数据库: ${dbUrl}\n`);
  const client = createClient({ url: dbUrl, authToken: dbToken });

  // 1. 获取各维度ID
  const dimsResult = await client.execute('SELECT "dimensionId", "id" as dimPk FROM "SongConfigDimension"');
  const dimMap = {};
  for (const row of dimsResult.rows) {
    dimMap[row.dimensionId] = row.dimPk;
  }
  console.log('维度ID映射:', dimMap);

  for (const [dimId, newOptions] of Object.entries(NEW_OPTIONS)) {
    const dimensionPk = dimMap[dimId];
    if (!dimensionPk) {
      console.error(`❌ 找不到维度: ${dimId}`);
      continue;
    }
    console.log(`\n📋 处理维度: ${dimId} (pk=${dimensionPk})`);

    // 2. 获取该维度下所有现有选项
    const existingResult = await client.execute(
      'SELECT "optionId" FROM "SongConfigOption" WHERE "dimensionId" = ?',
      [dimId]
    );
    const existingIds = existingResult.rows.map(r => r.optionId);

    // 3. 插入新选项
    for (const opt of newOptions) {
      if (existingIds.includes(opt.optionId)) {
        console.log(`  ⏭️  跳过: ${opt.optionId} (已存在)`);
        continue;
      }

      try {
        const now = new Date().toISOString();
        await client.execute({
          sql: `INSERT INTO "SongConfigOption" (
            "id", "optionId", "dimensionId", "icon", "name", "description",
            "styleTag", "lyricInstruction", "genreValue", "keywords", "sortOrder",
            "createdAt", "updatedAt"
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 999, ?, ?)`,
          args: [
            uuid(), opt.optionId, dimId, opt.icon, opt.name, opt.description,
            opt.styleTag, opt.lyricInstruction, opt.genreValue, opt.keywords,
            now, now
          ],
        });
        console.log(`  ✅ 插入: ${opt.optionId}`);
      } catch (e) {
        console.error(`  ❌ 插入失败 ${opt.optionId}:`, e.message);
      }
    }

    // 4. 按静态配置顺序重排 sortOrder
    console.log(`  🔄 重排 sortOrder...`);
    const orderList = STATIC_CONFIG[dimId];
    for (let i = 0; i < orderList.length; i++) {
      try {
        await client.execute(
          'UPDATE "SongConfigOption" SET "sortOrder" = ? WHERE "optionId" = ? AND "dimensionId" = ?',
          [i, orderList[i], dimId]
        );
      } catch (e) {
        console.log(`    ⚠️ ${orderList[i]} 未在数据库中找到`);
      }
    }

    // 5. 验证结果
    const verifyResult = await client.execute(
      'SELECT "optionId", "sortOrder", "name" FROM "SongConfigOption" WHERE "dimensionId" = ? ORDER BY "sortOrder"',
      [dimId]
    );
    console.log(`  📊 ${dimId} 最终顺序:`);
    for (const row of verifyResult.rows) {
      console.log(`     [${row.sortOrder}] ${row.optionId} - ${row.name}`);
    }
  }

  client.close();
  console.log('\n✨ 同步完成!');
}

syncDb().catch(e => {
  console.error('失败:', e);
  process.exit(1);
});
