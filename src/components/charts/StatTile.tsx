'use client';

import type { ReactNode } from 'react';
import { formatCompact } from '@/lib/chart-palette';

interface StatTileProps {
  label: string;
  value: number | string;
  icon: ReactNode;
  /** Small caption under the value, e.g. "vs previous 11,102". */
  sub?: string;
  /** Change vs the previous period, as a fraction. null → no comparable data. */
  delta?: number | null;
  /** Prefix for the value, e.g. "$". */
  prefix?: string;
}

/**
 * A KPI tile. Deliberately never renders "+100%" for a previous period of zero — with
 * no baseline there is no meaningful percentage, so it shows "—" instead. An infinite
 * delta is the classic analytics-dashboard bug.
 */
export default function StatTile({ label, value, icon, sub, delta, prefix = '' }: StatTileProps) {
  const rendered =
    typeof value === 'number' ? `${prefix}${formatCompact(value)}` : `${prefix}${value}`;

  let deltaEl: ReactNode = null;
  if (delta !== undefined) {
    if (delta === null || !isFinite(delta)) {
      deltaEl = <span className="text-base-content/40 text-xs">—</span>;
    } else {
      const pct = Math.round(delta * 1000) / 10;
      const up = pct >= 0;
      deltaEl = (
        <span className={`text-xs font-semibold tabular-nums ${up ? 'text-success' : 'text-error'}`}>
          {up ? '▲' : '▼'} {Math.abs(pct)}%
        </span>
      );
    }
  }

  return (
    <div className="bg-base-200/80 border border-base-300 rounded-2xl p-5 shadow-vintage">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base-content/60 text-xs mb-1">{label}</p>
          <p className="font-serif text-2xl md:text-3xl font-bold text-base-content tabular-nums truncate">
            {rendered}
          </p>
          {(sub || deltaEl) && (
            <div className="flex items-center gap-2 mt-1">
              {deltaEl}
              {sub && <span className="text-base-content/50 text-xs truncate">{sub}</span>}
            </div>
          )}
        </div>
        <span className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
          {icon}
        </span>
      </div>
    </div>
  );
}
