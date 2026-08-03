import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/db/client';

export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, paddleTransactionId } = body;

    if (!orderId || !paddleTransactionId) {
      return NextResponse.json(
        { error: 'Missing orderId or paddleTransactionId' },
        { status: 400 }
      );
    }

    const order = await prisma.order.update({
      where: { id: orderId },
      data: { paddleTransactionId },
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      paddleTransactionId: order.paddleTransactionId,
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Update order status error:`, error);
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const urlParams = new URLSearchParams(request.url.split('?')[1]);
    const orderId = urlParams.get('order_id');

    if (!orderId) {
      return NextResponse.json(
        { error: 'Missing order_id parameter' },
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

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        recipientName: order.recipientName,
        genre: order.genre,
        status: order.status,
        audioUrl: order.audioUrl,
        lyrics: order.lyrics,
        title: order.title,
        coverImageUrl: order.coverImageUrl,
        duration: order.duration,
        createdAt: order.createdAt.toISOString(),
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
