'use client';

import { useEffect, useState } from 'react';
import { X, Link2, Share2 } from 'lucide-react';
import { SHARE_PLATFORMS, canUseNativeShare, type SharePayload } from '@/lib/share';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  payload: SharePayload; // url, title, text
  /** Optional callback fired once after the user chooses a share action (e.g. to award a coupon). */
  onShared?: () => void;
}

export default function ShareModal({ isOpen, onClose, payload, onShared }: ShareModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) setCopied(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const shareViaNative = async () => {
    if (canUseNativeShare() && navigator.share) {
      try {
        await navigator.share({
          title: payload.title,
          text: payload.text,
          url: payload.url,
        });
        onShared?.();
        onClose();
      } catch (e) {
        if ((e as { name?: string })?.name !== 'AbortError') {
          // native failed — fall through to the platform list below
        }
      }
    }
  };

  const shareViaPlatform = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer,width=720,height=600');
    onShared?.();
  };

  const copyLink = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload.url);
      } else {
        const ta = document.createElement('textarea');
        ta.value = payload.url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      onShared?.();
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('[share] copy failed', e);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white border-2 border-base-content rounded-2xl p-6 w-full max-w-md shadow-xl animate-in fade-in zoom-in duration-150 sm:mb-0">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-xl font-bold text-base-content flex items-center gap-2">
            <Share2 className="w-5 h-5" /> Share
          </h3>
          <button onClick={onClose} className="p-2 text-base-content/60 hover:text-base-content rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Native share shortcut (mobile): opens the OS share sheet with every app */}
        {canUseNativeShare() && (
          <button
            type="button"
            onClick={shareViaNative}
            className="w-full mb-4 bg-primary text-white font-bold py-3 px-4 rounded-xl border-2 border-base-content hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            <Share2 className="w-5 h-5" />
            Share to your apps (Messages, Facebook, WhatsApp…)
          </button>
        )}

        <div className="grid grid-cols-3 gap-3">
          {SHARE_PLATFORMS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => shareViaPlatform(p.buildUrl(payload))}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-base-300 hover:border-base-content hover:bg-base-200 transition-colors"
              style={{ ['--brand' as string]: p.color }}
            >
              <span className="text-2xl" style={{ filter: `drop-shadow(0 1px 1px rgba(0,0,0,0.15))` }}>{p.icon}</span>
              <span className="text-xs font-semibold text-base-content/80">{p.label}</span>
            </button>
          ))}

          {/* Copy link */}
          <button
            type="button"
            onClick={copyLink}
            className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-base-300 hover:border-base-content hover:bg-base-200 transition-colors"
          >
            <span className="text-2xl"><Link2 className="w-6 h-6 text-base-content/80" /></span>
            <span className="text-xs font-semibold text-base-content/80">{copied ? 'Copied!' : 'Copy Link'}</span>
          </button>
        </div>

        <p className="text-center text-base-content/60 text-sm mt-4">
          {payload.title || 'Share'} — link: <span className="break-all">{payload.url}</span>
        </p>
      </div>
    </div>
  );
}
