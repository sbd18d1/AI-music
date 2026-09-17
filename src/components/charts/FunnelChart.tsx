'use client';

import { formatCompact } from '@/lib/chart-palette';

export interface FunnelStage {
  label: string;
  count: number;
  /** Stage-to-stage conversion as a fraction (null when there is no baseline). */
  rateFromPrev: number | null;
  color: string;
}

interface FunnelChartProps {
  stages: FunnelStage[];
}

/**
 * Horizontal conversion funnel. Width is driven by each stage's count relative to the
 * first stage, so the narrowing is legible at a glance; the exact numbers sit alongside
 * so the shape is never the only source of the value.
 */
export default function FunnelChart({ stages }: FunnelChartProps) {
  const base = Math.max(1, stages[0]?.count ?? 1);

  return (
    <ul className="space-y-4">
      {stages.map((stage, i) => {
        const pct = stage.count === 0 ? 0 : Math.max(4, Math.round((stage.count / base) * 100));
        return (
          <li key={stage.label}>
            <div className="flex items-baseline justify-between gap-3 mb-1.5">
              <span className="text-sm text-base-content/80">{stage.label}</span>
              <span className="flex items-baseline gap-2">
                <span className="font-serif text-lg font-bold text-base-content tabular-nums">
                  {formatCompact(stage.count)}
                </span>
                {i > 0 && (
                  <span className="text-xs text-base-content/50 tabular-nums">
                    {stage.rateFromPrev === null
                      ? '—'
                      : `${Math.round(stage.rateFromPrev * 1000) / 10}%`}
                  </span>
                )}
              </span>
            </div>
            <span className="block h-3 bg-base-300 rounded-full overflow-hidden">
              <span
                className="block h-3 rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: stage.color }}
              />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
