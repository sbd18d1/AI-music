import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/db/client';
import { generateSong } from '@/lib/ai-music';
import { sendSongEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const payload = JSON.parse(body);

    console.log(`[${new Date().toISOString()}] PayPal webhook received:`, payload.event_type);

    if (payload.event_type === 'CHECKOUT.ORDER.APPROVED') {
      const orderId = payload.resource.custom_id;
      const paypalOrderId = payload.resource.id;

      if (!orderId) {
        console.error(`[${new Date().toISOString()}] PayPal webhook: Missing custom_id`);
        return NextResponse.json({ status: 'success' });
      }

      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        console.error(`[${new Date().toISOString()}] PayPal webhook: Order not found - ${orderId}`);
        return NextResponse.json({ status: 'success' });
      }

      if (order.status === 'success') {
        console.warn(`[${new Date().toISOString()}] PayPal webhook: Order already processed - ${orderId}`);
        return NextResponse.json({ status: 'success' });
      }

      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'processing',
          paypalOrderId: paypalOrderId,
        },
      });

      const PAYPAL_MODE = process.env.PAYPAL_MODE || 'sandbox';
      const PAYPAL_BASE_URL = PAYPAL_MODE === 'sandbox'
        ? 'https://api-m.sandbox.paypal.com'
        : 'https://api-m.paypal.com';

      const authResponse = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(
            `${process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
          ).toString('base64')}`,
        },
        body: 'grant_type=client_credentials',
      });

      if (!authResponse.ok) {
        console.error(`[${new Date().toISOString()}] PayPal auth failed in webhook`);
        return NextResponse.json({ status: 'success' });
      }

      const authData = await authResponse.json();
      const accessToken = authData.access_token;

      const captureResponse = await fetch(
        `${PAYPAL_BASE_URL}/v2/checkout/orders/${paypalOrderId}/capture`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!captureResponse.ok) {
        const captureError = await captureResponse.json().catch(() => ({ status: captureResponse.status }));
        console.error(`[${new Date().toISOString()}] PayPal capture failed:`, captureError);
        await prisma.order.update({
          where: { id: orderId },
          data: { status: 'failed' },
        });
        return NextResponse.json({ status: 'success' });
      }

      const captureData = await captureResponse.json();
      const customerEmail = captureData.payer?.email_address;

      console.log(`[${new Date().toISOString()}] PayPal payment captured:`, captureData.id);
      console.log(`[${new Date().toISOString()}] Customer email:`, customerEmail);

      // Prefer trialOrderId-based lookup (new logic: one device = one trial order).
      let trialSong: {
        audioUrl: string | null;
        lyrics: string | null;
        title: string | null;
        coverImageUrl: string | null;
        duration: string | null;
      } | null = null;

      if (order.trialOrderId) {
        const trialOrder = await prisma.order.findUnique({
          where: { id: order.trialOrderId },
        });
        if (trialOrder && !trialOrder.isFullVersion && trialOrder.status === 'success' && trialOrder.audioUrl) {
          trialSong = {
            audioUrl: trialOrder.audioUrl,
            lyrics: trialOrder.lyrics,
            title: trialOrder.title,
            coverImageUrl: trialOrder.coverImageUrl,
            duration: trialOrder.duration,
          };
          console.log(`[${new Date().toISOString()}] Using trial song from trialOrderId: ${order.trialOrderId}`);
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
        console.log(`[${new Date().toISOString()}] Using audioUrl already stored on payment order: ${orderId}`);
      }

      if (trialSong && trialSong.audioUrl) {
        console.log(`[${new Date().toISOString()}] Reusing trial song for order: ${orderId}`);

        await prisma.order.update({
          where: { id: orderId },
          data: {
            status: 'success',
            audioUrl: trialSong.audioUrl,
            lyrics: trialSong.lyrics,
            title: trialSong.title,
            coverImageUrl: trialSong.coverImageUrl,
            duration: trialSong.duration,
            customerEmail: customerEmail || null,
          },
        });

        const emailForDelivery = customerEmail || order.customerEmail;
        if (emailForDelivery) {
          try {
            await sendSongEmail({
              email: emailForDelivery,
              recipientName: order.recipientName,
              audioUrl: trialSong.audioUrl,
              title: trialSong.title || undefined,
              lyrics: trialSong.lyrics || undefined,
              orderId: orderId,
            });
            console.log(`[${new Date().toISOString()}] Email sent successfully to: ${emailForDelivery}`);
          } catch (emailError) {
            console.error(`[${new Date().toISOString()}] Failed to send email:`, emailError);
          }
        }
      } else {
        console.log(`[${new Date().toISOString()}] No existing trial song found, generating new song for order: ${orderId}`);

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
                audioUrl: result.audioUrl,
                lyrics: result.lyrics || null,
                title: result.title || null,
                coverImageUrl: result.coverImageUrl || null,
                duration: result.duration || null,
                customerEmail: customerEmail || null,
              },
            });
            console.log(`[${new Date().toISOString()}] Full song generation successful! Order: ${orderId}`);

            const emailForDelivery = customerEmail || order.customerEmail;
            if (emailForDelivery) {
              try {
                await sendSongEmail({
                  email: emailForDelivery,
                  recipientName: order.recipientName,
                  audioUrl: result.audioUrl!,
                  title: result.title,
                  lyrics: result.lyrics,
                  orderId: orderId,
                });
                console.log(`[${new Date().toISOString()}] Email sent successfully to: ${emailForDelivery}`);
              } catch (emailError) {
                console.error(`[${new Date().toISOString()}] Failed to send email:`, emailError);
              }
            }
          } else {
            await prisma.order.update({
              where: { id: orderId },
              data: { status: 'failed' },
            });
            console.error(`[${new Date().toISOString()}] Full song generation failed! Order: ${orderId}`);
          }
        } catch (generationError) {
          console.error(`[${new Date().toISOString()}] Full song generation exception:`, generationError);
          await prisma.order.update({
            where: { id: orderId },
            data: { status: 'failed' },
          });
        }
      }
    }

    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] PayPal webhook error:`, error);
    return NextResponse.json({ status: 'success' }, { status: 200 });
  }
}
