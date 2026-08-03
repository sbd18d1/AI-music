import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/db/client';
import { z } from 'zod';

const CreateTransactionSchema = z.object({
  recipientName: z.string().min(1).max(100),
  personality: z.string().max(1000).optional(),
  genre: z.string().min(1).max(100),
  selectedStyle: z.string().optional(),
  selectedArtistStyle: z.string().optional(),
  userEmail: z.string().email().optional(),
  songConfig: z.any().optional(),
  trialOrderId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = CreateTransactionSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input: ' + JSON.stringify(result.error) },
        { status: 400 }
      );
    }

    const { recipientName, personality, genre, selectedStyle, selectedArtistStyle, userEmail, songConfig, trialOrderId } = result.data;

    const orderId = crypto.randomUUID();

    let trialOrderData: {
      audioUrl?: string;
      lyrics?: string | null;
      title?: string | null;
      coverImageUrl?: string | null;
      duration?: string | null;
      deviceId?: string | null;
      ipAddress?: string | null;
    } | null = null;

    if (trialOrderId) {
      const trialOrder = await prisma.order.findUnique({
        where: { id: trialOrderId },
      });

      if (!trialOrder) {
        return NextResponse.json(
          { error: 'Trial order not found' },
          { status: 404 }
        );
      }

      if (trialOrder.isFullVersion || trialOrder.status !== 'success') {
        return NextResponse.json(
          { error: 'Invalid trial order' },
          { status: 400 }
        );
      }

      trialOrderData = {
        audioUrl: trialOrder.audioUrl || undefined,
        lyrics: trialOrder.lyrics,
        title: trialOrder.title,
        coverImageUrl: trialOrder.coverImageUrl,
        duration: trialOrder.duration,
        deviceId: trialOrder.deviceId,
        ipAddress: trialOrder.ipAddress,
      };
    }

    await prisma.order.create({
      data: {
        id: orderId,
        recipientName,
        personality: personality || '',
        genre,
        selectedStyle: selectedStyle || null,
        selectedArtistStyle: selectedArtistStyle || null,
        customerEmail: userEmail || null,
        songConfig: songConfig ? JSON.stringify(songConfig) : null,
        status: 'pending',
        isFullVersion: true,
        trialOrderId: trialOrderId || null,
        deviceId: trialOrderData?.deviceId || null,
        ipAddress: trialOrderData?.ipAddress || null,
        audioUrl: trialOrderData?.audioUrl || null,
        lyrics: trialOrderData?.lyrics || null,
        title: trialOrderData?.title || null,
        coverImageUrl: trialOrderData?.coverImageUrl || null,
        duration: trialOrderData?.duration || null,
      },
    });

    console.log(`[${new Date().toISOString()}] Local order created:`, orderId);

    return NextResponse.json({
      success: true,
      orderId,
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Create-order error:`, error);
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }
}
