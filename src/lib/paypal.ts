'use client';

import { useEffect, useState, useCallback } from 'react';

declare global {
  interface Window {
    paypal?: {
      Buttons: (config: PayPalButtonsConfig) => PayPalButtonInstance;
    };
  }
}

interface PayPalButtonsConfig {
  style?: {
    layout?: 'vertical' | 'horizontal';
    color?: 'gold' | 'blue' | 'silver' | 'white' | 'black';
    shape?: 'rect' | 'pill';
    label?: 'pay' | 'checkout' | 'paypal';
    height?: number;
  };
  createOrder: () => Promise<string>;
  onApprove: (data: { orderID: string }) => Promise<void>;
  onError?: (err: unknown) => void;
  onCancel?: () => void;
}

interface PayPalButtonInstance {
  render: (container: HTMLElement) => Promise<void>;
  close: () => Promise<void>;
}

const PAYPAL_SDK_URL = 'https://www.paypal.com/sdk/js';

let sdkLoadPromise: Promise<void> | null = null;

// Load timeout (ms). In network-restricted regions www.paypal.com can take several
// seconds to respond — give it a generous window before declaring failure.
const SDK_LOAD_TIMEOUT = 60000;
// Automatic retries when the SDK script fails to load or times out.
const SDK_MAX_RETRIES = 3;
const SDK_RETRY_DELAY = 3000;

function injectSdkScript(src: string): Promise<HTMLScriptElement> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(existing as HTMLScriptElement));
      existing.addEventListener('error', () => reject(new Error('Failed to load PayPal SDK')));
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve(script);
    script.onerror = () => reject(new Error('Failed to load PayPal SDK'));
    document.head.appendChild(script);
  });
}

function loadPayPalSDK(clientId: string, currency: string, intent: string): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('SSR environment'));
  }

  if (window.paypal) {
    return Promise.resolve();
  }

  if (sdkLoadPromise) {
    return sdkLoadPromise;
  }

  const src = `${PAYPAL_SDK_URL}?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(currency)}&intent=${intent}&disable-funding=credit`;

  // Attempt to load with retry + timeout. Only resolve when the SDK is actually on
  // window.paypal; a script "load" event can fire before the SDK initializes.
  const attempt = async (triesLeft: number): Promise<void> => {
    if (window.paypal) {
      return;
    }
    try {
      await injectSdkScript(src);
      // Wait briefly for the SDK to attach itself; ignore only transient absence.
      for (let i = 0; i < 20 && !window.paypal; i++) {
        await new Promise((r) => setTimeout(r, 250));
      }
      if (window.paypal) {
        return;
      }
      throw new Error('PayPal SDK loaded but not initialized');
    } catch (err) {
      if (triesLeft > 0) {
        await new Promise((r) => setTimeout(r, SDK_RETRY_DELAY));
        return attempt(triesLeft - 1);
      }
      throw err;
    }
  };

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Timed out loading PayPal SDK')), SDK_LOAD_TIMEOUT);
  });

  sdkLoadPromise = Promise.race([attempt(SDK_MAX_RETRIES), timeout])
    .finally(() => {
      if (timeoutId) clearTimeout(timeoutId);
      // Reset cache on failure so a later call (e.g. after the user retries) can try again.
      sdkLoadPromise = null;
    });

  return sdkLoadPromise;
}

export interface UsePayPalResult {
  isReady: boolean;
  error: string | null;
  renderButtons: (
    container: HTMLElement,
    handlers: {
      createOrder: () => Promise<string>;
      onApprove: (data: { orderID: string }) => Promise<void>;
      onError?: (err: unknown) => void;
      onCancel?: () => void;
    }
  ) => Promise<void>;
}

export function usePayPal(): UsePayPalResult {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Front-end public client ID, selected by mode so the button matches the backend.
    // - PAYPAL_MODE=sandbox -> NEXT_PUBLIC_PAYPAL_CLIENT_ID_SANDBOX
    // - PAYPAL_MODE=live    -> NEXT_PUBLIC_PAYPAL_CLIENT_ID_LIVE
    // Falls back to legacy single NEXT_PUBLIC_PAYPAL_CLIENT_ID for backwards compat.
    const mode = process.env.NEXT_PUBLIC_PAYPAL_MODE || process.env.PAYPAL_MODE || 'sandbox';
    const clientId =
      (mode === 'live'
        ? process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID_LIVE
        : process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID_SANDBOX) ||
      process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ||
      '';

    console.log('[PayPal] Init config:', {
      clientIdPrefix: clientId ? clientId.substring(0, 8) + '...' : 'EMPTY',
      mode,
      clientIdLength: clientId.length,
    });

    if (!clientId || clientId.includes('your_') || clientId.length < 10) {
      console.error('[PayPal] Invalid client ID:', { clientId, length: clientId.length });
      setError('PayPal client ID not configured. Set NEXT_PUBLIC_PAYPAL_CLIENT_ID_SANDBOX / _LIVE in .env');
      return;
    }

    loadPayPalSDK(clientId, 'USD', 'capture')
      .then(() => {
        console.log('[PayPal] SDK loaded');
        setIsReady(true);
      })
      .catch((e) => {
        console.error('[PayPal] SDK load error:', e);
        setError((e as Error).message);
      });
  }, []);

  const renderButtons = useCallback(
    async (
      container: HTMLElement,
      handlers: {
        createOrder: () => Promise<string>;
        onApprove: (data: { orderID: string }) => Promise<void>;
        onError?: (err: unknown) => void;
        onCancel?: () => void;
      }
    ): Promise<void> => {
      if (!window.paypal) {
        throw new Error('PayPal SDK not loaded');
      }

      container.innerHTML = '';

      await window.paypal
        .Buttons({
          style: {
            layout: 'vertical',
            color: 'gold',
            shape: 'rect',
            label: 'paypal',
            height: 48,
          },
          createOrder: async () => handlers.createOrder(),
          onApprove: async (data) => handlers.onApprove({ orderID: data.orderID }),
          onError: (err) => {
            console.error('[PayPal] Button onError:', err);
            handlers.onError?.(err);
          },
          onCancel: () => {
            console.log('[PayPal] Checkout cancelled by user');
            handlers.onCancel?.();
          },
        })
        .render(container);
    },
    []
  );

  return { isReady, error, renderButtons };
}
