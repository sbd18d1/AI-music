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
        audioUrl: order.audioUrl || undefined,
        lyrics: order.lyrics || undefined,
        coverImageUrl: order.coverImageUrl || undefined,
        duration: order.duration || undefined,
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

  // Share card built from the song itself. Do NOT splice in `genre`/`recipientName`:
  // the app never actually collects them (the client sends the literal "Gift
  // Recipient" and a default genre), so including them produced cards that were
  // wrong in both halves.
  const shareTitle = songData.title || 'A Personalized Song';
  const shareDescription =
    'Listen to a one-of-a-kind song created with AI on Smart Music Lab.';

  // Absolute, publicly fetchable URL. Social crawlers (X, Facebook, WhatsApp) require
  // an absolute image URL and will silently render a bare link if they cannot fetch
  // it — which is why the card showed no picture.
  const ogImage = /^https?:\/\//i.test(imageUrl) ? imageUrl : `${baseUrl}${imageUrl}`;

  return {
    title: `🎵 ${shareTitle}`,
    description: shareDescription,
    openGraph: {
      title: `🎵 ${shareTitle}`,
      description: shareDescription,
      url: pageUrl,
      siteName: 'Smart Music Lab',
      images: [
        {
          url: ogImage,
          // The generated cover is square-ish; X/Facebook prefer 1.91:1 but will
          // crop a larger image rather than drop it.
          width: 1200,
          height: 630,
          alt: shareTitle,
        },
      ],
      locale: 'en_US',
      type: 'music.song',
    },
    twitter: {
      card: 'summary_large_image',
      title: `🎵 ${shareTitle}`,
      description: shareDescription,
      images: [ogImage],
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

  // Duration safety: ensure valid number > 0, fallback to 180s so UI never shows 0:00
  const rawDur = order.duration;
  const durNum = rawDur ? parseFloat(rawDur) : NaN;
  const safeDuration = (isFinite(durNum) && durNum > 0) ? String(durNum) : '180';

  return {
    id: order.id,
    title: order.title || `${order.recipientName}'s Song`,
    recipientName: order.recipientName,
    genre: order.genre,
    audioUrl: order.audioUrl || undefined,
    lyrics: order.lyrics || undefined,
    coverImageUrl,
    duration: safeDuration,
    status: order.status,
  };
}

export default async function SongPage({ params }: { params: { id: string } }) {
  const songData = await getSongData(params.id);
  return <SongPageClient songData={songData} />;
}