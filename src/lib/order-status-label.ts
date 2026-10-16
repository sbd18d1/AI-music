/**
 * Interpret an Order row for the admin UI.
 *
 * `Order.status` alone is genuinely ambiguous, because the SAME value means different
 * things depending on the order type:
 *
 *   trial: testing → generating → success | failed      (about GENERATION only)
 *   paid:  pending → processing → success | failed      (payment first, then generation)
 *
 * So `failed` on a TRIAL means "the song didn't generate" (nothing was lost), while
 * `failed` on a PAID order means the customer was CHARGED and the song still failed —
 * a refund case. Reporting just "失败" hides that difference, which is exactly the
 * distinction an operator needs.
 *
 * How to tell whether money actually moved — the subtle part:
 *
 *   `paypalOrderId` is written by create-order BEFORE the user approves anything, so a
 *   non-null value does NOT mean the customer paid. Likewise `amountPaid` is seeded at
 *   creation with the EXPECTED amount. Both are set on abandoned checkouts.
 *
 *   Only `status === 'success'` proves capture: it is written by capture-order (on the
 *   PayPal return) or by the PAYMENT.CAPTURE.COMPLETED webhook, and nothing else sets it.
 *
 * So payment is derived from status, and the PayPal/amount fields are used only to tell
 * a coupon unlock (never went to PayPal at all) apart from a real capture.
 */

export type PaymentState = 'unpaid' | 'paid' | 'refund_due';
export type GenerationState = 'not_started' | 'in_progress' | 'done' | 'failed';
export type OrderKind = 'trial' | 'paid';

export interface OrderLike {
  status: string | null;
  isFullVersion: boolean | null;
  amountPaid?: number | null;
  hasAudio?: boolean | null;
  paypalOrderId?: string | null;
  couponCode?: string | null;
}

export interface OrderInterpretation {
  kind: OrderKind;
  payment: PaymentState;
  generation: GenerationState;
  /** Human-readable Chinese label combining both axes. */
  label: string;
  /** Tailwind text colour class for the label. */
  tone: 'success' | 'error' | 'warning' | 'muted';
  /** True only when there is something playable to open. */
  playable: boolean;
}

export function interpretOrder(o: OrderLike): OrderInterpretation {
  const kind: OrderKind = o.isFullVersion ? 'paid' : 'trial';
  const status = (o.status || '').toLowerCase();
  const hasAudio = !!o.hasAudio;

  // Coupon unlock = settled, but never went through PayPal (no capture to refund).
  const settled = status === 'success';
  const wentToPaypal = !!o.paypalOrderId;
  const unlockedFree = settled && !wentToPaypal;

  let generation: GenerationState;
  if (hasAudio) generation = 'done';
  else if (status === 'failed') generation = 'failed';
  else if (status === 'testing' || status === 'generating' || status === 'processing') generation = 'in_progress';
  else generation = 'not_started';

  // Payment: ONLY status === 'success' proves capture. A non-null paypalOrderId or a
  // seeded amountPaid is present on abandoned checkouts too, so neither can be trusted.
  // A paid order that captured money but whose song then failed is a refund case.
  let payment: PaymentState = 'unpaid';
  if (kind === 'paid' && status === 'success') {
    payment = generation === 'failed' ? 'refund_due' : 'paid';
  }

  let label: string;
  let tone: OrderInterpretation['tone'];

  if (kind === 'trial') {
    if (generation === 'done') {
      label = '试听生成成功';
      tone = 'success';
    } else if (generation === 'failed') {
      label = '试听生成失败（未收费）';
      tone = 'error';
    } else if (generation === 'in_progress') {
      label = '试听生成中';
      tone = 'muted';
    } else {
      label = '试听未开始';
      tone = 'muted';
    }
  } else {
    // Paid orders: payment and generation are separate facts.
    if (payment === 'refund_due') {
      label = '已付款但生成失败（需退款）';
      tone = 'error';
    } else if (payment === 'paid' && generation === 'done') {
      label = '付款成功 · 歌曲已交付';
      tone = 'success';
    } else if (payment === 'paid') {
      label = generation === 'in_progress' ? '已付款 · 生成中' : '已付款 · 待生成';
      tone = 'warning';
    } else if (unlockedFree && generation === 'done') {
      label = '券解锁 · 歌曲已交付';
      tone = 'success';
    } else if (unlockedFree) {
      label = generation === 'in_progress' ? '券解锁 · 生成中' : '券解锁 · 待生成';
      tone = 'warning';
    } else if (status === 'pending') {
      label = '未付款（已放弃结账）';
      tone = 'muted';
    } else if (status === 'failed') {
      label = '生成失败（未收到款）';
      tone = 'error';
    } else {
      label = '未完成';
      tone = 'muted';
    }
  }

  return { kind, payment, generation, label, tone, playable: hasAudio };
}
