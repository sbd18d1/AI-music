import { Metadata } from 'next';
import SongPageClient from '@/app/song/[id]/SongPageClient';

// Demo share page: renders the sample song so the owner can preview how a
// Facebook/Twitter share card looks (og:image, title, description) using the
// sample music content — without needing a real paid order / DB lookup.
const DEMO_SONG = {
  id: 'demo',
  title: "Jeff's Retired Now",
  recipientName: 'Jeff',
  genre: 'Pop',
  audioUrl: '/test-song.mp3',
  lyrics:
    "[Verse 1]\nJeff put her badge in a drawer\nSaid, \"I won't need that anymore\"\nNow the alarm clock lost its fight\nWe sleep in like kings tonight\n\n[Chorus]\nJeff's retired now, oh my\nJeff's retired now\nShe can binge and she can fly\nMade every day a holiday\nJeff's retired now",
  coverImageUrl:
    'https://file.302.ai/gpt/imgs/20260803/5a43128ba0404d08b8ef9210abc91d85.jpeg',
  duration: '180',
  status: 'success',
};

export const metadata: Metadata = {
  title: `🎵 A Special Pop Song for Jeff`,
  description: `Listen to the custom pop melody "Jeff's Retired Now" built from family memories. Made with love.`,
  openGraph: {
    title: `🎵 Jeff's Retired Now — A Song for Jeff`,
    description: 'A custom AI-generated pop song celebrating retirement. Made with love by Smart Music Lab.',
    url: `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/demo`,
    siteName: 'Smart Music Lab',
    images: [
      {
        url: DEMO_SONG.coverImageUrl,
        width: 1200,
        height: 630,
        alt: 'Demo album cover',
      },
    ],
    locale: 'en_US',
    type: 'music.song',
  },
  twitter: {
    card: 'summary_large_image',
    title: "🎵 Jeff's Retired Now — A Song for Jeff",
    images: [DEMO_SONG.coverImageUrl],
  },
};

export default function DemoPage() {
  return <SongPageClient songData={DEMO_SONG} />;
}
