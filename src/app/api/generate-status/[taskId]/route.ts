import { NextResponse } from 'next/server';
import { prisma } from '@/db/client';
import { checkResultOnce } from '@/lib/ai-music';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const maxDuration = 300;

export async function GET(
  request: Request,
  { params }: { params: { taskId: string } }
) {
  try {
    const taskId = params.taskId;

    const order = await prisma.order.findFirst({
      where: { aiRequestId: taskId },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    const isDev = process.env.NODE_ENV === 'development';

    // Helper: download audio and save locally (only works in self-hosted/dev environments with writable FS)
    // On Vercel, writes are not persisted, so falls back to proxying via stream-audio route.
    const downloadAndSaveAudio = async (audioUrl: string, orderId: string): Promise<string | null> => {
      try {
        // Skip writing on Vercel — filesystem is read-only and /tmp is not served
        if (process.env.VERCEL === '1' || process.env.NEXT_PUBLIC_VERCEL_ENV) {
          console.log(`[${new Date().toISOString()}] Vercel env detected, skipping local audio save`);
          return null;
        }

        const res = await fetch(audioUrl);
        if (!res.ok) return null;
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length < 100) return null; // invalid audio
        
        const audioDir = join(process.cwd(), 'public', 'audio');
        await mkdir(audioDir, { recursive: true });
        const fileName = `${orderId}.mp3`;
        const filePath = join(audioDir, fileName);
        await writeFile(filePath, buffer);
        
        console.log(`[${new Date().toISOString()}] Audio saved locally: ${filePath} (${buffer.length} bytes)`);
        return `/audio/${fileName}`;
      } catch (e) {
        console.error(`[${new Date().toISOString()}] Failed to save audio locally:`, e);
        return null;
      }
    };

    // Helper: resolve DB audioUrl to frontend URL
    // - local paths (/audio/xxx.mp3): served directly
    // - remote Suno URLs: proxied via /api/stream-audio/{orderId} (handles CORS + expiration)
    const frontendUrlFor = (orderId: string, audioUrl: string): string => {
      if (audioUrl.startsWith('/audio/')) return audioUrl;
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
    const result = await checkResultOnce(taskId);

    if (result.success && result.audioUrl) {
      // Try to download and save audio locally (only on self-hosted environments)
      // On Vercel, this is skipped and Suno URL is stored in DB; stream-audio proxies it.
      const localPath = await downloadAndSaveAudio(result.audioUrl, order.id);
      const finalAudioUrl = localPath || result.audioUrl;
      if (localPath) {
        console.log(`[${new Date().toISOString()}] Using local audio for order: ${order.id}`);
      } else {
        console.log(`[${new Date().toISOString()}] Saving Suno CDN URL to DB for order: ${order.id}`);
      }

      // Duration safety: result.duration already has 180s fallback from checkResultOnce,
      // but guard here too so DB and response always have a valid number string.
      const durResultStr = result.duration;
      const durResultNum = durResultStr ? parseFloat(durResultStr) : NaN;
      const safeDuration = (isFinite(durResultNum) && durResultNum > 0) ? String(durResultNum) : '180';

      // Save to DB
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
    return NextResponse.json({
      success: true,
      status: 'generating',
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Status check error:`, error);
    return NextResponse.json({
      success: true,
      status: 'generating',
    });
  }
}