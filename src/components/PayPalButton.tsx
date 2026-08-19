'use client';

import { useEffect, useRef } from 'react';
import { usePayPal } from '@/lib/paypal';

export interface PayPalButtonProps {
  /** Build the payload sent to /api/paypal/create-order (called when user clicks PayPal button). */
  buildPayload: () => Record<string, unknown>;
  /** Called after capture-order succeeds with order id + status ('success' | 'processing' | 'failed'). */
  onCaptured: (orderId: string, status: string) => void;
  /** Called when PayPal create-order starts (right after user click). */
  onStart?: () => void;
  /** Called on any PayPal error (create-order failure, capture failure, button error). */
  onError?: (error: unknown) => void;
  /** Optional className for the button container. */
  className?: string;
  /** Disabled state — when true, hides the buttons (e.g., while another request is in-flight). */
  disabled?: boolean;
}

export default function PayPalButton({
  buildPayload,
  onCaptured,
  onStart,
  onError,
  className,
  disabled,
}: PayPalButtonProps) {
  const { isReady, error, renderButtons } = usePayPal();
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep latest callbacks in refs so we don't re-render PayPal buttons on every parent render.
  const buildPayloadRef = useRef(buildPayload);
  const onCapturedRef = useRef(onCaptured);
  const onStartRef = useRef(onStart);
  const onErrorRef = useRef(onError);
  // Track orderId returned by create-order so we can pass it to capture-order
  const currentOrderIdRef = useRef<string | null>(null);

  useEffect(() => {
    buildPayloadRef.current = buildPayload;
    onCapturedRef.current = onCaptured;
    onStartRef.current = onStart;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    if (!isReady || !containerRef.current) return;
    let cancelled = false;

    const render = async () => {
      try {
        await renderButtons(containerRef.current!, {
          createOrder: async () => {
            onStartRef.current?.();
            const payload = buildPayloadRef.current();
            const response = await fetch('/api/paypal/create-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (!data.success) {
              throw new Error(data.error || 'Failed to create PayPal order');
            }
            currentOrderIdRef.current = data.orderId;
            // API returns paymentOrderId (generic). In PayPal context this value
            // is the PayPal Order ID, which PayPal SDK requires us to return here.
            return data.paymentOrderId;
          },
          onApprove: async ({ orderID }) => {
            const orderId = currentOrderIdRef.current;
            if (!orderId) {
              console.error('[PayPalButton] onApprove: missing orderId');
              onErrorRef.current?.(new Error('Missing orderId'));
              return;
            }
            try {
              const response = await fetch('/api/paypal/capture-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // orderID here is PayPal's Order ID (returned by createOrder above);
                // backend stores it as paymentOrderId (generic field name).
                body: JSON.stringify({ orderId, paymentOrderId: orderID }),
              });
              const data = await response.json();
              if (!data.success && data.status !== 'processing') {
                throw new Error(data.error || 'Capture failed');
              }
              onCapturedRef.current?.(orderId, data.status || 'success');
            } catch (e) {
              console.error('[PayPalButton] Capture error:', e);
              onErrorRef.current?.(e);
            }
          },
          onError: (err) => {
            console.error('[PayPalButton] PayPal onError:', err);
            onErrorRef.current?.(err);
          },
        });
      } catch (e) {
        if (!cancelled) {
          console.error('[PayPalButton] Render failed:', e);
        }
      }
    };

    render();

    return () => {
      cancelled = true;
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [isReady, renderButtons]);

  if (error) {
    return (
      <div className="text-error text-sm text-center p-4 border border-error/30 rounded-xl bg-error/5">
        PayPal: {error}
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="text-base-content/60 text-sm text-center p-4 border border-base-300 rounded-xl animate-pulse">
        Loading PayPal...
      </div>
    );
  }

  if (disabled) {
    return (
      <div className="text-base-content/60 text-sm text-center p-4 border border-base-300 rounded-xl opacity-50">
        Please wait...
      </div>
    );
  }

  return <div ref={containerRef} className={className} />;
}
