'use client';

/**
 * Chart colors as CSS custom properties. globals.css defines --color-primary etc. per
 * [data-theme], so charts follow the active theme automatically instead of hardcoding
 * hex values that would clash with `modern` / `vintageWarm` / `warmVintageGold`.
 *
 * Note: apply these via `style={{ stroke: ... }}` or a Tailwind arbitrary-value class,
 * NOT as an SVG presentation attribute — `var()` in SVG attributes is inconsistently
 * supported across browsers.
 */
export const CHART_COLORS = {
  primary: 'var(--color-primary)',
  secondary: 'var(--color-secondary)',
  success: 'var(--color-success)',
  error: 'var(--color-error)',
  warning: 'var(--color-warning)',
  info: 'var(--color-info)',
  neutral: 'var(--color-neutral)',
} as const;

/** Rounded "nice" upper bound for a Y axis, so gridlines land on readable numbers. */
export function niceMax(value: number): number {
  if (!isFinite(value) || value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const pow = Math.pow(10, exp);
  const frac = value / pow;
  const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 2.5 ? 2.5 : frac <= 5 ? 5 : 10;
  return nice * pow;
}

/** Compact number formatting for axis labels (1200 → "1.2k"). */
export function formatCompact(n: number): string {
  if (!isFinite(n)) return '0';
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(Math.round(n * 100) / 100);
}

/** "2026-09-10" → "09/10" */
export function formatDayLabel(day: string): string {
  const parts = day.split('-');
  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : day;
}
