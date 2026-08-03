'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { initializePaddle, type Paddle, type CheckoutOpenOptions, type PricePreviewResponse } from '@paddle/paddle-js';

export interface PaddleCheckoutOptions {
  transactionId?: string;
  items?: Array<{ priceId: string; quantity: number }>;
  email?: string;
  successUrl?: string;
  customData?: Record<string, unknown>;
}

export function usePaddle(onEvent?: (eventName: string, data: unknown) => void) {
  const [paddle, setPaddle] = useState<Paddle | undefined>(undefined);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);
  const eventCallbackRef = useRef(onEvent);

  useEffect(() => {
    eventCallbackRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (initialized.current) return;
    if (typeof window === 'undefined') return;

    const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || '';
    const environment = (process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT as 'sandbox' | 'live') || 'sandbox';

    console.log('[Paddle] Init config:', { 
      clientTokenPrefix: clientToken.substring(0, 12) + '...', 
      environment,
      tokenLength: clientToken.length 
    });

    if (!clientToken || clientToken.includes('your_token_here') || clientToken.length < 10) {
      console.error('[Paddle] Invalid client token:', { token: clientToken, length: clientToken.length });
      setError('Paddle client token not configured correctly');
      return;
    }

    initialized.current = true;

    const initPaddle = async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
        const paddleInstance = await initializePaddle({
          environment: environment === 'sandbox' ? 'sandbox' : 'production',
          token: clientToken,
          debug: true,
          checkout: {
            settings: {
              displayMode: 'overlay',
              theme: 'light',
              locale: 'en',
              successUrl: `${baseUrl}/order-status?order_id={orderId}&provider=paddle`,
            },
          },
          eventCallback: (event) => {
            console.log('[Paddle] Event:', event.name, event);
            if (eventCallbackRef.current) {
              eventCallbackRef.current(event.name || 'unknown', event.data || event);
            }
          },
        });

        if (paddleInstance) {
          console.log('[Paddle] Initialized, version:', paddleInstance.Version, 'status:', paddleInstance.Status.libraryVersion);
          setPaddle(paddleInstance);
          setIsReady(true);
        } else {
          console.error('[Paddle] initializePaddle returned undefined');
          setError('Paddle SDK failed to initialize');
        }
      } catch (e) {
        console.error('[Paddle] Init error:', e);
        setError((e as Error).message);
      }
    };

    initPaddle();
  }, []);

  const openCheckout = useCallback((options: PaddleCheckoutOptions) => {
    if (!paddle) {
      console.error('[Paddle] openCheckout called but paddle not ready');
      setError('Paddle not initialized. Please wait a moment and try again.');
      return;
    }

    try {
      const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
      const checkoutConfig: CheckoutOpenOptions = {
        settings: {
          displayMode: 'overlay',
          theme: 'light',
          locale: 'en',
          successUrl: options.successUrl || `${baseUrl}/order-status?order_id={orderId}&provider=paddle`,
        },
        customData: options.customData,
      };

      if (options.transactionId) {
        checkoutConfig.transactionId = options.transactionId;
      }

      if (options.items && options.items.length > 0) {
        checkoutConfig.items = options.items;
      }

      if (options.email) {
        checkoutConfig.customer = { email: options.email };
      }

      console.log('[Paddle] Opening checkout with config:', JSON.stringify({
        ...checkoutConfig,
        settings: checkoutConfig.settings ? { ...checkoutConfig.settings } : undefined,
      }));

      paddle.Checkout.open(checkoutConfig);
      console.log('[Paddle] Checkout.open() called successfully');
    } catch (e) {
      console.error('[Paddle] openCheckout error:', e);
      setError((e as Error).message);
    }
  }, [paddle]);

  const closeCheckout = useCallback(() => {
    if (paddle) {
      paddle.Checkout.close();
    }
  }, [paddle]);

  const fetchPrice = useCallback(async (priceId: string, quantity: number = 1): Promise<{ formattedTotal: string; currencyCode: string; rawTotal: string } | null> => {
    if (!paddle) {
      console.error('[Paddle] fetchPrice called but paddle not ready');
      return null;
    }

    try {
      const response: PricePreviewResponse = await paddle.PricePreview({
        items: [{ priceId, quantity }],
      });

      const lineItems = response?.data?.details?.lineItems;
      if (lineItems && lineItems.length > 0) {
        const item = lineItems[0];
        const formattedTotal = item.formattedTotals?.total || '';
        const currencyCode = response.data?.currencyCode || 'USD';
        const rawTotal = item.totals?.total || '';
        
        console.log('[Paddle] Price preview:', { formattedTotal, currencyCode, rawTotal });
        return { formattedTotal, currencyCode, rawTotal };
      }
      return null;
    } catch (e) {
      console.error('[Paddle] fetchPrice error:', e);
      return null;
    }
  }, [paddle]);

  return { isReady, error, openCheckout, closeCheckout, fetchPrice, paddleInstance: paddle };
}
