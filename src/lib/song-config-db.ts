import { createClient } from '@libsql/client';
import { SongConfigSelection } from './song-config';

export interface SongConfigOptionDb {
  id: string;
  icon: string;
  name: string;
  description: string;
  styleTag?: string;
  lyricInstruction?: string;
  genreValue?: string;
}

const getClient = () => createClient({ url: process.env.DATABASE_URL || '' });

export async function resolveSelectionFromDb(
  selection: SongConfigSelection
): Promise<{
  musicStyle?: SongConfigOptionDb;
  audience?: SongConfigOptionDb;
  vocalCharacter?: SongConfigOptionDb;
  emotionalVibe?: SongConfigOptionDb;
  occasion?: SongConfigOptionDb;
}> {
  const result: Record<string, SongConfigOptionDb | undefined> = {};
  const client = getClient();

  const dimensionIds = Object.keys(selection) as (keyof SongConfigSelection)[];

  for (const dimId of dimensionIds) {
    const optionId = selection[dimId];
    if (!optionId) continue;

    const resultOpt = await client.execute(
      'SELECT * FROM "SongConfigOption" WHERE "optionId" = ?',
      [optionId]
    );

    if (resultOpt.rows.length > 0) {
      const option = resultOpt.rows[0];
      result[dimId] = {
        id: option.optionId as string,
        icon: option.icon as string,
        name: option.name as string,
        description: option.description as string,
        styleTag: (option.styleTag as string) || undefined,
        lyricInstruction: (option.lyricInstruction as string) || undefined,
        genreValue: (option.genreValue as string) || undefined,
      };
    }
  }

  return result as {
    musicStyle?: SongConfigOptionDb;
    audience?: SongConfigOptionDb;
    vocalCharacter?: SongConfigOptionDb;
    emotionalVibe?: SongConfigOptionDb;
    occasion?: SongConfigOptionDb;
  };
}

export async function deriveGenreFromConfigDb(selection: SongConfigSelection): Promise<string> {
  const resolved = await resolveSelectionFromDb(selection);
  return resolved.musicStyle?.genreValue || 'Classic Rock';
}

export async function getAllDimensions(): Promise<{
  id: string;
  title: string;
  subtitle?: string;
  options: SongConfigOptionDb[];
}[]> {
  const client = getClient();
  
  const dimsResult = await client.execute(
    'SELECT * FROM "SongConfigDimension" ORDER BY "sortOrder"'
  );

  const result: Array<{
    id: string;
    title: string;
    subtitle?: string;
    options: SongConfigOptionDb[];
  }> = [];

  for (const dim of dimsResult.rows) {
    const optsResult = await client.execute(
      'SELECT * FROM "SongConfigOption" WHERE "dimensionId" = ? ORDER BY "sortOrder"',
      [dim.dimensionId]
    );
    
    result.push({
      id: dim.dimensionId as string,
      title: dim.title as string,
      subtitle: (dim.subtitle as string) || undefined,
      options: optsResult.rows.map((opt) => ({
        id: opt.optionId as string,
        icon: opt.icon as string,
        name: opt.name as string,
        description: opt.description as string,
        styleTag: (opt.styleTag as string) || undefined,
        lyricInstruction: (opt.lyricInstruction as string) || undefined,
        genreValue: (opt.genreValue as string) || undefined,
      })),
    });
  }

  return result;
}
