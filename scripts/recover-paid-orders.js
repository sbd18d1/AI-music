/**
 * 恢复已付费但生成超时被误标 failed 的订单
 * ============================================
 * 背景：旧逻辑在 302 生成超过 5 分钟时会把已付款(已 capture)的订单置为 failed 并丢弃
 * 音频。本脚本扫描这类订单，若 302 任务实际已完成，就把音频+元数据写回并置 success。
 *
 * 用法: node scripts/recover-paid-orders.js
 *
 * 说明：
 * - 扫描 status='failed' 且 isFullVersion=true 且 paypalOrderId 非空 且 audioUrl 为空 的订单。
 * - 有 aiRequestId 的：用 302 fetch 查一次，若 SUCCESS 且有 audio_url，则写回。
 * - 无 aiRequestId（旧订单没存 taskId）：无法自动映射，仅打印提示，需人工处理。
 */
require('dotenv').config();
const { createClient } = require('@libsql/client');

const c = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const THREE02_KEY = process.env.THREE02_AI_KEY;
const BASE = 'https://api.302.ai';

async function fetchTask(taskId) {
  const r = await fetch(`${BASE}/suno/fetch/${taskId}?_t=${Date.now()}`, {
    headers: { Authorization: `Bearer ${THREE02_KEY}` },
  });
  if (!r.ok) return null;
  const j = await r.json();
  return j?.data?.data?.[0] || null;
}

function extractSong(task) {
  if (!task) return null;
  if (!task.audio_url) return null; // still generating / not done
  const meta = task.metadata || {};
  const inner = (Array.isArray(task.data) && task.data[0]?.metadata) || {};
  const lyrics =
    meta.gpt_description_prompt ||
    meta.prompt ||
    inner.gpt_description_prompt ||
    inner.prompt ||
    task.gpt_description_prompt ||
    task.prompt ||
    task.lyrics ||
    '';
  const duration = meta.duration || inner.duration || task.duration || 180;
  return {
    audioUrl: task.audio_url,
    title: task.title || null,
    coverImageUrl: task.image_url || task.image_large_url || null,
    lyrics: lyrics || null,
    duration: duration ? String(duration) : null,
  };
}

async function main() {
  console.log('Scanning for lost paid orders (failed + full version + paid, no audio)...');
  const r = await c.execute({
    sql: `SELECT id, "paypalOrderId", "aiRequestId", "recipientName", "createdAt"
          FROM "Order"
          WHERE status='failed' AND isFullVersion=1
            AND "paypalOrderId" IS NOT NULL AND "paypalOrderId" != ''
            AND ("audioUrl" IS NULL OR "audioUrl" = '')
          ORDER BY "createdAt" DESC`,
  });

  if (r.rows.length === 0) {
    console.log('No lost paid orders found. ✓');
    return;
  }

  for (const row of r.rows) {
    const id = String(row.id);
    const taskId = row.aiRequestId ? String(row.aiRequestId) : null;
    console.log(`\nOrder ${id.slice(0, 8)} | paypalOrderId=${String(row.paypalOrderId).slice(0, 14)} | aiRequestId=${taskId ? taskId.slice(0, 8) : '(none)'} | created=${String(row.createdAt).slice(0, 19)}`);

    if (!taskId) {
      console.log('  ⚠ No aiRequestId stored — cannot auto-map to a 302 task. Requires manual recovery.');
      continue;
    }

    const task = await fetchTask(taskId);
    const song = extractSong(task);
    if (!song) {
      console.log(`  Task ${taskId.slice(0, 8)} not complete yet (status=${task?.status || 'unknown'}). Skipped.`);
      continue;
    }

    const up = await c.execute({
      sql: `UPDATE "Order" SET status='success', "audioUrl"=?, title=?, lyrics=?, "coverImageUrl"=?, duration=?
            WHERE id=?`,
      args: [song.audioUrl, song.title, song.lyrics, song.coverImageUrl, song.duration, id],
    });
    console.log(`  ✓ Recovered: title=${song.title} | audio=${song.audioUrl.slice(0, 55)} | rows=${up.rowsAffected}`);
  }

  console.log('\nDone.');
  c.close();
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
