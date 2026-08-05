import { tursoClient } from '@/lib/turso-client';
import { NextResponse } from 'next/server';

// 禁用静态缓存，确保每次请求都从数据库获取最新数据
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

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
        options: optsResult.rows.map((opt) => {
          let keywords: string[] | undefined;
          if (opt.keywords) {
            try {
              keywords = typeof opt.keywords === 'string' 
                ? JSON.parse(opt.keywords) 
                : opt.keywords as string[];
            } catch {
              keywords = undefined;
            }
          }
          return {
            id: opt.optionId as string,
            icon: opt.icon as string,
            name: opt.name as string,
            description: opt.description as string,
            styleTag: (opt.styleTag as string) || undefined,
            lyricInstruction: (opt.lyricInstruction as string) || undefined,
            genreValue: (opt.genreValue as string) || undefined,
            keywords,
          };
        }),
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
