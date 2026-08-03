import { NextResponse } from 'next/server';
import { prisma } from '@/db/client';
import { checkResultOnce } from '@/lib/ai-music';

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

    // If already completed in DB, return immediately
    if (order.status === 'success' && order.audioUrl) {
      const isDev = process.env.NODE_ENV === 'development';
      return NextResponse.json({
        success: true,
        status: 'completed',
        audioUrl: isDev ? order.audioUrl : `/api/stream-audio/${order.id}`,
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
      // Save remote URL to DB; frontend uses /api/stream-audio for playback
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'success',
          audioUrl: result.audioUrl,
          lyrics: result.lyrics || null,
          title: result.title || null,
          coverImageUrl: result.coverImageUrl || null,
          duration: result.duration || null,
        },
      });

      // In development, return remote URL directly (browser uses VPN proxy).
      // In production (Vercel), use stream-audio proxy (server can access remote directly).
      const isDev = process.env.NODE_ENV === 'development';
      const audioUrlForFrontend = isDev ? result.audioUrl : `/api/stream-audio/${order.id}`;
      return NextResponse.json({
        success: true,
        status: 'completed',
        audioUrl: audioUrlForFrontend,
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