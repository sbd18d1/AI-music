import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/db/client';
import { generateSong } from '@/lib/ai-music';
import { sendSongEmail } from '@/lib/email';

async function verifyPaddleWebhook(req: NextRequest): Promise<boolean> {
  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET_KEY || '';
  if (!webhookSecret || webhookSecret.includes('your_webhook_secret_here')) {
    console.warn('[Paddle Webhook] Webhook secret not configured, skipping verification');
    return true;
  }

  try {
    const signature = req.headers.get('paddle-signature');
    if (!signature) {
      console.error('[Paddle Webhook] Missing paddle-signature header');
      return false;
    }

    const body = await req.text();
    const crypto = require('crypto');
    const key = Buffer.from(webhookSecret, 'utf-8');
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(body);
    const digest = hmac.digest('hex');
    const expectedSignature = `sha256=${digest}`;

    const valid = signature === expectedSignature;
    if (!valid) {
      console.error('[Paddle Webhook] Signature verification failed');
    }
    return valid;
  } catch (err) {
    console.error('[Paddle Webhook] Verification error:', err);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const isValid = await verifyPaddleWebhook(request);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const bodyText = await request.text();
    const payload = JSON.parse(bodyText);

    const eventType = payload.event?.type;
    const data = payload.data;

    console.log(`[${new Date().toISOString()}] Paddle webhook received:`, eventType);

    if (!data) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }

    if (eventType === 'transaction.updated') {
      const status = data.status;
      const customData = data.custom_data || {};
      const orderId = customData.orderId;

      if (!orderId) {
        console.error('[Paddle Webhook] No orderId in custom_data');
        return NextResponse.json({ error: 'No orderId' }, { status: 400 });
      }

      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      if (order.status === 'success' || order.status === 'processing') {
        return NextResponse.json({ success: true, message: 'Order already processed' });
      }

      if (status === 'completed' || status === 'paid') {
        const trialOrderId = order.trialOrderId;
        let finalAudioUrl = order.audioUrl || null;
        let finalLyrics = order.lyrics || null;
        let finalTitle = order.title || null;
        let finalCoverImageUrl = order.coverImageUrl || null;
        let finalDuration = order.duration || null;

        if (trialOrderId) {
          const trialOrder = await prisma.order.findUnique({
            where: { id: trialOrderId },
          });

          if (trialOrder && trialOrder.audioUrl) {
            console.log(`[${new Date().toISOString()}] Using trial order song for order: ${orderId}`);
            finalAudioUrl = trialOrder.audioUrl;
            finalLyrics = trialOrder.lyrics;
            finalTitle = trialOrder.title;
            finalCoverImageUrl = trialOrder.coverImageUrl;
            finalDuration = trialOrder.duration;
          }
        }

        if (finalAudioUrl) {
          await prisma.order.update({
            where: { id: orderId },
            data: {
              status: 'success',
              paddleTransactionId: data.id,
              audioUrl: finalAudioUrl,
              lyrics: finalLyrics,
              title: finalTitle,
              coverImageUrl: finalCoverImageUrl,
              duration: finalDuration,
            },
          });

          if (order.customerEmail) {
            try {
              await sendSongEmail({
                email: order.customerEmail,
                recipientName: order.recipientName,
                audioUrl: finalAudioUrl,
                title: finalTitle || undefined,
                lyrics: finalLyrics || undefined,
                orderId,
              });
              console.log(`[${new Date().toISOString()}] Email sent successfully to: ${order.customerEmail}`);
            } catch (emailError) {
              console.error(`[${new Date().toISOString()}] Failed to send email:`, emailError);
            }
          }
        } else {
          await prisma.order.update({
            where: { id: orderId },
            data: { status: 'processing' },
          });

          try {
            const parsedSongConfig = order.songConfig
              ? JSON.parse(order.songConfig)
              : undefined;

            const result = await generateSong({
              recipientName: order.recipientName,
              personality: order.personality,
              genre: order.genre,
              isPreview: false,
              selectedStyle: order.selectedStyle || order.genre,
              selectedArtistStyle: order.selectedArtistStyle ?? undefined,
              songConfig: parsedSongConfig,
            });

            if (result.success && result.audioUrl) {
              await prisma.order.update({
                where: { id: orderId },
                data: {
                  status: 'success',
                  paddleTransactionId: data.id,
                  audioUrl: result.audioUrl,
                  lyrics: result.lyrics || null,
                  title: result.title || null,
                  coverImageUrl: result.coverImageUrl || null,
                  duration: result.duration || null,
                },
              });

              if (order.customerEmail) {
                try {
                  await sendSongEmail({
                    email: order.customerEmail,
                    recipientName: order.recipientName,
                    audioUrl: result.audioUrl,
                    title: result.title,
                    lyrics: result.lyrics,
                    orderId,
                  });
                } catch (emailError) {
                  console.error(`[${new Date().toISOString()}] Failed to send email:`, emailError);
                }
              }
            } else {
              await prisma.order.update({
                where: { id: orderId },
                data: { status: 'failed' },
              });
            }
          } catch (generationError) {
            console.error(`[${new Date().toISOString()}] Song generation exception:`, generationError);
            await prisma.order.update({
              where: { id: orderId },
              data: { status: 'failed' },
            });
          }
        }

        return NextResponse.json({ success: true, status: 'completed' });
      } else if (status === 'cancelled' || status === 'declined') {
        await prisma.order.update({
          where: { id: orderId },
          data: { status: status === 'cancelled' ? 'cancelled' : 'failed' },
        });
        return NextResponse.json({ success: true, status });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Paddle webhook error:`, error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}
