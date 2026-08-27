/**
 * One-time sync: write prisma/config-export.json into the SongConfigDimension /
 * SongConfigOption tables (the data-driven source of truth for the UI + prompts).
 *
 * Runs against whichever Turso DB the env points to. For production, set
 * TURSO_DATABASE_URL + TURSO_AUTH_TOKEN to the PRODUCTION Turso credentials
 * (NOT the local dev DB). This DELETES existing dimension/option rows and re-inserts.
 *
 * Dimension-id mapping: the config uses key `genre` for the first dimension, but the
 * app's SongConfigSelection interface key is `musicStyle`, so we store dimensionId
 * `musicStyle` (title/content still come from the config's `genre` block).
 * Icons are not in the config, so we assign sensible emoji here (editable in DB).
 */
import { createClient } from '@libsql/client';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import 'dotenv/config';

interface ConfigOpt {
  optionId: string;
  name: string;
  description: string;
  styleTag?: string | null;
  lyricInstruction?: string | null;
  keywords?: string[] | string | null;
  genreValue?: string | null;
}
interface ConfigDim {
  title: string;
  options: ConfigOpt[];
}
type Config = Record<string, ConfigDim>;

const DIM_ID_MAP: Record<string, string> = {
  genre: 'musicStyle',      // config key -> app dimensionId
  vocalCharacter: 'vocalCharacter',
  audience: 'audience',
  emotionalVibe: 'emotionalVibe',
  occasion: 'occasion',
};

const ICONS: Record<string, string> = {
  // genre / musicStyle
  classic_country: '🎸', classic_rock: '🎸', vintage_pop_ballad: '🎹',
  gospel_soul: '🎶', jazz_crooner_swing: '🎷', upbeat_rockabilly: '💃',
  // vocalCharacter
  warm_baritone_male: '🎤', sweet_vintage_female: '🌸', smooth_crooner_male: '🕯️',
  harmonious_duet: '🎤', children_choir: '👧',
  // audience
  spouse_partner: '💖', grandkids_kids: '🧒', parents_grandparents: '🏡', dear_friend: '🤝',
  // emotionalVibe
  tear_jerker_nostalgic: '😭', joyful_sunny: '☀️', peaceful_serene: '🌅',
  // occasion
  anniversary: '💍', birthday: '🎂', retirement_tribute: '🎉', holidays_christmas: '🎄', just_because: '💌',
};

function getClient() {
  const url = (process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL)?.split('?')[0];
  const token = process.env.TURSO_AUTH_TOKEN ||
    (() => { const m = (process.env.DATABASE_URL || '').match(/[?&]authToken=([^&]+)/); return m?.[1]; })();
  if (!url) throw new Error('TURSO_DATABASE_URL is required');
  return createClient({ url, authToken: token });
}

async function main() {
  const cfg: Config = JSON.parse(readFileSync(join(process.cwd(), 'prisma', 'config-export.json'), 'utf8'));

  const client = getClient();
  console.log('Syncing song config to:', (process.env.TURSO_DATABASE_URL || '').split('?')[0]);

  // Wipe old dimension + option rows (clean replace).
  await client.execute(`DELETE FROM "SongConfigOption"`);
  await client.execute(`DELETE FROM "SongConfigDimension"`);
  console.log('Cleared existing rows.');

  let dimOrder = 1;
  for (const [configKey, dim] of Object.entries(cfg)) {
    const dimId = DIM_ID_MAP[configKey] || configKey;
    const now = new Date().toISOString();
    await client.execute({
      sql: `INSERT INTO "SongConfigDimension" ("id","dimensionId","title","subtitle","sortOrder","createdAt","updatedAt") VALUES (?,?,?,?,?,?,?)`,
      args: [randomUUID(), dimId, dim.title, '', dimOrder, now, now],
    });
    let optOrder = 0;
    for (const opt of dim.options) {
      let keywords: string | null = null;
      if (opt.keywords) {
        if (Array.isArray(opt.keywords)) keywords = JSON.stringify(opt.keywords);
        else keywords = JSON.stringify([opt.keywords]);
      }
      await client.execute({
        sql: `INSERT INTO "SongConfigOption"
              ("id","optionId","dimensionId","icon","name","description","styleTag","lyricInstruction","genreValue","keywords","sortOrder","createdAt","updatedAt")
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        args: [
          randomUUID(), opt.optionId, dimId, ICONS[opt.optionId] || '🎵', opt.name, opt.description,
          opt.styleTag || null, opt.lyricInstruction || null, opt.genreValue || null,
          keywords, optOrder, now, now,
        ],
      });
      optOrder++;
    }
    console.log(`  dim ${dimId} (${dimOrder}) ← config key "${configKey}", ${dim.options.length} options.`);
    dimOrder++;
  }

  // Verify
  const dims = await client.execute(`SELECT "dimensionId","title","sortOrder" FROM "SongConfigDimension" ORDER BY "sortOrder"`);
  const opts = await client.execute(`SELECT COUNT(*) AS n FROM "SongConfigOption"`);
  console.log('Dimensions:', JSON.stringify(dims.rows));
  console.log('Option count:', (opts.rows[0] as any).n);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e.message || e); process.exit(1); });
