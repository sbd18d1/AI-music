'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

declare global {
  interface Window {
    Paddle?: any;
  }
}

export interface PaddleConfig {
  clientToken: string;
  environment?: 'sandbox' | 'live';
}

export interface PaddleCheckoutOptions {
  transactionId: string;
  title?: string;
  email?: string;
}

export function usePaddle() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;

    const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || '';
    const environment = (process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT as 'sandbox' | 'live') || 'sandbox';

    if (!clientToken || clientToken.includes('your_token_here')) {
      setError('Paddle client token not configured');
      return;
    }

    if (typeof window === 'undefined') return;

    initialized.current = true;

    const initPaddle = async () => {
      try {
        if (window.Paddle) {
          setIsReady(true);
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://js.paddle.com/web/paddle.js';
        script.async = true;
        script.onload = () => {
          if (window.Paddle) {
            window.Paddle.initialize({
              token: clientToken,
              environment,
            });
            setIsReady(true);
          }
        };
        script.onerror = () => {
          setError('Failed to load Paddle script');
        };
        document.head.appendChild(script);
      } catch (e) {
        setError((e as Error).message);
      }
    };

    initPaddle();
  }, []);

  const openCheckout = useCallback((options: PaddleCheckoutOptions) => {
    if (!window.Paddle) {
      setError('Paddle not initialized');
      return;
    }

    try {
      window.Paddle.Checkout.open({
        transactionId: options.transactionId,
        title: options.title || 'Smart Music Lab - AI Personalized Song',
        customer: {
          email: options.email,
        },
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  return { isReady, error, openCheckout };
}
