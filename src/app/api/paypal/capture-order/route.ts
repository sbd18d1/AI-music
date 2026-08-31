import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/db/client';
import { generateSong } from '@/lib/ai-music';
import { sendSongEmail } from '@/lib/email';
import { consumeCouponForOrder } from '@/lib/coupon-use';
import { ensureOrderEmailColumn } from '@/lib/ensure-coupon-table';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const maxDuration = 300;

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  return request.ip || 'unknown';
}

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

interface CaptureBody {
  orderId: string;
  paymentOrderId: string;
}

export async function POST(request: NextRequest) {
  const t0 = Date.now();
  const reqId = `[${new Date().toISOString()}] [paypal:capture-order]`;
  try {
    await ensureOrderEmailColumn();
    const body = (await request.json()) as CaptureBody;
    const { orderId, paymentOrderId } = body;

    if (!orderId || !paymentOrderId) {
      return NextResponse.json(
        { success: false, error: 'Missing orderId or paymentOrderId' },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    console.log(`${reqId} START orderId=${orderId} paymentOrderId=${paymentOrderId} currentStatus=${order.status}`);

    // Idempotency: if already success, return immediately
    if (order.status === 'success') {
      console.log(`${reqId} Order already success, returning`);
      return NextResponse.json({
        success: true,
        status: 'success',
        orderId,
        message: 'Order already completed',
      });
    }

    // If processing, frontend will poll — return current state
    if (order.status === 'processing') {
      console.log(`${reqId} Order already processing`);
      return NextResponse.json({
        success: true,
        status: 'processing',
        orderId,
        message: 'Order is being processed',
      });
    }

    // Step 1: Capture the PayPal payment
    const { clientId, clientSecret, baseUrl } = getPayPalConfig();

    if (!clientId || !clientSecret) {
      console.error(`${reqId} PayPal credentials not configured`);
      return NextResponse.json(
        { success: false, error: 'PayPal credentials not configured' },
        { status: 500 }
      );
    }

    const authResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
    });

    if (!authResponse.ok) {
      const authError = await authResponse.json().catch(() => ({ status: authResponse.status }));
      console.error(`${reqId} PayPal auth failed:`, authError);
      return NextResponse.json(
        { success: false, error: 'Failed to authenticate with PayPal' },
        { status: 500 }
      );
    }

    const authData = await authResponse.json();
    const accessToken = authData.access_token;

    const captureResponse = await fetch(
      `${baseUrl}/v2/checkout/orders/${paymentOrderId}/capture`,
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
      const isAlreadyCaptured = captureError.details?.some(
        (d: { issue: string }) => d.issue === 'ORDER_ALREADY_CAPTURED'
      );

      if (!isAlreadyCaptured) {
        console.error(`${reqId} PayPal capture failed:`, captureError);
        await prisma.order.update({
          where: { id: orderId },
          data: { status: 'failed' },
        });
        return NextResponse.json(
          { success: false, error: 'Payment capture failed' },
          { status: 500 }
        );
      }
      console.warn(`${reqId} Order already captured, continuing fulfillment`);
    }

    const captureData = await captureResponse.json().catch(() => ({}));
    const customerEmail = captureData.payer?.email_address || order.customerEmail;

    console.log(`${reqId} PayPal captured, payer email=${captureData.payer?.email_address || 'N/A'}`);

    // Step 2: Look for existing trial song (no need to regenerate)
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
      if (
        trialOrder &&
        !trialOrder.isFullVersion &&
        trialOrder.status === 'success' &&
        trialOrder.audioUrl
      ) {
        trialSong = {
          audioUrl: trialOrder.audioUrl,
          lyrics: trialOrder.lyrics,
          title: trialOrder.title,
          coverImageUrl: trialOrder.coverImageUrl,
          duration: trialOrder.duration,
        };
        console.log(`${reqId} Found trial song via trialOrderId=${order.trialOrderId}`);
      }
    }

    // Fallback: if create-order already copied audioUrl onto this order
    if (!trialSong && order.audioUrl) {
      trialSong = {
        audioUrl: order.audioUrl,
        lyrics: order.lyrics,
        title: order.title,
        coverImageUrl: order.coverImageUrl,
        duration: order.duration,
      };
      console.log(`${reqId} Using audioUrl already stored on order`);
    }

    // Step 3a: Reuse trial song (immediate success)
    if (trialSong && trialSong.audioUrl) {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'success',
          paymentOrderId,
          audioUrl: trialSong.audioUrl,
          lyrics: trialSong.lyrics,
          title: trialSong.title,
          coverImageUrl: trialSong.coverImageUrl,
          duration: trialSong.duration,
          customerEmail: customerEmail || order.customerEmail,
        },
      });

      // The fingerprint-bound coupon auto-applied at checkout is now earned — void it.
      const voided = await consumeCouponForOrder(orderId, order.couponCode, order.deviceId, getClientIp(request));
      if (voided > 0) console.log(`${reqId} Coupon consumed for orderId=${orderId}`);

      console.log(`${reqId} SUCCESS (reused trial) orderId=${orderId} elapsed=${Date.now() - t0}ms`);

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
        if (sendResult.ok) {
          console.log(`${reqId} Email sent to ${emailForDelivery}`);
          await prisma.order.update({ where: { id: orderId }, data: { emailSentAt: new Date() } });
        } else {
          console.error(`${reqId} Email FAILED to ${emailForDelivery}: ${sendResult.error}`);
        }
      }

      return NextResponse.json({
        success: true,
        status: 'success',
        orderId,
      });
    }

    // Step 3b: Generate new song (async — return processing, frontend polls).
    // IMPORTANT: We submit to 302 with waitForResult=false so we get the taskId
    // immediately instead of blocking this request for 5 minutes. The order-status
    // endpoint then re-checks 302 (by aiRequestId) on every frontend poll, and marks
    // success as soon as the song is ready. This means a slow 302 generation (6-8+ min)
    // NO LONGER times out into a permanent "failed" — the customer already paid.
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'processing',
        paymentOrderId,
        customerEmail: customerEmail || order.customerEmail,
      },
    });

    console.log(`${reqId} No trial song, submitting new song generation orderId=${orderId}`);

    try {
      const parsedSongConfig = order.songConfig ? JSON.parse(order.songConfig) : undefined;

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

      // Submit succeeded → we have a 302 task id. Store it so order-status can
      // re-check 302 on later polls. Keep status 'processing' (NOT failed).
      if (result.success && result.requestId) {
        await prisma.order.update({
          where: { id: orderId },
          data: { aiRequestId: result.requestId },
        });
        console.log(`${reqId} Submitted, taskId=${result.requestId} orderId=${orderId} elapsed=${Date.now() - t0}ms`);
        return NextResponse.json({
          success: true,
          status: 'processing',
          orderId,
          message: 'Song generation in progress',
        });
      }

      // Rare case: already resolved during the request (mock mode returns audioUrl inline)
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
            aiRequestId: result.requestId || null,
          },
        });

        // Voucher (if any auto-applied at checkout) is now earned — void it.
        const voided = await consumeCouponForOrder(orderId, order.couponCode, order.deviceId, getClientIp(request));
        if (voided > 0) console.log(`${reqId} Coupon consumed for orderId=${orderId}`);
        console.log(`${reqId} SUCCESS (generated inline) orderId=${orderId} elapsed=${Date.now() - t0}ms`);

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
          if (sendResult.ok) {
            console.log(`${reqId} Email sent to ${emailForDelivery}`);
            await prisma.order.update({ where: { id: orderId }, data: { emailSentAt: new Date() } });
          } else {
            console.error(`${reqId} Email FAILED to ${emailForDelivery}: ${sendResult.error}`);
          }
        }

        return NextResponse.json({
          success: true,
          status: 'success',
          orderId,
        });
      }

      // True submission failure — nothing to poll, mark failed.
      console.error(`${reqId} Song submission failed:`, result.error);
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'failed',
          aiRequestId: result.requestId || null,
        },
      });
      return NextResponse.json({
        success: false,
        status: 'failed',
        orderId,
        error: result.error || 'Song generation failed',
      });
    } catch (generationError) {
      console.error(`${reqId} Song generation exception:`, generationError);
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'failed' },
      });
      return NextResponse.json({
        success: false,
        status: 'failed',
        orderId,
        error: 'Song generation exception',
      });
    }
  } catch (error) {
    console.error(`${reqId} capture-order exception:`, error);
    return NextResponse.json(
      { success: false, error: 'Failed to capture order' },
      { status: 500 }
    );
  }
}
