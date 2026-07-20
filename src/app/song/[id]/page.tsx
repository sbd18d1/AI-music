import { Metadata, ResolvingMetadata } from 'next';
import { prisma } from '@/db/client';
import { MapGenreToImage } from '@/utils/helpers';
import SongPageClient from './SongPageClient';

interface SongData {
  id: string;
  title: string;
  recipientName: string;
  genre: string;
  audioUrl?: string;
  lyrics?: string;
  coverImageUrl?: string;
  duration?: string;
  status: string;
}

export async function generateMetadata(
  { params }: { params: { id: string } },
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { id } = params;

  let songData: SongData = {
    id,
    title: 'Custom Song',
    recipientName: 'You',
    genre: 'Classic Rock',
    status: 'pending',
  };

  try {
    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (order) {
      songData = {
        id: order.id,
        title: order.title || `${order.recipientName}'s Song`,
        recipientName: order.recipientName,
        genre: order.genre,
        audioUrl: order.audioUrl,
        lyrics: order.lyrics,
        coverImageUrl: order.coverImageUrl,
        duration: order.duration,
        status: order.status,
      };
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Metadata generation error:`, error);
  }

  const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
  
  let imageUrl = songData.coverImageUrl;
  if (!imageUrl) {
    imageUrl = MapGenreToImage(songData.genre);
  } else if (imageUrl.startsWith('/')) {
    imageUrl = `${baseUrl}${imageUrl}`;
  }

  const pageUrl = `${baseUrl}/song/${id}`;

  return {
    title: `🎵 A Special ${songData.genre} Song for ${songData.recipientName || 'You'}`,
    description: `Listen to the custom ${songData.genre} melody built from family memories. Made with love.`,
    openGraph: {
      title: `🎵 A Special ${songData.genre} Song for ${songData.recipientName || 'You'}`,
      description: `Listen to this nostalgic ${songData.genre} track created for our family.`,
      url: pageUrl,
      siteName: 'AI Music Generator',
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: 'Vintage Album Cover',
        },
      ],
      locale: 'en_US',
      type: 'music.song',
    },
    twitter: {
      card: 'summary_large_image',
      title: `🎵 Custom ${songData.genre} Song for ${songData.recipientName}`,
      images: [imageUrl],
    },
  };
}

async function getSongData(id: string): Promise<SongData> {
  const order = await prisma.order.findUnique({
    where: { id },
  });

  if (!order) {
    return {
      id,
      title: 'Custom Song',
      recipientName: 'You',
      genre: 'Classic Rock',
      status: 'pending',
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
  
  let coverImageUrl = order.coverImageUrl;
  if (!coverImageUrl) {
    coverImageUrl = MapGenreToImage(order.genre);
  } else if (coverImageUrl.startsWith('/')) {
    coverImageUrl = `${baseUrl}${coverImageUrl}`;
  }

  return {
    id: order.id,
    title: order.title || `${order.recipientName}'s Song`,
    recipientName: order.recipientName,
    genre: order.genre,
    audioUrl: order.audioUrl,
    lyrics: order.lyrics,
    coverImageUrl,
    duration: order.duration,
    status: order.status,
  };
}

export default async function SongPage({ params }: { params: { id: string } }) {
  const songData = await getSongData(params.id);
  return <SongPageClient songData={songData} />;
}