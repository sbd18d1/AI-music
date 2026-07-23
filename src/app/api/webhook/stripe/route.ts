import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/db/client';
import { generateSong } from '@/lib/ai-music';
import { sendSongEmail } from '@/lib/email';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

const BASE_URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';

async function handleCheckoutSessionCompleted(
  event: Stripe.Event
): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;

  console.log(`[${new Date().toISOString()}] Stripe webhook: checkout.session.completed`);
  console.log(`[${new Date().toISOString()}] Session ID: ${session.id}`);

  if (!session.metadata?.orderId) {
    console.error('[Stripe Webhook] No orderId found in session metadata');
    return;
  }

  const order = await prisma.order.findUnique({
    where: { id: session.metadata.orderId },
  });

  if (!order) {
    console.error('[Stripe Webhook] Order not found:', session.metadata.orderId);
    return;
  }

  if (order.status !== 'pending') {
    console.log(`[Stripe Webhook] Order ${order.id} already processed (status: ${order.status})`);
    return;
  }

  if (session.payment_status !== 'paid') {
    console.log(`[Stripe Webhook] Payment not successful (status: ${session.payment_status})`);
    return;
  }

  const customerEmail = session.customer_details?.email;
  console.log(`[${new Date().toISOString()}] Customer email from Stripe: ${customerEmail}`);

  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: 'processing',
      isFullVersion: true,
      stripePaymentIntentId: session.payment_intent as string,
      userEmail: customerEmail || order.userEmail,
    },
  });

  const recipientName = session.metadata.recipientName || order.recipientName;
  const personality = session.metadata.personality || order.personality;
  const genre = session.metadata.genre || order.genre;
  const selectedStyle = session.metadata.selectedStyle || order.selectedStyle;
  const selectedArtistStyle = session.metadata.selectedArtistStyle || order.selectedArtistStyle;
  const trialOrderIdFromMeta = session.metadata.trialOrderId || order.trialOrderId;

  // Prefer trialOrderId-based lookup (new logic: one device = one trial order).
  let trialSong: {
    audioUrl: string | null;
    lyrics: string | null;
    title: string | null;
    coverImageUrl: string | null;
    duration: string | null;
  } | null = null;

  if (trialOrderIdFromMeta) {
    const trialOrder = await prisma.order.findUnique({
      where: { id: trialOrderIdFromMeta },
    });
    if (trialOrder && !trialOrder.isFullVersion && trialOrder.status === 'success' && trialOrder.audioUrl) {
      trialSong = {
        audioUrl: trialOrder.audioUrl,
        lyrics: trialOrder.lyrics,
        title: trialOrder.title,
        coverImageUrl: trialOrder.coverImageUrl,
        duration: trialOrder.duration,
      };
      console.log(`[${new Date().toISOString()}] Using trial song from trialOrderId: ${trialOrderIdFromMeta}`);
    }
  }

  // Fallback: if the payment order already has audioUrl copied at create-order time
  if (!trialSong && order.audioUrl) {
    trialSong = {
      audioUrl: order.audioUrl,
      lyrics: order.lyrics,
      title: order.title,
      coverImageUrl: order.coverImageUrl,
      duration: order.duration,
    };
    console.log(`[${new Date().toISOString()}] Using audioUrl already stored on payment order: ${order.id}`);
  }

  if (trialSong && trialSong.audioUrl) {
    console.log(`[${new Date().toISOString()}] Reusing trial song for order: ${order.id}`);

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'success',
        audioUrl: trialSong.audioUrl,
        lyrics: trialSong.lyrics,
        title: trialSong.title,
        coverImageUrl: trialSong.coverImageUrl,
        duration: trialSong.duration,
      },
    });

    if (customerEmail) {
      try {
        await sendSongEmail({
          email: customerEmail,
          recipientName: order.recipientName,
          audioUrl: trialSong.audioUrl,
          title: trialSong.title || undefined,
          lyrics: trialSong.lyrics || undefined,
          orderId: order.id,
        });
        console.log(`[${new Date().toISOString()}] Email sent successfully to: ${customerEmail}`);
      } catch (emailError) {
        console.error(`[${new Date().toISOString()}] Failed to send email:`, emailError);
      }
    }
    return;
  }

  console.log(`[${new Date().toISOString()}] No trial song found, generating new song for order: ${order.id}`);
  console.log(`[${new Date().toISOString()}] Parameters: ${recipientName}, ${genre}, ${personality.length} chars`);

  try {
    const parsedSongConfig = order.songConfig
      ? JSON.parse(order.songConfig)
      : undefined;

    const aiResponse = await generateSong({
      recipientName,
      personality,
      genre,
      isPreview: false,
      selectedStyle: selectedStyle || genre,
      selectedArtistStyle: selectedArtistStyle ?? undefined,
      songConfig: parsedSongConfig,
    });

    if (aiResponse.success && aiResponse.audioUrl) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'success',
          audioUrl: aiResponse.audioUrl,
          aiRequestId: aiResponse.requestId,
          lyrics: aiResponse.lyrics || null,
          title: aiResponse.title || null,
          coverImageUrl: aiResponse.coverImageUrl || null,
          duration: aiResponse.duration || null,
        },
      });

      console.log(`[${new Date().toISOString()}] Full song generation successful! Order: ${order.id}`);

      if (customerEmail) {
        try {
          await sendSongEmail({
            email: customerEmail,
            recipientName: order.recipientName,
            audioUrl: aiResponse.audioUrl!,
            title: aiResponse.title,
            lyrics: aiResponse.lyrics,
            orderId: order.id,
          });
          console.log(`[${new Date().toISOString()}] Email sent successfully to: ${customerEmail}`);
        } catch (emailError) {
          console.error(`[${new Date().toISOString()}] Failed to send email:`, emailError);
        }
      }
    } else {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'failed',
          aiRequestId: aiResponse.requestId,
        },
      });

      console.error(`[${new Date().toISOString()}] Full song generation failed. Order: ${order.id}, Error: ${aiResponse.error}`);
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error during song generation. Order: ${order.id}`, error);
    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'failed' },
    }).catch(() => {});
  }
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const body = await request.text();

  try {
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    switch (event.type) {
      case 'checkout.session.completed':
        handleCheckoutSessionCompleted(event).catch((error) => {
          console.error('[Stripe Webhook] Handler error:', error);
        });
        break;
      default:
        console.log(`[Stripe Webhook] Unhandled event type ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Stripe Webhook] Signature verification failed:', error);
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    );
  }
}
