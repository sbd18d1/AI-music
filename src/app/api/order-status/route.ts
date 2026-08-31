import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/db/client';
import { checkResultOnce } from '@/lib/ai-music';
import { ensureOrderEmailColumn } from '@/lib/ensure-coupon-table';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const maxDuration = 60;

// GET: Poll order status.
// - A 'processing' order with an aiRequestId is re-checked against 302.ai once here
//   (not looped — the frontend already polls every 3s). This is how a slow 302
//   generation (6-8+ min) eventually flips to success instead of timing out into a
//   permanent 'failed'; the customer has already paid by this point.
export async function GET(request: NextRequest) {
  try {
    await ensureOrderEmailColumn();
    const urlParams = new URLSearchParams(request.url.split('?')[1]);
    const orderId = urlParams.get('order_id');

    if (!orderId) {
      return NextResponse.json(
        { error: 'Missing order_id parameter' },
        { status: 400 }
      );
    }

    let order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    console.log(`[${new Date().toISOString()}] GET order-status for ${orderId}: status=${order?.status}, paymentOrderId=${order?.paymentOrderId}`);

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // If still processing and we have a 302 task id, ask 302 once whether it's done.
    if (order.status === 'processing' && order.aiRequestId) {
      const taskId = order.aiRequestId;
      const pollT0 = Date.now();
      const result = await checkResultOnce(taskId);
      console.log(`[${new Date().toISOString()}] Re-check 302 task ${taskId}: success=${result.success}, hasAudio=${!!result.audioUrl}, took=${Date.now() - pollT0}ms`);

      if (result.success && result.audioUrl) {
        order = await prisma.order.update({
          where: { id: orderId },
          data: {
            status: 'success',
            audioUrl: result.audioUrl,
            lyrics: result.lyrics || null,
            title: result.title || null,
            coverImageUrl: result.coverImageUrl || null,
            duration: result.duration || null,
          },
        });
        console.log(`[${new Date().toISOString()}] Order ${orderId} flipped to success (delivered late)`);
      } else if (result.error) {
        // 302 reported a real failure for this task.
        order = await prisma.order.update({
          where: { id: orderId },
          data: { status: 'failed' },
        });
        console.error(`[${new Date().toISOString()}] Order ${orderId} marked failed, 302 task ${taskId} errored:`, result.error);
      }
      // else: still generating — leave status 'processing', frontend keeps polling.
    }

    // Resolve DB audioUrl to a frontend-playable URL, matching generate-status:
    // - local paths (/audio/xxx.mp3): served directly
    // - remote http(s) URLs: use directly — <audio> is not subject to CORS, and
    //   proxying via /api/stream-audio adds latency (and crashed the dev jest-worker).
    // - anything else: fall back to the streaming proxy.
    const audioUrlForFrontend = order.audioUrl
      ? (order.audioUrl.startsWith('/audio/')
          ? order.audioUrl
          : (order.audioUrl.startsWith('http://') || order.audioUrl.startsWith('https://')
              ? order.audioUrl
              : `/api/stream-audio/${order.id}`))
      : null;

    return NextResponse.json({
      success: true,
      _debugTs: Date.now(),
      order: {
        id: order.id,
        recipientName: order.recipientName,
        genre: order.genre,
        status: order.status,
        audioUrl: audioUrlForFrontend,
        lyrics: order.lyrics,
        title: order.title,
        coverImageUrl: order.coverImageUrl,
        duration: order.duration,
        customerEmail: order.customerEmail,
        emailSent: !!order.emailSentAt,
        createdAt: order.createdAt.toISOString(),
      },
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      },
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Order status error:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch order status' },
      { status: 500 }
    );
  }
}
