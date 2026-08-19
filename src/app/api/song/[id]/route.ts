import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/db/client';
import { MapGenreToImage } from '@/utils/helpers';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const maxDuration = 300;

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Song not found' },
        { status: 404 }
      );
    }

    // Resolve to a frontend-playable URL: remote http(s) CDN URLs served directly
    // (playable on mobile + no slow proxy), only /api/stream-audio for local-ish paths.
    const audioUrlForFrontend = order.audioUrl
      ? (order.audioUrl.startsWith('/audio/') || /^https?:\/\//i.test(order.audioUrl)
          ? order.audioUrl
          : `/api/stream-audio/${order.id}`)
      : null;

    let coverImageUrl = order.coverImageUrl;
    if (!coverImageUrl) {
      coverImageUrl = MapGenreToImage(order.genre);
    } else if (coverImageUrl.startsWith('/')) {
      const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
      coverImageUrl = `${baseUrl}${coverImageUrl}`;
    }

    return NextResponse.json({
      success: true,
      song: {
        id: order.id,
        title: order.title || `${order.recipientName}'s Song`,
        recipientName: order.recipientName,
        genre: order.genre,
        audioUrl: audioUrlForFrontend,
        lyrics: order.lyrics,
        coverImageUrl,
        duration: order.duration,
        status: order.status,
      },
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Song fetch error:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch song' },
      { status: 500 }
    );
  }
}