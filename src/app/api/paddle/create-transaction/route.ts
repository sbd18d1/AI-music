import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/db/client';
import { z } from 'zod';

const CreateTransactionSchema = z.object({
  recipientName: z.string().min(1).max(100),
  personality: z.string().max(1000).optional(),
  genre: z.string().min(1).max(100),
  selectedStyle: z.string().optional(),
  selectedArtistStyle: z.string().optional(),
  userEmail: z.string().email().optional(),
  songConfig: z.any().optional(),
  trialOrderId: z.string().optional(),
});

function getPaddleConfig() {
  const paddleKey = process.env.PADDLE_API_KEY || '';
  const environment = (process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT as 'sandbox' | 'live') || 'sandbox';
  const priceId = process.env.NEXT_PUBLIC_PADDLE_PRICE_ID || '';

  const baseUrl = environment === 'sandbox'
    ? 'https://sandbox-api.paddle.com'
    : 'https://api.paddle.com';

  return { paddleKey, baseUrl, priceId, environment };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = CreateTransactionSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input: ' + JSON.stringify(result.error) },
        { status: 400 }
      );
    }

    const { recipientName, personality, genre, selectedStyle, selectedArtistStyle, userEmail, songConfig, trialOrderId } = result.data;
    const { paddleKey, baseUrl, priceId, environment } = getPaddleConfig();

    if (!paddleKey || paddleKey.includes('your_api_key_here')) {
      return NextResponse.json(
        { error: 'Paddle API key not configured' },
        { status: 500 }
      );
    }

    if (!priceId || priceId.includes('your_price_id_here')) {
      return NextResponse.json(
        { error: 'Paddle Price ID not configured' },
        { status: 500 }
      );
    }

    const orderId = crypto.randomUUID();

    let trialOrderData: {
      audioUrl?: string;
      lyrics?: string | null;
      title?: string | null;
      coverImageUrl?: string | null;
      duration?: string | null;
      deviceId?: string | null;
      ipAddress?: string | null;
    } | null = null;

    if (trialOrderId) {
      const trialOrder = await prisma.order.findUnique({
        where: { id: trialOrderId },
      });

      if (!trialOrder) {
        return NextResponse.json(
          { error: 'Trial order not found' },
          { status: 404 }
        );
      }

      if (trialOrder.isFullVersion || trialOrder.status !== 'success') {
        return NextResponse.json(
          { error: 'Invalid trial order' },
          { status: 400 }
        );
      }

      trialOrderData = {
        audioUrl: trialOrder.audioUrl || undefined,
        lyrics: trialOrder.lyrics,
        title: trialOrder.title,
        coverImageUrl: trialOrder.coverImageUrl,
        duration: trialOrder.duration,
        deviceId: trialOrder.deviceId,
        ipAddress: trialOrder.ipAddress,
      };
    }

    await prisma.order.create({
      data: {
        id: orderId,
        recipientName,
        personality: personality || '',
        genre,
        selectedStyle,
        selectedArtistStyle,
        customerEmail: userEmail || null,
        songConfig: songConfig ? JSON.stringify(songConfig) : null,
        status: 'pending',
        isFullVersion: true,
        trialOrderId: trialOrderId || null,
        deviceId: trialOrderData?.deviceId || null,
        ipAddress: trialOrderData?.ipAddress || null,
        audioUrl: trialOrderData?.audioUrl || null,
        lyrics: trialOrderData?.lyrics || null,
        title: trialOrderData?.title || null,
        coverImageUrl: trialOrderData?.coverImageUrl || null,
        duration: trialOrderData?.duration || null,
      },
    });

    const transactionPayload: Record<string, unknown> = {
      items: [
        {
          price_id: priceId,
          quantity: 1,
        },
      ],
      customer: {
        email: userEmail || undefined,
      },
      custom_data: {
        orderId,
        trialOrderId: trialOrderId || null,
      },
      return_url: `${process.env.NEXT_PUBLIC_URL}/order-status?order_id=${orderId}&provider=paddle`,
      cancel_url: `${process.env.NEXT_PUBLIC_URL}/`,
    };

    const paddleResponse = await fetch(`${baseUrl}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${paddleKey}`,
      },
      body: JSON.stringify(transactionPayload),
    });

    if (!paddleResponse.ok) {
      const errorData = await paddleResponse.json().catch(() => ({}));
      console.error(`[${new Date().toISOString()}] Paddle create transaction failed:`, errorData);
      return NextResponse.json(
        { error: 'Failed to create Paddle transaction' },
        { status: 500 }
      );
    }

    const paddleData = await paddleResponse.json();
    const transactionId = paddleData.data?.id;

    if (!transactionId) {
      return NextResponse.json(
        { error: 'Invalid Paddle response' },
        { status: 500 }
      );
    }

    await prisma.order.update({
      where: { id: orderId },
      data: {
        stripeSessionId: transactionId,
      },
    });

    console.log(`[${new Date().toISOString()}] Paddle transaction created:`, transactionId, 'for order:', orderId);

    return NextResponse.json({
      success: true,
      orderId,
      transactionId,
      environment,
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Paddle create-transaction error:`, error);
    return NextResponse.json(
      { error: 'Failed to create transaction' },
      { status: 500 }
    );
  }
}
