import { tursoClient } from '@/lib/turso-client';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const client = tursoClient;
    
    const dimsResult = await client.execute(
      'SELECT * FROM "SongConfigDimension" ORDER BY "sortOrder"'
    );
    
    const result: Array<{
      id: string;
      title: string;
      subtitle?: string;
      options: Array<{
        id: string;
        icon: string;
        name: string;
        description: string;
        styleTag?: string;
        lyricInstruction?: string;
        genreValue?: string;
      }>;
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

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to fetch song config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch song config' },
      { status: 500 }
    );
  }
}
