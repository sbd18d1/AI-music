import { NextResponse } from 'next/server';
import { prisma } from '@/db/client';
import { checkResultOnce } from '@/lib/ai-music';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

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

    // Helper: download audio from URL and save to local file system
    const downloadAndSaveAudio = async (audioUrl: string, orderId: string): Promise<string | null> => {
      try {
        const res = await fetch(audioUrl);
        if (!res.ok) return null;
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length < 100) return null; // invalid audio
        
        // Save to public/audio/ directory
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

    // If already completed in DB, return immediately
    if (order.status === 'success' && order.audioUrl) {
      return NextResponse.json({
        success: true,
        status: 'completed',
        audioUrl: order.audioUrl.startsWith('/audio/') 
          ? order.audioUrl 
          : (isDev ? order.audioUrl : `/api/stream-audio/${order.id}`),
        orderId: order.id,
        isPreview: !order.isFullVersion,
        lyrics: order.lyrics || '',
        title: order.title || '',
        coverImageUrl: order.coverImageUrl || '',
        duration: order.duration || '',
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
      // Try to download and save audio locally (to avoid Suno URL expiration)
      let finalAudioUrl = result.audioUrl;
      const localPath = await downloadAndSaveAudio(result.audioUrl, order.id);
      if (localPath) {
        finalAudioUrl = localPath;
        console.log(`[${new Date().toISOString()}] Using local audio for order: ${order.id}`);
      } else {
        console.log(`[${new Date().toISOString()}] Local save failed, using remote URL for order: ${order.id}`);
      }

      // Save to DB
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'success',
          audioUrl: finalAudioUrl,
          lyrics: result.lyrics || null,
          title: result.title || null,
          coverImageUrl: result.coverImageUrl || null,
          duration: result.duration || null,
        },
      });

      // Return local path if available, otherwise remote URL
      const frontendUrl = localPath 
        ? localPath  // local file, always valid
        : (isDev ? result.audioUrl : `/api/stream-audio/${order.id}`);

      return NextResponse.json({
        success: true,
        status: 'completed',
        audioUrl: frontendUrl,
        orderId: order.id,
        isPreview: !order.isFullVersion,
        lyrics: result.lyrics || '',
        title: result.title || '',
        coverImageUrl: result.coverImageUrl || '',
        duration: result.duration || '',
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