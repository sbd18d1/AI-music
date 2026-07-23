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
      return NextResponse.json({
        success: true,
        status: 'completed',
        audioUrl: order.audioUrl,
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

      return NextResponse.json({
        success: true,
        status: 'completed',
        audioUrl: result.audioUrl,
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