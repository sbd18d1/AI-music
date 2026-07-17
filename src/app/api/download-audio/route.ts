import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const audioUrl = searchParams.get('url');
  const filename = searchParams.get('filename') || 'song';

  if (!audioUrl) {
    return NextResponse.json({ error: 'Missing audio URL' }, { status: 400 });
  }

  try {
    // 处理本地文件路径（以 / 开头的相对路径）
    if (audioUrl.startsWith('/') && !audioUrl.startsWith('//')) {
      const filePath = path.join(process.cwd(), 'public', audioUrl);
      if (fs.existsSync(filePath)) {
        const buffer = fs.readFileSync(filePath);
        console.log(`[${new Date().toISOString()}] Local file download: ${buffer.byteLength} bytes`);
        return new NextResponse(buffer, {
          headers: {
            'Content-Type': 'audio/mpeg',
            'Content-Disposition': `attachment; filename="${filename}.mp3"`,
            'Content-Length': buffer.byteLength.toString(),
          },
        });
      }
    }

    // 处理远程 URL
    const fullUrl = audioUrl.startsWith('/')
      ? `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}${audioUrl}`
      : audioUrl;

    const response = await fetch(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'audio/mpeg, audio/*;q=0.9, */*;q=0.8',
      },
    });

    if (!response.ok) {
      console.error(`[${new Date().toISOString()}] Fetch failed: ${response.status}`);
      return NextResponse.json({ error: 'Failed to fetch audio' }, { status: 500 });
    }

    const blob = await response.blob();
    const buffer = await blob.arrayBuffer();

    console.log(`[${new Date().toISOString()}] Download successful: ${buffer.byteLength} bytes`);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': `attachment; filename="${filename}.mp3"`,
        'Content-Length': buffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Download failed:`, error);
    // 如果是本地路径，直接重定向让浏览器处理
    if (audioUrl.startsWith('/')) {
      return NextResponse.redirect(audioUrl);
    }
    return NextResponse.json({ error: 'Download failed' }, { status: 500 });
  }
}
