import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/db/client';
import { generateSong } from '@/lib/ai-music';

const generateSchema = z.object({
  recipientName: z.string().min(1).max(100),
  personality: z.string().min(5).max(1000),
  genre: z.string().min(1).max(100),
  selectedStyle: z.string().optional(),
  selectedArtistStyle: z.string().optional(),
});

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  const ip = request.ip;
  return ip || 'unknown';
}

async function checkTrialLimit(ipAddress: string): Promise<boolean> {
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const usageCount = await prisma.trialUsage.count({
    where: {
      ipAddress,
      usedAt: {
        gte: oneDayAgo,
      },
    },
  });

  return usageCount >= 1;
}

async function recordTrialUsage(ipAddress: string): Promise<void> {
  await prisma.trialUsage.create({
    data: {
      ipAddress,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const ipAddress = getClientIp(request);
    console.log(`[${new Date().toISOString()}] Trial request from IP: ${ipAddress}`);

    const AI_GENERATION_MODE = process.env.NEXT_PUBLIC_AI_GENERATION_MODE || 'mock';
    
    if (AI_GENERATION_MODE !== 'mock') {
      const hasUsedTrial = await checkTrialLimit(ipAddress);
      if (hasUsedTrial) {
        console.log(`[${new Date().toISOString()}] Trial limit exceeded for IP: ${ipAddress}`);
        return NextResponse.json(
          {
            success: false,
            error: 'Free trial limit exceeded. Please purchase the full version for $4.99.',
            showUpgrade: true,
          },
          { status: 429 }
        );
      }
    }

    const body = await request.json();

    let recipientName = body.recipientName || 'Gift Recipient';
    let personality = body.personality || '';
    let genre = body.genre || 'Classic Rock';
    let selectedStyle = body.selectedStyle || genre;
    let selectedArtistStyle = body.selectedArtistStyle || 'None';
    const songConfig = body.songConfig || undefined;

    if (AI_GENERATION_MODE === 'mock') {
      if (!personality || personality.length < 5) {
        personality = "I want a warm, nostalgic Country song for my husband Bob's 70th birthday. He spent 40 years as a petroleum pipe-fitter in Houston and now loves fishing on Lake Conroe. Please thank him for working so hard for our three kids, and let him know how much we love him.";
      }
    } else {
      const validation = generateSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Invalid input', details: validation.error.issues },
          { status: 400 }
        );
      }
      ({ recipientName, personality, genre, selectedStyle, selectedArtistStyle } = validation.data);
    }

    const order = await prisma.order.create({
      data: {
        recipientName,
        personality,
        genre,
        selectedStyle,
        selectedArtistStyle,
        songConfig: songConfig ? JSON.stringify(songConfig) : null,
        status: 'testing',
        isFullVersion: false,
      },
    });

    const aiResponse = await generateSong({
      recipientName,
      personality,
      genre,
      isPreview: AI_GENERATION_MODE === 'mock',
      selectedStyle,
      selectedArtistStyle,
      songConfig,
      waitForResult: AI_GENERATION_MODE === 'mock',
    });

    if (aiResponse.success && aiResponse.requestId && !aiResponse.audioUrl) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'generating',
          aiRequestId: aiResponse.requestId,
        },
      });

      console.log(`[${new Date().toISOString()}] Trial submitted for IP: ${ipAddress}, order: ${order.id}, taskId: ${aiResponse.requestId}`);

      return NextResponse.json({
        success: true,
        status: 'generating',
        taskId: aiResponse.requestId,
        orderId: order.id,
      });
    }

    if (aiResponse.success && aiResponse.audioUrl) {
      if (AI_GENERATION_MODE !== 'mock') {
        await recordTrialUsage(ipAddress);
      }

      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'success',
          audioUrl: aiResponse.audioUrl,
          aiRequestId: aiResponse.requestId,
          lyrics: aiResponse.lyrics || null,
          title: aiResponse.title || null,
          coverImageUrl: aiResponse.coverImageUrl || null,
          duration: aiResponse.duration || null,
        },
      });

      console.log(`[${new Date().toISOString()}] Trial successful for IP: ${ipAddress}, order: ${order.id}`);

      return NextResponse.json({
        success: true,
        audioUrl: aiResponse.audioUrl,
        orderId: order.id,
        isPreview: AI_GENERATION_MODE === 'mock',
        lyrics: aiResponse.lyrics,
        title: aiResponse.title,
        coverImageUrl: aiResponse.coverImageUrl,
        duration: aiResponse.duration,
      });
    } else {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'failed',
          aiRequestId: aiResponse.requestId,
        },
      });

      return NextResponse.json(
        {
          success: false,
          error: aiResponse.error || 'Failed to generate song',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Trial generation error:`, error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}