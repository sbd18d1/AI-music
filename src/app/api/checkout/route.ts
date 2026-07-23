import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/db/client';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';

const checkoutSchema = z.object({
  recipientName: z.string().min(1).max(100),
  personality: z.string().min(5).max(1000),
  genre: z.string().min(1).max(100),
  selectedStyle: z.string().optional(),
  selectedArtistStyle: z.string().optional(),
  userEmail: z.string().email().optional(),
  songConfig: z.any().optional(),
  trialOrderId: z.string().optional(),
});

function getStripeSecretKey() {
  const AI_GENERATION_MODE = process.env.NEXT_PUBLIC_AI_GENERATION_MODE || 'mock';
  
  if (AI_GENERATION_MODE === 'mock') {
    return process.env.STRIPE_SECRET_KEY_TEST || '';
  } else {
    return process.env.STRIPE_SECRET_KEY_LIVE || '';
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validation = checkoutSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { recipientName, personality, genre, selectedStyle, selectedArtistStyle, userEmail, songConfig, trialOrderId } = validation.data;

    // If trialOrderId is provided, verify and copy song data from the trial order
    let trialOrderData: {
      audioUrl: string | null;
      lyrics: string | null;
      title: string | null;
      coverImageUrl: string | null;
      duration: string | null;
      ipAddress: string | null;
      deviceId: string | null;
    } | null = null;

    if (trialOrderId) {
      const trialOrder = await prisma.order.findUnique({
        where: { id: trialOrderId },
      });

      if (trialOrder && !trialOrder.isFullVersion && trialOrder.status === 'success' && trialOrder.audioUrl) {
        trialOrderData = {
          audioUrl: trialOrder.audioUrl,
          lyrics: trialOrder.lyrics,
          title: trialOrder.title,
          coverImageUrl: trialOrder.coverImageUrl,
          duration: trialOrder.duration,
          ipAddress: trialOrder.ipAddress,
          deviceId: trialOrder.deviceId,
        };
        console.log(`[${new Date().toISOString()}] Found trial order ${trialOrderId} with audioUrl, will reuse song`);
      }
    }

    const order = await prisma.order.create({
      data: {
        recipientName,
        personality,
        genre,
        selectedStyle,
        selectedArtistStyle,
        customerEmail: userEmail || null,
        songConfig: songConfig ? JSON.stringify(songConfig) : null,
        status: 'pending',
        isFullVersion: true,
        trialOrderId: trialOrderId || null,
        ipAddress: trialOrderData?.ipAddress || null,
        deviceId: trialOrderData?.deviceId || null,
        audioUrl: trialOrderData?.audioUrl || null,
        lyrics: trialOrderData?.lyrics || null,
        title: trialOrderData?.title || null,
        coverImageUrl: trialOrderData?.coverImageUrl || null,
        duration: trialOrderData?.duration || null,
      },
    });

    const AI_GENERATION_MODE = process.env.NEXT_PUBLIC_AI_GENERATION_MODE || 'mock';

    if (AI_GENERATION_MODE === 'mock') {
      console.log(`[${new Date().toISOString()}] MOCK MODE: Skipping Stripe payment, returning success`);
      
      const testDataPath = path.join(process.cwd(), 'test-song-data.json');
      const testData = JSON.parse(fs.readFileSync(testDataPath, 'utf-8'));

      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'success',
          audioUrl: testData.audioUrl,
          title: testData.title,
          lyrics: testData.lyrics,
          coverImageUrl: testData.coverImageUrl,
          duration: testData.duration,
        },
      });

      return NextResponse.json({
        url: `${BASE_URL}/order-status?order_id=${order.id}`,
      });
    }

    const stripeSecretKey = getStripeSecretKey();
    
    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: 'Stripe credentials not configured for live mode' },
        { status: 500 }
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-06-20',
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'AI Personalized Song - Full Version',
              description: `A custom 3-minute AI-generated ${genre} song for ${recipientName}`,
            },
            unit_amount: 499,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      customer_creation: 'always',
      customer_email: undefined,
      success_url: `${BASE_URL}/order-status?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/`,
      metadata: {
        orderId: order.id,
        recipientName,
        personality,
        genre,
        selectedStyle: selectedStyle || '',
        selectedArtistStyle: selectedArtistStyle || '',
        trialOrderId: trialOrderId || '',
      },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { stripeSessionId: session.id },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Checkout session creation failed:`, error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}