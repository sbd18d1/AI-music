import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/db/client';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const maxDuration = 60;

const CreateOrderSchema = z.object({
  recipientName: z.string().min(1).max(100),
  // Always validate the user's description before any paid song starts generating —
  // empty/whitespace must be rejected, not defaulted to a placeholder.
  personality: z.string().trim().min(1).max(1000),
  genre: z.string().min(1).max(100),
  selectedStyle: z.string().optional(),
  selectedArtistStyle: z.string().optional(),
  userEmail: z.string().email().optional(),
  songConfig: z.any().optional(),
  trialOrderId: z.string().optional(),
});

// Price for the full song purchase (USD)
const PURCHASE_PRICE = '9.90';
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
    } = result.data;

    const orderId = crypto.randomUUID();

    console.log(`${reqId} START orderId=${orderId} email=${userEmail || 'N/A'} trialOrderId=${trialOrderId || 'N/A'}`);

    // If trialOrderId is provided, verify it exists and copy song data from the trial order
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

      if (
        trialOrder &&
        !trialOrder.isFullVersion &&
        trialOrder.status === 'success' &&
        trialOrder.audioUrl
      ) {
        trialOrderData = {
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
        ipAddress: trialOrderData?.ipAddress || null,
        deviceId: trialOrderData?.deviceId || null,
        audioUrl: trialOrderData?.audioUrl || null,
        lyrics: trialOrderData?.lyrics || null,
        title: trialOrderData?.title || null,
        coverImageUrl: trialOrderData?.coverImageUrl || null,
        duration: trialOrderData?.duration || null,
      },
    });

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
              value: PURCHASE_PRICE,
              breakdown: {
                item_total: {
                  currency_code: PURCHASE_CURRENCY,
                  value: PURCHASE_PRICE,
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
                  value: PURCHASE_PRICE,
                },
              },
            ],
          },
        ],
        application_context: {
          brand_name: 'AI Music Generator',
          landing_page: 'LOGIN',
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
    });
  } catch (error) {
    console.error(`${reqId} PayPal create-order exception:`, error);
    return NextResponse.json(
      { success: false, error: 'Failed to create order' },
      { status: 500 }
    );
  }
}
