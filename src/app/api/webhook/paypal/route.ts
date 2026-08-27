import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/db/client';
import { generateSong } from '@/lib/ai-music';
import { sendSongEmail } from '@/lib/email';
import { consumeCouponForOrder } from '@/lib/coupon-use';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  return request.ip || 'unknown';
}
export const maxDuration = 300;

interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
}

function getPayPalConfig(): PayPalConfig {
  const mode = process.env.PAYPAL_MODE || 'sandbox';
  const isLive = mode === 'live';

  const clientId = isLive
    ? (process.env.PAYPAL_CLIENT_ID_LIVE || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '')
    : (process.env.PAYPAL_CLIENT_ID_SANDBOX || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '');

  const clientSecret = isLive
    ? (process.env.PAYPAL_CLIENT_SECRET_LIVE || process.env.PAYPAL_CLIENT_SECRET || '')
    : (process.env.PAYPAL_CLIENT_SECRET_SANDBOX || process.env.PAYPAL_CLIENT_SECRET || '');

  const baseUrl = isLive ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

  return { clientId, clientSecret, baseUrl };
}

// Verify PayPal webhook signature (skipped if PAYPAL_WEBHOOK_ID not set)
async function verifyWebhookSignature(
  body: string,
  headers: Headers
): Promise<boolean> {
  // Select the webhook ID matching the current mode so sandbox and live
  // production webhooks each verify against their own signing key.
  const mode = process.env.PAYPAL_MODE || 'sandbox';
  const webhookId = (mode === 'live'
    ? (process.env.PAYPAL_WEBHOOK_ID_LIVE || process.env.PAYPAL_WEBHOOK_ID || '')
    : (process.env.PAYPAL_WEBHOOK_ID_SANDBOX || process.env.PAYPAL_WEBHOOK_ID || ''));

  if (!webhookId || webhookId.includes('your_') || webhookId.length < 10) {
    // Verification disabled in dev — accept the event
    console.warn('[paypal:webhook] PAYPAL_WEBHOOK_ID not set for mode=' + mode + ', skipping signature verification (dev mode)');
    return true;
  }

  const transmissionId = headers.get('paypal-transmission-id');
  const transmissionTime = headers.get('paypal-transmission-time');
  const certUrl = headers.get('paypal-cert-url');
  const authAlgo = headers.get('paypal-auth-algo');
  const transmissionSig = headers.get('paypal-transmission-sig');

  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    console.error('[paypal:webhook] Missing PayPal signature headers');
    return false;
  }

  const { clientId, clientSecret, baseUrl } = getPayPalConfig();

  try {
    const authRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
    });
    if (!authRes.ok) return false;
    const authData = await authRes.json();

    const verifyRes = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authData.access_token}`,
      },
      body: JSON.stringify({
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: webhookId,
        webhook_event: JSON.parse(body),
      }),
    });

    if (!verifyRes.ok) {
      console.error('[paypal:webhook] Verify request failed:', verifyRes.status);
      return false;
    }
    const verifyData = await verifyRes.json();
    const isValid = verifyData.verification_status === 'SUCCESS';
    if (!isValid) {
      console.error('[paypal:webhook] Signature verification failed:', verifyData);
    }
    return isValid;
  } catch (e) {
    console.error('[paypal:webhook] Verify exception:', e);
    return false;
  }
}

// Look up order id from a PayPal event resource — supports both custom_id (top-level)
// and supplementary_data.related_ids.order_id (for PAYMENT.CAPTURE.* events)
function extractOrderId(resource: Record<string, unknown>): string | null {
  const customId = resource.custom_id as string | undefined;
  if (customId) return customId;

  const supplementary = resource.supplementary_data as { related_ids?: { order_id?: string } } | undefined;
  if (supplementary?.related_ids?.order_id) {
    return supplementary.related_ids.order_id;
  }
  return null;
}

export async function POST(request: NextRequest) {
  const reqId = `[${new Date().toISOString()}] [paypal:webhook]`;
  try {
    const body = await request.text();

    const verified = await verifyWebhookSignature(body, request.headers);
    if (!verified) {
      console.error(`${reqId} Signature verification failed, rejecting`);
      return NextResponse.json({ status: 'error', error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(body) as {
      event_type: string;
      resource: Record<string, unknown>;
    };

    console.log(`${reqId} event_type=${payload.event_type}`);

    // Main event: payment capture completed
    if (payload.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const orderId = extractOrderId(payload.resource);
      const captureId = (payload.resource.id as string | undefined) || null;

      if (!orderId) {
        console.warn(`${reqId} No orderId in resource`);
        return NextResponse.json({ status: 'success' });
      }

      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (!order) {
        console.warn(`${reqId} Order not found: ${orderId}`);
        return NextResponse.json({ status: 'success' });
      }

      if (order.status === 'success') {
        console.log(`${reqId} Order ${orderId} already success, skip`);
        return NextResponse.json({ status: 'success' });
      }

      const customerEmail =
        ((payload.resource.payer as { email_address?: string } | undefined)?.email_address) ||
        order.customerEmail;

      // Trial-song path
      let trialSong: {
        audioUrl: string | null;
        lyrics: string | null;
        title: string | null;
        coverImageUrl: string | null;
        duration: string | null;
      } | null = null;

      if (order.trialOrderId) {
        const trial = await prisma.order.findUnique({ where: { id: order.trialOrderId } });
        if (trial && trial.audioUrl && !trial.isFullVersion && trial.status === 'success') {
          trialSong = {
            audioUrl: trial.audioUrl,
            lyrics: trial.lyrics,
            title: trial.title,
            coverImageUrl: trial.coverImageUrl,
            duration: trial.duration,
          };
        }
      }
      if (!trialSong && order.audioUrl) {
        trialSong = {
          audioUrl: order.audioUrl,
          lyrics: order.lyrics,
          title: order.title,
          coverImageUrl: order.coverImageUrl,
          duration: order.duration,
        };
      }

      if (trialSong && trialSong.audioUrl) {
        await prisma.order.update({
          where: { id: orderId },
          data: {
            status: 'success',
            paymentOrderId: order.paymentOrderId || captureId,
            audioUrl: trialSong.audioUrl,
            lyrics: trialSong.lyrics,
            title: trialSong.title,
            coverImageUrl: trialSong.coverImageUrl,
            duration: trialSong.duration,
            customerEmail: customerEmail || order.customerEmail,
          },
        });

        // Voucher (if any auto-applied at checkout) is now earned — void it.
        const voided = await consumeCouponForOrder(orderId, order.couponCode, order.deviceId, getClientIp(request));
        if (voided > 0) console.log(`${reqId} Coupon consumed for orderId=${orderId}`);

        const emailForDelivery = customerEmail || order.customerEmail;
        if (emailForDelivery) {
          const sendResult = await sendSongEmail({
            email: emailForDelivery,
            recipientName: order.recipientName,
            audioUrl: trialSong.audioUrl,
            title: trialSong.title || undefined,
            lyrics: trialSong.lyrics || undefined,
            orderId,
          });
          if (!sendResult.ok) console.error(`${reqId} Email FAILED to ${emailForDelivery}: ${sendResult.error}`);
        }
        console.log(`${reqId} Order ${orderId} fulfilled via trial`);
        return NextResponse.json({ status: 'success' });
      }

      // Generate new song
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'processing',
          paymentOrderId: order.paymentOrderId || captureId,
          customerEmail: customerEmail || order.customerEmail,
        },
      });

      try {
        const parsedSongConfig = order.songConfig ? JSON.parse(order.songConfig) : undefined;
        // Submit only (waitForResult=false) so a slow 302 generation (6-8+ min) does NOT
        // block here and time out into a permanent "failed". The order-status endpoint
        // re-checks 302 by aiRequestId on each frontend poll and flips to success when ready.
        const result = await generateSong({
          recipientName: order.recipientName,
          personality: order.personality,
          genre: order.genre,
          isPreview: false,
          selectedStyle: order.selectedStyle || order.genre,
          selectedArtistStyle: order.selectedArtistStyle ?? undefined,
          songConfig: parsedSongConfig,
          waitForResult: false,
        });

        // Submit succeeded → store taskId, keep 'processing' (frontend will poll until done).
        if (result.success && result.requestId) {
          await prisma.order.update({
            where: { id: orderId },
            data: { aiRequestId: result.requestId },
          });
          console.log(`${reqId} Order ${orderId} submitted, taskId=${result.requestId}`);
        } else if (result.success && result.audioUrl) {
          // Resolved inline (e.g. mock mode)
          await prisma.order.update({
            where: { id: orderId },
            data: {
              status: 'success',
              audioUrl: result.audioUrl,
              lyrics: result.lyrics || null,
              title: result.title || null,
              coverImageUrl: result.coverImageUrl || null,
              duration: result.duration || null,
              aiRequestId: result.requestId || null,
            },
          });

          // Voucher (if any auto-applied at checkout) is now earned — void it.
          const voided = await consumeCouponForOrder(orderId, order.couponCode, order.deviceId, getClientIp(request));
          if (voided > 0) console.log(`${reqId} Coupon consumed for orderId=${orderId}`);
          console.log(`${reqId} Order ${orderId} generated`);

          const emailForDelivery = customerEmail || order.customerEmail;
          if (emailForDelivery) {
            const sendResult = await sendSongEmail({
              email: emailForDelivery,
              recipientName: order.recipientName,
              audioUrl: result.audioUrl,
              title: result.title,
              lyrics: result.lyrics,
              orderId,
            });
            if (!sendResult.ok) console.error(`${reqId} Email FAILED to ${emailForDelivery}: ${sendResult.error}`);
          }
        } else {
          // True submission failure — nothing to poll.
          await prisma.order.update({
            where: { id: orderId },
            data: { status: 'failed', aiRequestId: result.requestId || null },
          });
          console.error(`${reqId} Generation failed for ${orderId}:`, result.error);
        }
      } catch (e) {
        console.error(`${reqId} Generation exception:`, e);
        await prisma.order.update({ where: { id: orderId }, data: { status: 'failed' } });
      }
    } else if (payload.event_type === 'PAYMENT.CAPTURE.DENIED' || payload.event_type === 'PAYMENT.CAPTURE.REFUNDED') {
      const orderId = extractOrderId(payload.resource);
      if (orderId) {
        await prisma.order.update({
          where: { id: orderId },
          data: { status: 'failed' },
        }).catch(() => null);
        console.log(`${reqId} Order ${orderId} marked failed due to ${payload.event_type}`);
      }
    } else {
      console.log(`${reqId} Ignoring event ${payload.event_type}`);
    }

    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error(`${reqId} Webhook exception:`, error);
    return NextResponse.json({ status: 'success' }, { status: 200 });
  }
}
