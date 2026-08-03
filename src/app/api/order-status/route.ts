import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/db/client';
import { generateSong } from '@/lib/ai-music';
import { sendSongEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const maxDuration = 300;

// PUT: Called by frontend when checkout.completed fires (works without webhook)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, paddleTransactionId } = body;

    if (!orderId) {
      return NextResponse.json(
        { error: 'Missing orderId' },
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

    // Already processed, just return
    if (order.status === 'success') {
      return NextResponse.json({
        success: true,
        message: 'Order already completed',
        orderId: order.id,
        status: order.status,
      });
    }

    // Save paddleTransactionId and start fulfillment
    console.log(`[${new Date().toISOString()}] Payment completed for order: ${orderId}, starting fulfillment`);

    const trialOrderId = order.trialOrderId;
    let finalAudioUrl = order.audioUrl || null;
    let finalLyrics = order.lyrics || null;
    let finalTitle = order.title || null;
    let finalCoverImageUrl = order.coverImageUrl || null;
    let finalDuration = order.duration || null;

    // Check trial order for existing audio
    if (trialOrderId) {
      const trialOrder = await prisma.order.findUnique({
        where: { id: trialOrderId },
      });

      if (trialOrder && trialOrder.audioUrl) {
        console.log(`[${new Date().toISOString()}] Using trial order song for: ${orderId}`);
        finalAudioUrl = trialOrder.audioUrl;
        finalLyrics = trialOrder.lyrics;
        finalTitle = trialOrder.title;
        finalCoverImageUrl = trialOrder.coverImageUrl;
        finalDuration = trialOrder.duration;
      }
    }

    // If we already have audio (from trial), mark as success immediately
    if (finalAudioUrl) {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'success',
          paddleTransactionId: paddleTransactionId || order.paddleTransactionId,
          audioUrl: finalAudioUrl,
          lyrics: finalLyrics,
          title: finalTitle,
          coverImageUrl: finalCoverImageUrl,
          duration: finalDuration,
        },
      });

      // Send email
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
          console.log(`[${new Date().toISOString()}] Email sent to: ${order.customerEmail}`);
        } catch (emailError) {
          console.error(`[${new Date().toISOString()}] Email failed:`, emailError);
        }
      }

      return NextResponse.json({
        success: true,
        orderId,
        status: 'success',
      });
    }

    // No audio yet - mark as processing and generate song
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'processing',
        paddleTransactionId: paddleTransactionId || order.paddleTransactionId,
      },
    });

    // Generate full song
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
            console.error(`[${new Date().toISOString()}] Email failed:`, emailError);
          }
        }

        return NextResponse.json({
          success: true,
          orderId,
          status: 'success',
        });
      } else {
        await prisma.order.update({
          where: { id: orderId },
          data: { status: 'failed' },
        });
        return NextResponse.json({
          success: false,
          orderId,
          status: 'failed',
          error: 'Song generation failed',
        });
      }
    } catch (generationError) {
      console.error(`[${new Date().toISOString()}] Song generation error:`, generationError);
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'failed' },
      });
      return NextResponse.json({
        success: false,
        orderId,
        status: 'failed',
        error: 'Song generation exception',
      });
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Update order status error:`, error);
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const urlParams = new URLSearchParams(request.url.split('?')[1]);
    const orderId = urlParams.get('order_id');

    if (!orderId) {
      return NextResponse.json(
        { error: 'Missing order_id parameter' },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    console.log(`[${new Date().toISOString()}] GET order-status for ${orderId}: status=${order?.status}, paddleTxId=${order?.paddleTransactionId}`);

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Local paths are served directly; remote Suno URLs go through /api/stream-audio/{orderId}
    const audioUrlForFrontend = order.audioUrl
      ? (order.audioUrl.startsWith('/audio/') 
          ? order.audioUrl 
          : `/api/stream-audio/${order.id}`)
      : null;

    return NextResponse.json({
      success: true,
      _debugTs: Date.now(),
      order: {
        id: order.id,
        recipientName: order.recipientName,
        genre: order.genre,
        status: order.status,
        audioUrl: audioUrlForFrontend,
        lyrics: order.lyrics,
        title: order.title,
        coverImageUrl: order.coverImageUrl,
        duration: order.duration,
        createdAt: order.createdAt.toISOString(),
      },
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      },
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Order status error:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch order status' },
      { status: 500 }
    );
  }
}
