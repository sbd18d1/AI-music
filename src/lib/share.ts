'use client';

export interface SharePayload {
  url: string;
  title?: string;
  text?: string;
}

export interface SharePlatform {
  key: string;
  label: string;
  icon: string; // emoji
  color: string; // tailwind bg class
  buildUrl: (p: SharePayload) => string;
  target?: string;
}

/** Do we have the browser-native share sheet? (mobile + supported desktop Safari/Chrome) */
export const canUseNativeShare = (): boolean =>
  typeof navigator !== 'undefined' && typeof navigator.share === 'function';

/**
 * Open the native share sheet when available. The OS uses the user's installed
 * apps (Facebook, WhatsApp, Messenger, iMessage, Telegram, copy link, …) — the
 * mature "share anywhere" experience. Returns false if native share is unavailable
 * (the caller should fall back to a custom modal).
 */
export async function openNativeShare(payload: SharePayload): Promise<boolean> {
  if (!canUseNativeShare()) return false;
  try {
    await navigator.share({
      title: payload.title,
      text: payload.text,
      url: payload.url,
    });
    return true; // shared (or user cancelled) — handled natively
  } catch (e) {
    // User cancelled or AbortError — treat as "handled" so we don't also pop a modal.
    if ((e as { name?: string })?.name === 'AbortError') return true;
    // Something else (e.g. permission) — allow fallback.
    console.warn('[share] native share failed, falling back:', e);
    return false;
  }
}

/** Fallback platform share links for the custom modal (desktop / no native share). */
export const SHARE_PLATFORMS: SharePlatform[] = [
  {
    key: 'facebook',
    label: 'Facebook',
    icon: '📘',
    color: '#1877F2',
    buildUrl: (p) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(p.url)}`,
  },
  {
    key: 'x',
    label: 'X (Twitter)',
    icon: '✖️',
    color: '#000000',
    buildUrl: (p) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(p.text || p.title || '')}&url=${encodeURIComponent(p.url)}&via=SmartMusicLab`,
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    icon: '💬',
    color: '#25D366',
    buildUrl: (p) =>
      `https://wa.me/?text=${encodeURIComponent(`${p.title || ''} ${p.url}`)}`,
  },
  {
    key: 'telegram',
    label: 'Telegram',
    icon: '✈️',
    color: '#229ED9',
    buildUrl: (p) =>
      `https://t.me/share/url?url=${encodeURIComponent(p.url)}&text=${encodeURIComponent(p.text || p.title || '')}`,
  },
  {
    key: 'messenger',
    label: 'Messenger',
    icon: '💙',
    color: '#0084FF',
    buildUrl: (p) =>
      `fb-messenger://share/?link=${encodeURIComponent(p.url)}`,
  },
  {
    key: 'reddit',
    label: 'Reddit',
    icon: '👽',
    color: '#FF4500',
    buildUrl: (p) =>
      `https://www.reddit.com/submit?url=${encodeURIComponent(p.url)}&title=${encodeURIComponent(p.title || '')}`,
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    icon: '💼',
    color: '#0A66C2',
    buildUrl: (p) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(p.url)}`,
  },
  {
    key: 'line',
    label: 'LINE',
    icon: '🟢',
    color: '#06C755',
    buildUrl: (p) =>
      `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(p.url)}&text=${encodeURIComponent(p.text || p.title || '')}`,
  },
  {
    key: 'email',
    label: 'Email',
    icon: '✉️',
    color: '#6B7280',
    buildUrl: (p) =>
      `mailto:?subject=${encodeURIComponent(p.title || 'Check this out')}&body=${encodeURIComponent(`${p.text || ''}\n\n${p.url}`)}`,
  },
];
