import FingerprintJS from '@fingerprintjs/fingerprintjs';

const DEVICE_ID_KEY = 'device_fingerprint_id';

let cachedDeviceId: string | null = null;
let fpPromise: Promise<string> | null = null;

/**
 * Returns a stable device identifier based on browser fingerprinting
 * (Canvas, WebGL, fonts, screen, timezone, etc.) provided by FingerprintJS.
 *
 * The result is cached in memory and localStorage to avoid recomputing on
 * every call. FingerprintJS.load() is heavy, so it is initialized only once.
 *
 * On the server this returns an empty string (no window).
 */
export async function getDeviceId(): Promise<string> {
  if (typeof window === 'undefined') return '';

  if (cachedDeviceId) return cachedDeviceId;

  const stored = localStorage.getItem(DEVICE_ID_KEY);
  if (stored) {
    cachedDeviceId = stored;
    return stored;
  }

  if (!fpPromise) {
    fpPromise = FingerprintJS.load()
      .then((fp) => fp.get())
      .then((result) => result.visitorId);
  }

  try {
    const visitorId = await fpPromise;
    cachedDeviceId = visitorId;
    localStorage.setItem(DEVICE_ID_KEY, visitorId);
    return visitorId;
  } catch (error) {
    console.error('[device-id] Failed to generate fingerprint:', error);
    return '';
  }
}
