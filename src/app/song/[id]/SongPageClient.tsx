'use client';

import { Music, Clock, ArrowLeft } from 'lucide-react';
import VintageAudioPlayer from '@/components/VintageAudioPlayer';

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

export default function SongPageClient({ songData }: { songData: SongData }) {
  return (
    <div className="min-h-screen bg-base-100">
      <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
        <div className="bg-base-200/80 border border-base-300 rounded-xl p-6 md:p-10 shadow-vintage">
          <div className="flex items-center gap-3 mb-8">
            <a href="/" className="text-base-content/60 hover:text-base-content transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </a>
            <span className="text-base-content/80 font-medium">Back to Home</span>
          </div>

          <div className="text-center mb-8">
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-base-content mb-4">
              "{songData.title}"
            </h1>
            <p className="text-base-content/80 text-lg">
              Created for <span className="font-bold">{songData.recipientName}</span>
            </p>
            <div className="flex items-center justify-center gap-4 mt-3">
              <span className="inline-flex items-center gap-2 text-primary">
                <Music className="w-5 h-5" />
                {songData.genre}
              </span>
              {songData.duration && (
                <span className="inline-flex items-center gap-2 text-base-content/60">
                  <Clock className="w-5 h-5" />
                  {songData.duration}
                </span>
              )}
            </div>
          </div>

          <div className="flex justify-center mb-8">
            <div className="relative">
              <img
                src={songData.coverImageUrl}
                alt={`${songData.title} Cover`}
                className="w-full max-w-md md:max-w-lg rounded-xl shadow-vintage-lg border-4 border-base-300 object-cover"
                style={{ height: '315px', objectFit: 'cover' }}
              />
              <div className="absolute inset-0 bg-base-content/0 hover:bg-base-content/10 rounded-xl transition-colors"></div>
            </div>
          </div>

          <div className="bg-base-200/80 border border-base-300 rounded-xl p-6 mb-8">
            {songData.audioUrl ? (
              <VintageAudioPlayer 
                src={songData.audioUrl} 
                controlsList="nodownload"
                isPreview={false}
              />
            ) : (
              <div className="text-center py-8">
                <div className="text-6xl mb-4">🎵</div>
                <p className="text-base-content/60 text-lg">Audio not available</p>
              </div>
            )}
          </div>

          {songData.lyrics && (
            <div className="bg-base-200/80 border border-base-300 rounded-xl p-6">
              <h3 className="font-serif text-xl font-bold text-base-content mb-4">📝 Lyrics</h3>
              <p className="text-base-content text-lg leading-relaxed whitespace-pre-wrap">
                {songData.lyrics}
              </p>
            </div>
          )}

          <div className="mt-8 pt-6 border-t-2 border-base-300/20">
            <div className="text-center">
              <p className="text-base-content/80 text-lg mb-4">
                Share this special song with your loved ones!
              </p>
              <div className="flex justify-center gap-4">
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(process.env.NEXT_PUBLIC_URL || 'http://localhost:3000')}/song/${songData.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-xl border-2 border-base-content shadow-sm hover:shadow-md transition-all"
                >
                  Share on Facebook
                </a>
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Listen to this special song for ${songData.recipientName}!`)})&url=${encodeURIComponent(process.env.NEXT_PUBLIC_URL || 'http://localhost:3000')}/song/${songData.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-sky-500 hover:bg-sky-600 text-white font-bold py-2 px-6 rounded-xl border-2 border-base-content shadow-sm hover:shadow-md transition-all"
                >
                  Share on Twitter
                </a>
              </div>
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-base-content/60 text-sm">
              🔒 100% Personal Copyright: This song belongs to you. Share it with family and friends!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
