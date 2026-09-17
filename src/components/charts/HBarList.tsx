'use client';

import { formatCompact } from '@/lib/chart-palette';

export interface HBarItem {
  label: string;
  value: number;
  hint?: string;
}

interface HBarListProps {
  items: HBarItem[];
  color?: string;
  /** Empty-state hint shown when there is nothing to rank. */
  emptyHint?: string;
}

/**
 * Ranked horizontal bar list for top paths / countries / cities / referrers. A bar
 * list reads better than a horizontal SVG chart at ~10 categories and needs no
 * coordinate math. Widths use an inline style because Tailwind cannot generate a
 * dynamic `w-[43%]` class.
 */
export default function HBarList({ items, color = 'var(--color-primary)', emptyHint }: HBarListProps) {
  if (items.length === 0) {
    return (
      <p className="text-base-content/50 text-sm py-4 text-center">
        {emptyHint || 'No data for this period'}
      </p>
    );
  }

  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const pct = Math.max(2, Math.round((item.value / max) * 100));
        return (
          <li key={item.label} className="flex items-center gap-3" title={`${item.label}: ${item.value}`}>
            <span className="w-32 sm:w-40 flex-shrink-0 text-sm text-base-content/80 truncate">
              {item.label}
            </span>
            <span className="flex-1 h-2 bg-base-300 rounded-full overflow-hidden">
              <span
                className="block h-2 rounded-full"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </span>
            <span className="w-14 flex-shrink-0 text-right text-sm font-semibold text-base-content tabular-nums">
              {item.hint ?? formatCompact(item.value)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
