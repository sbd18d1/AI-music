import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/db/client';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const maxDuration = 300;

/**
 * Stream audio by orderId.
 *
 * Strategy:
 * 1. If local cached file exists at public/audio/{orderId}.mp3, stream it directly.
 * 2. If DB audioUrl is a local path (/audio/...), stream it directly.
 * 3. Otherwise, proxy the remote audio URL from the database, and cache it locally for future use.
 * 4. Supports HTTP Range requests for audio seeking.
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

  // 1. If DB has a local path (/test-song.mp3 etc), serve it directly
  if (audioUrl.startsWith('/') && !audioUrl.startsWith('//')) {
    const filePath = path.join(process.cwd(), 'public', audioUrl);
    if (fs.existsSync(filePath)) {
      console.log(`[stream-audio] Serving local file: ${filePath}`);
      return streamLocalFile(filePath, request);
    }
  }

  // 2. Proxy remote URL
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
 *
 *  Streams the audio directly from Suno CDN to the browser WITHOUT buffering
 *  the entire file into memory. The browser's Range header is forwarded to
 *  the CDN so that playback can start immediately and seeking works.
 *
 *  Previous implementation used `await response.arrayBuffer()` which downloaded
 *  the whole MP3 (3-5MB) to the Vercel server before sending any bytes to the
 *  browser — this caused ~1 minute playback delay.
 */
async function proxyRemoteAudio(remoteUrl: string, request: NextRequest) {
  try {
    const range = request.headers.get('range');
    console.log(`[stream-audio] Fetching remote: ${remoteUrl} (range: ${range || 'none'})`);

    // Forward the Range header to Suno CDN so it returns a 206 partial response
    const fetchHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'audio/mpeg, audio/*;q=0.9, */*;q=0.8',
    };
    if (range) {
      fetchHeaders['Range'] = range;
    }

    const response = await fetch(remoteUrl, { headers: fetchHeaders });

    // 200 = full file, 206 = partial (Range satisfied), both are OK
    if (!response.ok && response.status !== 206) {
      console.error(`[stream-audio] Remote fetch failed: ${response.status} for ${remoteUrl}`);
      return NextResponse.json(
        { error: 'Audio file is no longer available. Please regenerate.' },
        { status: 410 }  // Gone - resource no longer available
      );
    }

    // Build response headers by transparently forwarding CDN headers
    const responseHeaders: Record<string, string> = {
      'Content-Type': response.headers.get('content-type') || 'audio/mpeg',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=86400',
    };

    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      responseHeaders['Content-Length'] = contentLength;
      // Detect expired/invalid audio (too small to be a real MP3)
      if (parseInt(contentLength, 10) < 100) {
        console.error(`[stream-audio] Audio too small (${contentLength} bytes), likely expired URL: ${remoteUrl}`);
        return NextResponse.json(
          { error: 'Audio file has expired. Please generate a new song.' },
          { status: 410 }
        );
      }
    }

    const contentRange = response.headers.get('content-range');
    if (contentRange) {
      responseHeaders['Content-Range'] = contentRange;
    }

    console.log(`[stream-audio] Streaming ${response.status} to client, contentLength: ${contentLength || 'unknown'}`);

    // Stream the response body directly to the browser without buffering.
    // This lets the <audio> element start playback as soon as the first bytes arrive.
    return new NextResponse(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('[stream-audio] Proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to stream audio' },
      { status: 500 }
    );
  }
}
