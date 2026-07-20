import 'dotenv/config';
import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.DATABASE_URL,
});

const dimensions = [
  {
    dimensionId: 'musicStyle',
    title: 'Music Style & Era',
    subtitle: 'Pick the vibe that feels like home',
    sortOrder: 1,
    options: [
      { optionId: 'nashville_acoustic', icon: '☕', name: '1970s Nashville Acoustic', description: 'Warm storytelling folk', styleTag: '1970s acoustic folk, warm analog master, gentle fingerpicked acoustic guitar, storytelling tempo', genreValue: 'Country & Folk', sortOrder: 1 },
      { optionId: 'texas_honky_tonk', icon: '🌵', name: 'Texas Roadside Honky-Tonk', description: 'Upbeat classic country', styleTag: 'upbeat classic country, slide guitar, honky-tonk piano, driving drum rhythm, vintage 1970s vinyl master', genreValue: 'Country & Folk', sortOrder: 2 },
      { optionId: 'west_coast_rock', icon: '🌊', name: 'West Coast Sunset Rock', description: 'Smooth 70s soft rock', styleTag: '1970s soft rock, smooth vocal harmonies, warm electric piano, nostalgic electric guitar solo', genreValue: 'Classic Rock', sortOrder: 3 },
      { optionId: 'folk_revival_60s', icon: '🎸', name: '1960s Folk Revival', description: 'Raw poetic protest folk', styleTag: '1960s protest folk, raw acoustic guitar strumming, poetic delivery, organic analog recording', genreValue: '60s/70s Pop Ballad', sortOrder: 4 },
    ],
  },
  {
    dimensionId: 'audience',
    title: 'Who Is This Song For?',
    subtitle: 'We will tune the lyrics and sound for them',
    sortOrder: 2,
    options: [
      { optionId: 'adults', icon: '👴', name: 'For Myself / Adults', description: 'Mature adult contemporary', styleTag: 'mature adult contemporary delivery', lyricInstruction: 'mature themes and storytelling', sortOrder: 1 },
      { optionId: 'toddler_lullaby', icon: '🌙', name: 'For Kids: Toddler Lullaby (0-3)', description: 'Soft bedtime magic', styleTag: 'magical glockenspiel, soft acoustic padding, peaceful bedtime vibe, Disney fairytale music arrangement style', lyricInstruction: 'simple words, soothing sounds, repetitive gentle phrases suitable for ages 0-3', sortOrder: 2 },
      { optionId: 'playful_childhood', icon: '🧸', name: 'For Kids: Playful Childhood (4-8)', description: 'Whimsical sing-along fun', styleTag: 'playful banjo picking, toe-tapping acoustic rhythm, whimsical and fun, kid-friendly storytelling', lyricInstruction: 'vivid imagery like catching fireflies, climbing trees, baking cookies; simple catchy words for ages 4-8', sortOrder: 3 },
      { optionId: 'campfire_singalong', icon: '🌳', name: 'For Kids: Campfire Sing-Along (9-12)', description: 'Bright adventure folk', styleTag: 'bright sing-along folk, uplifting acoustic guitar strumming, catchy rhythmic clapping, happy camping vibe', lyricInstruction: 'themes of friendship, adventure, independent growth; easy-to-remember chorus for ages 9-12', sortOrder: 4 },
    ],
  },
  {
    dimensionId: 'vocalCharacter',
    title: 'Vocal Character',
    subtitle: 'Choose the voice that tells your story',
    sortOrder: 3,
    options: [
      { optionId: 'deep_baritone', icon: '🤠', name: 'The Deep Baritone', description: 'Johnny Cash style', styleTag: 'deep gravelly baritone male vocal, speak-singing style, raw emotional delivery', sortOrder: 1 },
      { optionId: 'golden_songstress', icon: '🌾', name: 'The Golden Songstress', description: 'Dolly Parton style', styleTag: 'vintage female country vocal, sweet vibrato, high angelic tone, heartfelt delivery', sortOrder: 2 },
      { optionId: 'velvet_crooner', icon: '🕯️', name: 'The Velvet Crooner', description: 'Elvis style', styleTag: 'warm velvet romantic male vocal, smooth crooner style, rich vibrato', sortOrder: 3 },
      { optionId: 'pure_folk_whisperer', icon: '🕊️', name: 'The Pure Folk Whisperer', description: 'Karen Carpenter style', styleTag: 'clear soothing female folk vocal, soft vintage tone, warm and comforting', sortOrder: 4 },
    ],
  },
  {
    dimensionId: 'emotionalVibe',
    title: 'Emotional Vibe',
    subtitle: 'How should this song feel?',
    sortOrder: 4,
    options: [
      { optionId: 'tear_jerker', icon: '😭', name: 'The Tear-Jerker', description: 'Deeply nostalgic & melancholic', styleTag: 'deeply nostalgic, melancholic, slow burning intensity, poignant violin pads', lyricInstruction: 'deeply nostalgic and emotional tone, bittersweet memories', sortOrder: 1 },
      { optionId: 'heartwarming_sunny', icon: '☀️', name: 'Heartwarming & Sunny', description: 'Uplifting & cheerful', styleTag: 'uplifting, cheerful, heartwarming, bright major key', lyricInstruction: 'uplifting and cheerful tone, focus on joy and warmth', sortOrder: 2 },
      { optionId: 'peaceful_reflection', icon: '🌅', name: 'Peaceful Reflection', description: 'Tranquil & serene', styleTag: 'tranquil, serene, slow tempo, reflective, soft acoustic padding', lyricInstruction: 'tranquil and reflective tone, peaceful life moments', sortOrder: 3 },
    ],
  },
  {
    dimensionId: 'occasion',
    title: 'Occasion & Purpose',
    subtitle: 'What is the special moment?',
    sortOrder: 5,
    options: [
      { optionId: 'birthday', icon: '🎂', name: 'Birthday Celebration', description: 'Happy birthday theme', lyricInstruction: 'celebratory tone, happy birthday theme, make the recipient feel special', sortOrder: 1 },
      { optionId: 'anniversary', icon: '💍', name: 'Golden / Silver Anniversary', description: 'Everlasting love theme', lyricInstruction: 'romantic milestone anthem, everlasting love theme, celebrate years together', sortOrder: 2 },
      { optionId: 'christmas_holidays', icon: '🎄', name: 'Christmas & Holidays', description: 'Festive winter spirit', lyricInstruction: 'festive warmth, cozy winter holiday spirit, family gathering themes', sortOrder: 3 },
      { optionId: 'graduation', icon: '🎓', name: 'Graduation & New Journey', description: 'Proud & encouraging', lyricInstruction: 'proud and encouraging tone, future adventure theme, celebrate new beginnings', sortOrder: 4 },
      { optionId: 'everyday_love_note', icon: '💌', name: 'Everyday Love Note', description: 'No special reason', lyricInstruction: 'intimate, personal letter style, everyday moments of love', sortOrder: 5 },
    ],
  },
];

async function runSeed() {
  try {
    console.log('Connecting to Turso database...');
    await client.execute('SELECT 1');
    console.log('Connected successfully!');

    for (const dim of dimensions) {
      console.log(`Processing dimension: ${dim.dimensionId}`);

      const existingDim = await client.execute(
        'SELECT id FROM "SongConfigDimension" WHERE "dimensionId" = ?',
        [dim.dimensionId]
      );

      if (existingDim.rows.length > 0) {
        console.log(`Updating dimension: ${dim.dimensionId}`);
        await client.execute(
          'UPDATE "SongConfigDimension" SET "title" = ?, "subtitle" = ?, "sortOrder" = ? WHERE "dimensionId" = ?',
          [dim.title, dim.subtitle || null, dim.sortOrder, dim.dimensionId]
        );
      } else {
        console.log(`Creating dimension: ${dim.dimensionId}`);
        const now = new Date().toISOString();
          await client.execute(
            'INSERT INTO "SongConfigDimension" ("id", "dimensionId", "title", "subtitle", "sortOrder", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?)',
            [crypto.randomUUID(), dim.dimensionId, dim.title, dim.subtitle || null, dim.sortOrder, now, now]
          );
      }

      for (const opt of dim.options) {
        const existingOpt = await client.execute(
          'SELECT id FROM "SongConfigOption" WHERE "optionId" = ?',
          [opt.optionId]
        );

        if (existingOpt.rows.length > 0) {
          console.log(`Updating option: ${opt.optionId}`);
          await client.execute(
            'UPDATE "SongConfigOption" SET "icon" = ?, "name" = ?, "description" = ?, "styleTag" = ?, "lyricInstruction" = ?, "genreValue" = ?, "sortOrder" = ? WHERE "optionId" = ?',
            [opt.icon, opt.name, opt.description, opt.styleTag || null, opt.lyricInstruction || null, opt.genreValue || null, opt.sortOrder, opt.optionId]
          );
        } else {
          console.log(`Creating option: ${opt.optionId}`);
          const optNow = new Date().toISOString();
          await client.execute(
            'INSERT INTO "SongConfigOption" ("id", "optionId", "dimensionId", "icon", "name", "description", "styleTag", "lyricInstruction", "genreValue", "sortOrder", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [crypto.randomUUID(), opt.optionId, dim.dimensionId, opt.icon, opt.name, opt.description, opt.styleTag || null, opt.lyricInstruction || null, opt.genreValue || null, opt.sortOrder, optNow, optNow]
          );
        }
      }
    }

    const dimCount = await client.execute('SELECT COUNT(*) as count FROM "SongConfigDimension"');
    const optCount = await client.execute('SELECT COUNT(*) as count FROM "SongConfigOption"');
    console.log(`Seeding complete! ${dimCount.rows[0].count} dimensions, ${optCount.rows[0].count} options.`);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runSeed();
