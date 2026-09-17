'use client';

import { useId, useMemo, useState } from 'react';
import { niceMax, formatCompact, formatDayLabel } from '@/lib/chart-palette';

export interface BarSeries {
  key: string;
  label: string;
  color: string;
  /** Adds a diagonal hatch overlay — a second encoding so series don't rely on color. */
  hatched?: boolean;
  data: number[];
}

interface BarChartProps {
  labels: string[];
  series: BarSeries[];
  height?: number;
  ariaLabel: string;
  formatValue?: (n: number) => string;
}

const W = 800;
const PAD_TOP = 12;
const PAD_BOTTOM = 26;

/** Grouped bar chart, hand-rolled. Bars share one scale so series are comparable. */
export default function BarChart({
  labels,
  series,
  height = 240,
  ariaLabel,
  formatValue = formatCompact,
}: BarChartProps) {
  const rawId = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);

  const plotH = height - PAD_TOP - PAD_BOTTOM;
  const n = labels.length;
  const seriesCount = Math.max(1, series.length);

  const max = useMemo(() => {
    const peak = Math.max(0, ...series.flatMap((s) => s.data));
    return niceMax(peak || 1);
  }, [series]);

  const band = n > 0 ? W / n : W;
  const groupW = band * 0.7;
  const barW = groupW / seriesCount;
  const y = (v: number) => PAD_TOP + plotH - (v / max) * plotH;
  const labelStep = Math.max(1, Math.ceil(n / 7));
  const gridValues = [0, 0.5, 1].map((f) => max * f);

  return (
    <div className="flex">
      <div
        className="relative flex-shrink-0 w-12 text-right pr-2 text-[11px] text-base-content/50 tabular-nums"
        style={{ height }}
        aria-hidden="true"
      >
        {gridValues.map((v, i) => (
          <span
            key={i}
            className="absolute right-2 -translate-y-1/2"
            style={{ top: `${((y(v) - PAD_TOP) / plotH) * 100}%` }}
          >
            {formatValue(v)}
          </span>
        ))}
      </div>

      <div className="relative flex-1 min-w-[560px]" style={{ height }}>
        <svg
          viewBox={`0 0 ${W} ${height}`}
          preserveAspectRatio="none"
          className="w-full h-full"
          role="img"
          aria-label={ariaLabel}
        >
          <defs>
            {series.map((s) =>
              s.hatched ? (
                <pattern
                  key={s.key}
                  id={`hatch-${rawId}-${s.key}`}
                  width="6"
                  height="6"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <rect width="6" height="6" fill="transparent" />
                  <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(0,0,0,0.45)" strokeWidth="2" />
                </pattern>
              ) : null
            )}
          </defs>

          {gridValues.map((v, i) => (
            <line
              key={i}
              x1={0}
              y1={y(v)}
              x2={W}
              y2={y(v)}
              className="stroke-base-300"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
              strokeDasharray={i === 0 ? undefined : '3 4'}
            />
          ))}

          {labels.map((_, i) => {
            const groupX = i * band + (band - groupW) / 2;
            return (
              <g key={i}>
                {series.map((s, si) => {
                  const value = s.data[i] ?? 0;
                  const h = Math.max(0, PAD_TOP + plotH - y(value));
                  const bx = groupX + si * barW + 0.5;
                  return (
                    <g key={s.key}>
                      <rect
                        x={bx}
                        y={y(value)}
                        width={Math.max(1, barW - 1)}
                        height={h}
                        rx={2}
                        style={{ fill: s.color }}
                        opacity={hover === null || hover === i ? 1 : 0.45}
                      />
                      {s.hatched && (
                        <rect
                          x={bx}
                          y={y(value)}
                          width={Math.max(1, barW - 1)}
                          height={h}
                          rx={2}
                          fill={`url(#hatch-${rawId}-${s.key})`}
                          opacity={hover === null || hover === i ? 1 : 0.45}
                        />
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>

        {/* Invisible hover bands */}
        <div className="absolute inset-0 flex" onMouseLeave={() => setHover(null)}>
          {labels.map((_, i) => (
            <div key={i} className="flex-1" onMouseEnter={() => setHover(i)} />
          ))}
        </div>

        <div className="absolute left-0 right-0 bottom-0 h-5 pointer-events-none" aria-hidden="true">
          {labels.map((d, i) =>
            i % labelStep === 0 ? (
              <span
                key={d}
                className="absolute -translate-x-1/2 text-[11px] text-base-content/50 tabular-nums"
                style={{ left: `${((i + 0.5) / Math.max(1, n)) * 100}%` }}
              >
                {formatDayLabel(d)}
              </span>
            ) : null
          )}
        </div>

        {hover !== null && (
          <div
            className="pointer-events-none absolute top-0 -translate-x-1/2 bg-base-100 border border-base-300 rounded-lg shadow-md px-3 py-2 text-xs z-10"
            style={{ left: `${((hover + 0.5) / Math.max(1, n)) * 100}%` }}
          >
            <p className="font-semibold text-base-content mb-1 whitespace-nowrap">{labels[hover]}</p>
            {series.map((s) => (
              <p key={s.key} className="flex items-center gap-2 whitespace-nowrap text-base-content/80">
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: s.color }} />
                {s.label}:{' '}
                <span className="font-semibold tabular-nums">{formatValue(s.data[hover] ?? 0)}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
