'use client';

import { useState } from 'react';
import { Music, Clock, ArrowLeft, Share2 } from 'lucide-react';
import VintageAudioPlayer from '@/components/VintageAudioPlayer';
import ShareModal from '@/components/ShareModal';
import { openNativeShare, type SharePayload } from '@/lib/share';

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
  const [shareOpen, setShareOpen] = useState(false);
  const [sharePayload, setSharePayload] = useState<SharePayload>({ url: '', title: '', text: '' });

  const handleShare = async () => {
    const payload: SharePayload = {
      url: `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/song/${songData.id}`,
      title: `🎵 ${songData.title} — a custom song made on Smart Music Lab`,
      text: `Listen to this special song for ${songData.recipientName}! Made with love on Smart Music Lab.`,
    };
    const usedNative = await openNativeShare(payload);
    if (!usedNative) {
      setSharePayload(payload);
      setShareOpen(true);
    }
  };

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

            {/* CTA: invite new visitors to try making their own song */}
            <a
              href="/?utm_source=share"
              className="mt-6 inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold py-3 px-8 rounded-xl border-2 border-base-content shadow-sm hover:shadow-md transition-all text-lg"
            >
              🎵 Make Your Own Song — Try It Free
            </a>
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
                duration={songData.duration}
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
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleShare}
                  className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold py-2.5 px-7 rounded-xl border-2 border-base-content shadow-sm hover:shadow-md transition-all text-base"
                >
                  <Share2 className="w-5 h-5" />
                  Share to Friends
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-base-content/60 text-sm">
              🔒 100% Personal Copyright: This song belongs to you. Share it with family and friends!
            </p>
          </div>

          <div className="mt-8 pt-8 border-t-2 border-base-300/20 text-center">
            <p className="text-base-content/80 text-lg mb-4">
              Loved this song? Create a personalized one for someone special.
            </p>
            <a
              href="/?utm_source=share_bottom"
              className="inline-flex items-center gap-2 bg-base-200 hover:bg-base-300 border-2 border-base-content text-base-content font-bold py-3 px-8 rounded-xl transition-colors text-lg"
            >
              ✨ Start Your Own Song — Free Preview
            </a>
          </div>
        </div>
      </div>

      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        payload={sharePayload}
      />
    </div>
  );
}
