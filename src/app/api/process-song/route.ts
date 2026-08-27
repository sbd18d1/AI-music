import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/db/client';
import { sendSongEmail } from '@/lib/email';
import { generateSong } from '@/lib/ai-music';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json(
        { error: 'Missing orderId' },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    if (order.status !== 'processing') {
      return NextResponse.json(
        { error: 'Order is not in processing state' },
        { status: 400 }
      );
    }

    const aiResponse = await generateSong({
      recipientName: order.recipientName,
      personality: order.personality,
      genre: order.genre,
      isPreview: false,
    });

    if (aiResponse.success && aiResponse.audioUrl) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'success',
          audioUrl: aiResponse.audioUrl,
          aiRequestId: aiResponse.requestId,
        },
      });

      const streamUrl = `/api/stream-audio/${order.id}`;

      if (order.userEmail) {
        const sendResult = await sendSongEmail({
          email: order.userEmail,
          recipientName: order.recipientName,
          audioUrl: streamUrl,
        });
        if (!sendResult.ok) {
          console.error(`[${new Date().toISOString()}] process-song email FAILED to ${order.userEmail}: ${sendResult.error}`);
        }
      }

      return NextResponse.json({ success: true });
    } else {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'failed',
          aiRequestId: aiResponse.requestId,
        },
      });

      return NextResponse.json(
        { success: false, error: aiResponse.error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Process song error:', error);

    const body = await request.json().catch(() => ({}));
    if (body.orderId) {
      await prisma.order.update({
        where: { id: body.orderId },
        data: { status: 'failed' },
      }).catch(() => {});
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
