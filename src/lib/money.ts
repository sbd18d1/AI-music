/**
 * Single source of truth for pricing + the captured-amount extraction used by each
 * payment route. Kept here so create-order / capture-order / webhook all agree on the
 * same numbers (previously the price constant lived only in create-order).
 */

/** Regular (list) price for a full song — shown to users as the struck-through original. */
export const REGULAR_PRICE = '9.90';
/** Limited-time promo price actually charged for a full song (USD). */
export const PURCHASE_PRICE = '1.00';
/** Coupon deduction per order (a fingerprint-bound coupon automatically subtracts this). */
export const COUPON_VALUE = 0.5;
export const PURCHASE_CURRENCY = 'USD';

/**
 * Pull the actually-captured amount out of a PayPal capture response or webhook
 * resource. Both shapes exist depending on which flow produced the data:
 *   - capture-order: purchase_units[0].payments.captures[0].amount.value
 *   - webhook PAYMENT.CAPTURE.COMPLETED: resource.amount.value
 * Returns null when the amount is not present, so callers keep any existing value
 * rather than overwriting a good number with null.
 */
export function extractCapturedAmount(obj: unknown): { amount: number; currency: string } | null {
  if (!obj || typeof obj !== 'object') return null;
  const root = obj as Record<string, any>;

  const candidates: any[] = [
    root?.purchase_units?.[0]?.payments?.captures?.[0]?.amount,
    root?.resource?.amount,
    // Some capture responses nest the capture under `data`
    root?.data?.purchase_units?.[0]?.payments?.captures?.[0]?.amount,
    root?.data?.resource?.amount,
  ];

  for (const amount of candidates) {
    if (!amount || typeof amount !== 'object') continue;
    const value = Number(amount.value);
    if (!isFinite(value)) continue;
    return {
      amount: value,
      currency: typeof amount.currency_code === 'string' ? amount.currency_code : PURCHASE_CURRENCY,
    };
  }
  return null;
}
