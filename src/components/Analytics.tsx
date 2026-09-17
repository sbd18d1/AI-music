'use client';

import { useEffect } from 'react';
import { track } from '@/lib/analytics-client';
import { getDeviceId } from '@/lib/device-id';

/**
 * First-party page-view tracker. Mounted once in the root layout so it covers every
 * route.
 *
 * Two constraints shape this component:
 *  - It must not call useSearchParams(): the layout is a server component with no
 *    Suspense boundary, so that hook breaks the build on static pages. We read
 *    window.location instead.
 *  - It must not await getDeviceId() on mount: FingerprintJS.load() is expensive and
 *    the rest of the app only pays for it inside user actions. We send the page view
 *    immediately (with the already-cached fingerprint if a previous visit stored one)
 *    and only compute a fresh fingerprint once the user actually interacts.
 */
export default function Analytics() {
  useEffect(() => {
    track('pageview');

    // Deferred fingerprint: only for engaged visitors, so bounce traffic never pays
    // for FingerprintJS. Reported as its own event type ('identify') so it is not
    // discarded by the pageview dedupe guard, and so the dashboard can exclude it from
    // click counts.
    let done = false;
    const onInteract = async () => {
      if (done) return;
      done = true;
      try {
        const deviceId = await getDeviceId();
        if (deviceId) track('identify', window.location.pathname, { deviceId });
      } catch {
        /* analytics must never surface an error */
      }
    };

    window.addEventListener('pointerdown', onInteract, { once: true, passive: true });
    window.addEventListener('keydown', onInteract, { once: true, passive: true });
    return () => {
      window.removeEventListener('pointerdown', onInteract);
      window.removeEventListener('keydown', onInteract);
    };
  }, []);

  return null;
}
