import { NextResponse } from 'next/server';
import { prisma } from '@/db/client';
import { checkResultOnce } from '@/lib/ai-music';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const maxDuration = 300;

export async function GET(
  request: Request,
  { params }: { params: { taskId: string } }
) {
  const t0 = Date.now();
  const reqId = `[${new Date().toISOString()}] [status:${request.headers.get('x-vercel-id') || 'local'}]`;
  try {
    const taskId = params.taskId;
    console.log(`${reqId} === generate-status START taskId=${taskId} ===`);

    const t1 = Date.now();
    const order = await prisma.order.findFirst({
      where: { aiRequestId: taskId },
    });
    console.log(`${reqId} DB findFirst: ${Date.now() - t1}ms, order.status=${order?.status || 'not found'}`);

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    const isDev = process.env.NODE_ENV === 'development';

    // Helper: resolve DB audioUrl to frontend URL
    // - local paths (/audio/xxx.mp3): served directly
    // - remote URLs (http/https): use directly — <audio> tag is not subject to CORS,
    //   and Vercel serverless functions buffer the entire response body, causing
    //   ~1 minute playback delay when proxying large MP3 files.
    const frontendUrlFor = (orderId: string, audioUrl: string): string => {
      if (audioUrl.startsWith('/audio/')) return audioUrl;
      if (audioUrl.startsWith('http://') || audioUrl.startsWith('https://')) return audioUrl;
      return `/api/stream-audio/${orderId}`;
    };

    // If already completed in DB, return immediately
    if (order.status === 'success' && order.audioUrl) {
      // Duration: use DB value, fallback to 180s if missing so UI never shows 0:00
      const durStr = order.duration;
      const durNum = durStr ? parseFloat(durStr) : NaN;
      const safeDuration = (isFinite(durNum) && durNum > 0) ? durStr : '180';

      return NextResponse.json({
        success: true,
        status: 'completed',
        audioUrl: frontendUrlFor(order.id, order.audioUrl),
        orderId: order.id,
        isPreview: !order.isFullVersion,
        lyrics: order.lyrics || '',
        title: order.title || '',
        coverImageUrl: order.coverImageUrl || '',
        duration: safeDuration,
      });
    }

    if (order.status === 'failed') {
      return NextResponse.json({
        success: true,
        status: 'failed',
        error: 'Generation failed',
      });
    }

    // Do a SINGLE check of 302.ai (no internal loop) and return immediately.
    // The frontend polling loop controls retry timing.
    const t2 = Date.now();
    const result = await checkResultOnce(taskId);
    console.log(`${reqId} checkResultOnce: ${Date.now() - t2}ms, success=${result.success}, hasAudio=${!!result.audioUrl}`);

    if (result.success && result.audioUrl) {
      // On Vercel (serverless), downloading the full MP3 to /public/audio/ is useless
      // (filesystem is ephemeral) and adds ~30-60s delay waiting for the full download.
      // stream-audio route already proxies the Suno CDN URL with streaming, so we skip
      // the download entirely and store the remote URL directly.
      const finalAudioUrl = result.audioUrl;

      // Duration safety: result.duration already has 180s fallback from checkResultOnce,
      // but guard here too so DB and response always have a valid number string.
      const durResultStr = result.duration;
      const durResultNum = durResultStr ? parseFloat(durResultStr) : NaN;
      const safeDuration = (isFinite(durResultNum) && durResultNum > 0) ? String(durResultNum) : '180';

      // Save to DB
      const t3 = Date.now();
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'success',
          audioUrl: finalAudioUrl,
          lyrics: result.lyrics || null,
          title: result.title || null,
          coverImageUrl: result.coverImageUrl || null,
          duration: safeDuration,
        },
      });
      console.log(`${reqId} DB update: ${Date.now() - t3}ms`);
      console.log(`${reqId} === COMPLETED total=${Date.now() - t0}ms ===`);

      return NextResponse.json({
        success: true,
        status: 'completed',
        audioUrl: frontendUrlFor(order.id, finalAudioUrl),
        orderId: order.id,
        isPreview: !order.isFullVersion,
        lyrics: result.lyrics || '',
        title: result.title || '',
        coverImageUrl: result.coverImageUrl || '',
        duration: safeDuration,
      });
    }

    if (result.error) {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'failed' },
      });

      return NextResponse.json({
        success: true,
        status: 'failed',
        error: result.error,
      });
    }

    // Still generating — frontend will poll again
    console.log(`${reqId} === still generating, total=${Date.now() - t0}ms ===`);
    return NextResponse.json({
      success: true,
      status: 'generating',
    });
  } catch (error) {
    console.error(`${reqId} Status check error after ${Date.now() - t0}ms:`, error);
    return NextResponse.json({
      success: true,
      status: 'generating',
    });
  }
}