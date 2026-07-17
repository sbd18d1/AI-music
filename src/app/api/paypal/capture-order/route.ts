import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/db/client';
import { generateSong } from '@/lib/ai-music';
import { sendSongEmail } from '@/lib/email';

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
    const { orderId, paypalOrderId, token, payerId } = body;

    if (!orderId || !paypalOrderId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    if (order.status !== 'pending') {
      return NextResponse.json({
        success: true,
        status: order.status,
        message: 'Order already processed',
      });
    }

    const AI_GENERATION_MODE = process.env.NEXT_PUBLIC_AI_GENERATION_MODE || 'mock';
    
    if (AI_GENERATION_MODE === 'mock') {
      console.log(`[${new Date().toISOString()}] MOCK MODE: Skipping PayPal capture, proceeding to song generation`);
    } else {
      const { clientId, clientSecret, baseUrl } = getPayPalConfig();

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
        console.error(`[${new Date().toISOString()}] PayPal auth failed in capture:`, authError);
        return NextResponse.json(
          { error: 'Failed to authenticate with PayPal' },
          { status: 500 }
        );
      }

      const authData = await authResponse.json();
      const accessToken = authData.access_token;

      const captureResponse = await fetch(
        `${baseUrl}/v2/checkout/orders/${paypalOrderId}/capture`,
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
          console.error(`[${new Date().toISOString()}] PayPal capture failed:`, captureError);
          return NextResponse.json(
            { error: 'Payment capture failed' },
            { status: 500 }
          );
        }
      }

      console.log(`[${new Date().toISOString()}] PayPal payment captured:`, paypalOrderId);
    }

    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'processing',
        paypalOrderId: paypalOrderId,
      },
    });

    try {
      const result = await generateSong({
        recipientName: order.recipientName,
        personality: order.personality,
        genre: order.genre,
        isPreview: false,
        selectedStyle: order.selectedStyle || order.genre,
        selectedArtistStyle: order.selectedArtistStyle ?? undefined,
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
          },
        });
        console.log(`[${new Date().toISOString()}] Full song generation successful! Order: ${orderId}`);
        
        const emailToSend = order.customerEmail || customerEmail;
        if (emailToSend) {
          try {
            await sendSongEmail({
              email: emailToSend,
              recipientName: order.recipientName,
              audioUrl: result.audioUrl!,
              title: result.title,
              lyrics: result.lyrics,
              orderId: orderId,
            });
            console.log(`[${new Date().toISOString()}] Email sent successfully to: ${emailToSend}`);
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

    return NextResponse.json({
      success: true,
      status: 'processing',
      message: 'Payment captured and song generation started',
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] PayPal capture-order error:`, error);
    return NextResponse.json(
      { error: 'Failed to capture order' },
      { status: 500 }
    );
  }
}
