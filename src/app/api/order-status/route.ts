import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/db/client';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export async function GET(request: NextRequest) {
  try {
    const urlParams = new URLSearchParams(request.url.split('?')[1]);
    const sessionId = urlParams.get('session_id');
    const orderId = urlParams.get('order_id');

    if (!sessionId && !orderId) {
      return NextResponse.json(
        { error: 'Missing session_id or order_id parameter' },
        { status: 400 }
      );
    }

    let order;
    if (sessionId) {
      order = await prisma.order.findFirst({
        where: { stripeSessionId: sessionId },
      });
    } else {
      order = await prisma.order.findUnique({
        where: { id: orderId ?? undefined },
      });
    }

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
