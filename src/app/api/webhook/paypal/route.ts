import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/db/client';
import { generateSong } from '@/lib/ai-music';

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

      try {
        const result = await generateSong({
          recipientName: order.recipientName,
          personality: order.personality,
          genre: order.genre,
          isPreview: false,
        });

        if (result.success && result.audioUrl) {
          await prisma.order.update({
            where: { id: orderId },
            data: {
              status: 'success',
              audioUrl: result.audioUrl,
              customerEmail: customerEmail || null,
            },
          });
          console.log(`[${new Date().toISOString()}] Full song generation successful! Order: ${orderId}`);
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

    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] PayPal webhook error:`, error);
    return NextResponse.json({ status: 'success' }, { status: 200 });
  }
}
