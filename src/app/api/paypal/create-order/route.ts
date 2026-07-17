import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/db/client';
import { z } from 'zod';

const CreateOrderSchema = z.object({
  recipientName: z.string().min(1).max(100),
  personality: z.string().max(1000).optional(),
  genre: z.string().min(1).max(100),
  selectedStyle: z.string().optional(),
  selectedArtistStyle: z.string().optional(),
  userEmail: z.string().email().optional(),
});

function getPayPalConfig() {
  const AI_GENERATION_MODE = process.env.NEXT_PUBLIC_AI_GENERATION_MODE || 'mock';
  
  if (AI_GENERATION_MODE === 'mock') {
    return {
      clientId: process.env.PAYPAL_CLIENT_ID_SANDBOX || '',
      clientSecret: process.env.PAYPAL_CLIENT_SECRET_SANDBOX || '',
      baseUrl: 'https://api-m.sandbox.paypal.com',
    };
  } else {
    return {
      clientId: process.env.PAYPAL_CLIENT_ID_LIVE || '',
      clientSecret: process.env.PAYPAL_CLIENT_SECRET_LIVE || '',
      baseUrl: 'https://api-m.paypal.com',
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = CreateOrderSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input: ' + JSON.stringify(result.error) },
        { status: 400 }
      );
    }

    const { recipientName, personality, genre, selectedStyle, selectedArtistStyle, userEmail } = result.data;

    const orderId = crypto.randomUUID();

    await prisma.order.create({
      data: {
        id: orderId,
        recipientName,
        personality: personality || '',
        genre,
        selectedStyle,
        selectedArtistStyle,
        customerEmail: userEmail || null,
        status: 'pending',
        isFullVersion: true,
      },
    });

    const { clientId, clientSecret, baseUrl } = getPayPalConfig();

    if (!clientId || !clientSecret) {
      const AI_GENERATION_MODE = process.env.NEXT_PUBLIC_AI_GENERATION_MODE || 'mock';
      return NextResponse.json(
        { error: `PayPal credentials not configured for ${AI_GENERATION_MODE === 'mock' ? 'sandbox' : 'live'} mode` },
        { status: 500 }
      );
    }

    const authResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${clientId}:${clientSecret}`
        ).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
    });

    if (!authResponse.ok) {
      const authError = await authResponse.json().catch(() => ({ status: authResponse.status }));
      console.error(`[${new Date().toISOString()}] PayPal auth failed:`, authError);
      return NextResponse.json(
        { error: 'Failed to authenticate with PayPal' },
        { status: 500 }
      );
    }

    const authData = await authResponse.json();
    const accessToken = authData.access_token;

    const orderResponse = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: 'USD',
              value: '4.99',
              breakdown: {
                item_total: {
                  currency_code: 'USD',
                  value: '4.99',
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
                  currency_code: 'USD',
                  value: '4.99',
                },
              },
            ],
          },
        ],
        application_context: {
          brand_name: 'AI Music Generator',
          landing_page: 'LOGIN',
          user_action: 'PAY_NOW',
          return_url: `${process.env.NEXT_PUBLIC_URL}/order-status?order_id=${orderId}`,
          cancel_url: `${process.env.NEXT_PUBLIC_URL}/`,
        },
      }),
    });

    if (!orderResponse.ok) {
      const orderError = await orderResponse.json().catch(() => ({ status: orderResponse.status }));
      console.error(`[${new Date().toISOString()}] PayPal create order failed:`, orderError);
      return NextResponse.json(
        { error: 'Failed to create PayPal order' },
        { status: 500 }
      );
    }

    const orderData = await orderResponse.json();

    await prisma.order.update({
      where: { id: orderId },
      data: { paypalOrderId: orderData.id },
    });

    console.log(`[${new Date().toISOString()}] PayPal order created:`, orderData.id);

    return NextResponse.json({
      success: true,
      orderId: orderId,
      paypalOrderId: orderData.id,
      links: orderData.links,
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] PayPal create-order error:`, error);
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }
}