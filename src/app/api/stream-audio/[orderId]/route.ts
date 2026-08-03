import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/db/client';
import fs from 'fs';
import path from 'path';

/**
 * Stream audio by orderId.
 *
 * Strategy:
 * 1. If a local file exists at /generated/{orderId}.mp3 (self-hosted), stream it directly.
 * 2. Otherwise, proxy the remote audio URL from the database (Vercel / read-only FS).
 * 3. Supports HTTP Range requests for audio seeking.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const orderId = params.orderId;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { audioUrl: true },
  });

  if (!order || !order.audioUrl) {
    return NextResponse.json({ error: 'Audio not found' }, { status: 404 });
  }

  const audioUrl = order.audioUrl;

  // 1. Try local file first (self-hosted environments)
  if (audioUrl.startsWith('/') && !audioUrl.startsWith('//')) {
    const filePath = path.join(process.cwd(), 'public', audioUrl);
    if (fs.existsSync(filePath)) {
      return streamLocalFile(filePath, request);
    }
  }

  // 2. Proxy remote URL (Vercel / read-only FS)
  return proxyRemoteAudio(audioUrl, request);
}

/** Stream a local file with Range support */
function streamLocalFile(filePath: string, request: NextRequest) {
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = request.headers.get('range');

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    const stream = fs.createReadStream(filePath, { start, end });
    return new NextResponse(stream as unknown as ReadableStream, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize.toString(),
        'Content-Type': 'audio/mpeg',
      },
    });
  }

  const stream = fs.createReadStream(filePath);
  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      'Content-Length': fileSize.toString(),
      'Content-Type': 'audio/mpeg',
      'Accept-Ranges': 'bytes',
    },
  });
}

/** Proxy a remote audio URL with Range support.
 *  Downloads the full audio as a Buffer first to ensure Content-Length is available,
 *  which is required by many browsers for <audio> element playback.
 */
async function proxyRemoteAudio(remoteUrl: string, request: NextRequest) {
  try {
    console.log(`[stream-audio] Fetching remote: ${remoteUrl}`);
    const response = await fetch(remoteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'audio/mpeg, audio/*;q=0.9, */*;q=0.8',
      },
    });

    if (!response.ok) {
      console.error(`[stream-audio] Remote fetch failed: ${response.status} for ${remoteUrl}`);
      return NextResponse.json(
        { error: 'Audio file is no longer available' },
        { status: 502 }
      );
    }

    // Download full audio as Buffer to get Content-Length
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileSize = buffer.length;
    console.log(`[stream-audio] Downloaded ${fileSize} bytes, arrayBuffer byteLength: ${arrayBuffer.byteLength}`);

    if (fileSize === 0) {
      console.error(`[stream-audio] Empty audio buffer from ${remoteUrl}`);
      return NextResponse.json(
        { error: 'Audio file is empty' },
        { status: 502 }
      );
    }

    const range = request.headers.get('range');

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      const chunk = buffer.subarray(start, end + 1);

      return new NextResponse(chunk as unknown as ReadableStream, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize.toString(),
          'Content-Type': 'audio/mpeg',
        },
      });
    }

    return new NextResponse(buffer as unknown as ReadableStream, {
      status: 200,
      headers: {
        'Content-Length': fileSize.toString(),
        'Content-Type': 'audio/mpeg',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('[stream-audio] Proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to stream audio' },
      { status: 500 }
    );
  }
}
