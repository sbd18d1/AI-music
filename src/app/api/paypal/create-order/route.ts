import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/db/client';
import { z } from 'zod';
import { generateSong } from '@/lib/ai-music';
import { ensureCouponTable, ensureOrderCouponColumn } from '@/lib/ensure-coupon-table';
import { consumeCouponForOrder } from '@/lib/coupon-use';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const maxDuration = 60;

const CreateOrderSchema = z.object({
  recipientName: z.string().min(1).max(100),
  // Waiting list: a user may unlock the already-generated preview song ("Get Full
  // Song") with an EMPTY description box. When trialOrderId is present we backfill
  // personality from the trial order's stored description. For a brand-new song
  // (no trialOrderId) a non-empty personality is required (enforced in the handler).
  personality: z.string().trim().max(1000).optional().or(z.literal('')),
  genre: z.string().min(1).max(100),
  selectedStyle: z.string().optional(),
  selectedArtistStyle: z.string().optional(),
  userEmail: z.string().email().optional(),
  songConfig: z.any().optional(),
  trialOrderId: z.string().optional(),
  deviceId: z.string().max(200).optional(), // browser fingerprint (getDeviceId) — coupon owner
});

// Regular (list) price for a full song — shown to users as the struck-through original.
const REGULAR_PRICE = '9.90';
// Limited-time promo price actually charged for a full song (USD).
const PURCHASE_PRICE = '4.90';
// Coupon deduction per order (a fingerprint-bound coupon automatically subtracts this).
const COUPON_VALUE = 0.5;
const PURCHASE_CURRENCY = 'USD';

interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  mode: 'sandbox' | 'live';
}

function getPayPalConfig(): PayPalConfig {
  const mode = (process.env.PAYPAL_MODE || 'sandbox') as 'sandbox' | 'live';
  const isLive = mode === 'live';

  const clientId = isLive
    ? (process.env.PAYPAL_CLIENT_ID_LIVE || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '')
    : (process.env.PAYPAL_CLIENT_ID_SANDBOX || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '');

  const clientSecret = isLive
    ? (process.env.PAYPAL_CLIENT_SECRET_LIVE || process.env.PAYPAL_CLIENT_SECRET || '')
    : (process.env.PAYPAL_CLIENT_SECRET_SANDBOX || process.env.PAYPAL_CLIENT_SECRET || '');

  const baseUrl = isLive
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

  return { clientId, clientSecret, baseUrl, mode };
}

export async function POST(request: NextRequest) {
  const t0 = Date.now();
  const reqId = `[${new Date().toISOString()}] [paypal:create-order]`;
  try {
    const body = await request.json();
    const result = CreateOrderSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid input: ' + JSON.stringify(result.error) },
        { status: 400 }
      );
    }

    const {
      recipientName,
      personality,
      genre,
      selectedStyle,
      selectedArtistStyle,
      userEmail,
      songConfig,
      trialOrderId,
      deviceId,
    } = result.data;

    const orderId = crypto.randomUUID();

    console.log(`${reqId} START orderId=${orderId} email=${userEmail || 'N/A'} trialOrderId=${trialOrderId || 'N/A'} deviceId=${deviceId ? deviceId.slice(0, 12) + '…' : 'N/A'}`);

    // If trialOrderId is provided, verify it exists and copy song data from the trial order
    let trialOrderData: {
      personality: string | null;
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

      if (
        trialOrder &&
        !trialOrder.isFullVersion &&
        trialOrder.status === 'success' &&
        trialOrder.audioUrl
      ) {
        trialOrderData = {
          // Backfill personality with the description the preview was generated from, so
          // "Get Full Song" works even when the user has cleared the description box.
          personality: trialOrder.personality,
          audioUrl: trialOrder.audioUrl,
          lyrics: trialOrder.lyrics,
          title: trialOrder.title,
          coverImageUrl: trialOrder.coverImageUrl,
          duration: trialOrder.duration,
          ipAddress: trialOrder.ipAddress,
          deviceId: trialOrder.deviceId,
        };
        console.log(`${reqId} Reusing trial order ${trialOrderId} audio`);
      } else {
        console.warn(`${reqId} Trial order ${trialOrderId} invalid, will generate new song`);
      }
    }

    // Resolve the description for this paid order:
    // - "Get Full Song" unlocks the already-generated preview: the user may have
    //   cleared the description box, so backfill from the trial order's stored
    //   description (the one the preview was actually generated from).
    // - A brand-new song, on the other hand, REQUIRES a real description — reject
    //   rather than silently defaulting to a placeholder.
    const resolvedPersonality =
      (personality || '').trim() ||
      trialOrderData?.personality?.trim() ||
      '';
    if (!resolvedPersonality) {
      console.warn(`${reqId} Rejecting: no description and no reusable trial order`);
      return NextResponse.json(
        { success: false, error: 'Invalid input: a description is required to generate a song.' },
        { status: 400 }
      );
    }

    // Determine automatic coupon deduction: an unused coupon bound to this device's
    // fingerprint reduces the price by the coupon's real value. If it fully covers the
    // song, we skip PayPal and unlock it for free (see "free" branch below).
    await ensureCouponTable();
    await ensureOrderCouponColumn();
    let appliedCouponValue = 0;
    let couponCodeForOrder: string | null = null;
    if (deviceId) {
      const unused = await prisma.coupon.findFirst({
        where: { issuedByDeviceId: deviceId, used: false },
      });
      if (unused) {
        // Use the coupon's actual value (a $1 coupon on a $1 song fully covers it).
        appliedCouponValue = Number(unused.value) || COUPON_VALUE;
        couponCodeForOrder = unused.code;
        console.log(`${reqId} Applying coupon code=${unused.code} (-$${appliedCouponValue.toFixed(2)}) for deviceId=${deviceId.slice(0, 12)}…`);
      }
    }
    const basePrice = parseFloat(PURCHASE_PRICE);
    const payAmountNum = basePrice - appliedCouponValue;
    const payAmount = Math.max(0, payAmountNum).toFixed(2);
    const isFree = payAmountNum <= 0; // coupon fully covers the song → unlock without payment

    await prisma.order.create({
      data: {
        id: orderId,
        recipientName,
        personality: resolvedPersonality,
        genre,
        selectedStyle,
        selectedArtistStyle,
        customerEmail: userEmail || null,
        songConfig: songConfig ? JSON.stringify(songConfig) : null,
        status: isFree ? 'processing' : 'pending',
        isFullVersion: true,
        trialOrderId: trialOrderId || null,
        ipAddress: trialOrderData?.ipAddress || null,
        deviceId: deviceId || trialOrderData?.deviceId || null,
        couponCode: couponCodeForOrder || null,
        audioUrl: trialOrderData?.audioUrl || null,
        lyrics: trialOrderData?.lyrics || null,
        title: trialOrderData?.title || null,
        coverImageUrl: trialOrderData?.coverImageUrl || null,
        duration: trialOrderData?.duration || null,
      },
    });

    // ===== FREE path: a coupon fully covered the song → no PayPal. Unlock directly. =====
    if (isFree) {
      // Consume the coupon now (this free order is locked in).
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') || request.ip || 'unknown';
      const voided = await consumeCouponForOrder(orderId, couponCodeForOrder, deviceId, ip);

      // Reuse the trial audio (already successful) → immediate success.
      if (trialOrderData?.audioUrl) {
        await prisma.order.update({
          where: { id: orderId },
          data: { status: 'success' },
        });
        console.log(`${reqId} FREE (reused trial) orderId=${orderId} couponCode=${couponCodeForOrder} ⇦voided=${voided}`);
        return NextResponse.json({ success: true, isFree: true, orderId, status: 'success', amountPaid: '0.00', couponApplied: true });
      }
      // Otherwise submit a brand-new full generation (async).
      try {
        const result = await generateSong({
          recipientName,
          personality: resolvedPersonality,
          genre,
          isPreview: false,
          selectedStyle: selectedStyle || genre,
          selectedArtistStyle: selectedArtistStyle ?? undefined,
          songConfig: songConfig ?? undefined,
          waitForResult: false,
        });
        if (result.success && result.requestId) {
          await prisma.order.update({ where: { id: orderId }, data: { aiRequestId: result.requestId } });
          console.log(`${reqId} FREE (submitted) orderId=${orderId} taskId=${result.requestId} voucher voided=${voided}`);
          return NextResponse.json({ success: true, isFree: true, orderId, status: 'processing', amountPaid: '0.00', couponApplied: true });
        }
        if (result.success && result.audioUrl) {
          await prisma.order.update({
            where: { id: orderId },
            data: { status: 'success', audioUrl: result.audioUrl, lyrics: result.lyrics || null, title: result.title || null, coverImageUrl: result.coverImageUrl || null, duration: result.duration || null, aiRequestId: result.requestId || null },
          });
          return NextResponse.json({ success: true, isFree: true, orderId, status: 'success', amountPaid: '0.00', couponApplied: true });
        }
        // generation failed
        await prisma.order.update({ where: { id: orderId }, data: { status: 'failed', aiRequestId: result.requestId || null } });
        return NextResponse.json({ success: false, error: result.error || 'Song generation failed' }, { status: 500 });
      } catch (genErr) {
        console.error(`${reqId} FREE generation exception:`, genErr);
        await prisma.order.update({ where: { id: orderId }, data: { status: 'failed' } });
        return NextResponse.json({ success: false, error: 'Song generation failed' }, { status: 500 });
      }
    }

    const { clientId, clientSecret, baseUrl, mode } = getPayPalConfig();

    if (!clientId || !clientSecret) {
      console.error(`${reqId} PayPal credentials not configured for mode=${mode}`);
      return NextResponse.json(
        {
          success: false,
          error: `PayPal credentials not configured for ${mode} mode. Please set PAYPAL_CLIENT_ID_SANDBOX and PAYPAL_CLIENT_SECRET_SANDBOX (or _LIVE) in .env`,
        },
        { status: 500 }
      );
    }

    // 1. Get access token
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

    // 2. Create PayPal Order with intent=CAPTURE
    const appBaseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
    const orderResponse = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        // Recommended header for PayPal (idempotency / tracking)
        'PayPal-Request-Id': orderId,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: PURCHASE_CURRENCY,
              value: payAmount,
              breakdown: {
                item_total: {
                  currency_code: PURCHASE_CURRENCY,
                  value: payAmount,
                },
              },
            },
            description: `AI Personalized Song - ${genre} for ${recipientName}`,
            custom_id: orderId,
            items: [
              {
                name: `AI Personalized ${genre} Song`,
                description: `Custom song for ${recipientName}`,
                quantity: '1',
                unit_amount: {
                  currency_code: PURCHASE_CURRENCY,
                  value: payAmount,
                },
              },
            ],
          },
        ],
        application_context: {
          brand_name: 'AI Music Generator',
          landing_page: 'BILLING',
          user_action: 'PAY_NOW',
          shipping_preference: 'NO_SHIPPING',
          return_url: `${appBaseUrl}/order-status?order_id=${orderId}&provider=paypal`,
          cancel_url: `${appBaseUrl}/`,
        },
      }),
    });

    if (!orderResponse.ok) {
      const orderError = await orderResponse.json().catch(() => ({ status: orderResponse.status }));
      console.error(`${reqId} PayPal create order failed:`, orderError);
      return NextResponse.json(
        { success: false, error: 'Failed to create PayPal order' },
        { status: 500 }
      );
    }

    const orderData = await orderResponse.json();

    await prisma.order.update({
      where: { id: orderId },
      data: { paymentOrderId: orderData.id },
    });

    console.log(`${reqId} SUCCESS orderId=${orderId} paymentOrderId=${orderData.id} elapsed=${Date.now() - t0}ms`);

    return NextResponse.json({
      success: true,
      orderId,
      // Returned as paymentOrderId (generic) — frontend PayPalButton uses this value
      // as PayPal Order ID for SDK. Renaming to paymentOrderId keeps the DB field
      // decoupled from any specific payment provider.
      paymentOrderId: orderData.id,
      links: orderData.links,
      // Pricing/coupon info so the frontend can surface "you saved $X".
      amountPaid: payAmount,
      basePrice: basePrice.toFixed(2),
      // Regular (pre-promo) list price so the UI can show "was $9.90, now $5.00".
      regularPrice: REGULAR_PRICE,
      couponApplied: appliedCouponValue > 0,
      couponValue: appliedCouponValue > 0 ? appliedCouponValue.toFixed(2) : null,
    });
  } catch (error) {
    console.error(`${reqId} PayPal create-order exception:`, error);
    return NextResponse.json(
      { success: false, error: 'Failed to create order' },
      { status: 500 }
    );
  }
}
