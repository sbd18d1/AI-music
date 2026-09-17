'use client';

/**
 * Fire-and-forget first-party analytics beacon. Deliberately dependency-free and
 * synchronous: it must never delay a click, a navigation, or a payment redirect.
 *
 * Prefers navigator.sendBeacon (survives page unload, no preflight); falls back to
 * fetch with keepalive so the request still goes out when the caller immediately does
 * `window.location.href = ...` (the PayPal redirect in handlePayPalRedirect).
 */

const SESSION_KEY = 'analytics_session_id';
const DEVICE_KEY = 'device_fingerprint_id';

// Guards against React 18 StrictMode double-mounting effects in dev, which would
// otherwise double-count the same page view. The server also dedupes by session+path.
let lastPageviewKey = '';

function getSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return '';
  }
}

/**
 * The fingerprint already stored by a previous visit — read synchronously so the
 * common (returning visitor) case costs nothing. We do NOT call getDeviceId() here:
 * FingerprintJS.load() is heavy and would regress time-to-interactive on every page.
 */
function getKnownDeviceId(): string | undefined {
  try {
    return localStorage.getItem(DEVICE_KEY) || undefined;
  } catch {
    return undefined;
  }
}

function send(payload: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  const json = JSON.stringify(payload);
  try {
    if (navigator.sendBeacon) {
      // A Blob with an explicit JSON type makes sendBeacon send the right Content-Type.
      navigator.sendBeacon('/api/track', new Blob([json], { type: 'application/json' }));
      return;
    }
  } catch {
    /* fall through to fetch */
  }
  try {
    void fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: json,
      keepalive: true,
    });
  } catch {
    /* never throw into a click handler */
  }
}

export interface TrackExtra {
  referrer?: string | null;
  deviceId?: string;
  [key: string]: unknown;
}

/**
 * Record a named event (or a page view). Synchronous by design — do not await.
 */
export function track(type: string, path?: string, extra: TrackExtra = {}): void {
  if (typeof window === 'undefined') return;

  const p = path ?? window.location.pathname;
  const key = `${type}:${p}`;
  if (type === 'pageview') {
    if (lastPageviewKey === key) return;
    lastPageviewKey = key;
  }

  const q = new URLSearchParams(window.location.search);
  send({
    type,
    path: p,
    sessionId: getSessionId(),
    deviceId: extra.deviceId ?? getKnownDeviceId(),
    referrer: extra.referrer ?? document.referrer ?? null,
    utmSource: q.get('utm_source') || undefined,
    utmMedium: q.get('utm_medium') || undefined,
    utmCampaign: q.get('utm_campaign') || undefined,
    ...extra,
  });
}
