'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { niceMax, formatCompact, formatDayLabel } from '@/lib/chart-palette';

export interface LineSeries {
  key: string;
  label: string;
  color: string;
  /** Dashed stroke — a second encoding so series are distinguishable without color. */
  dashed?: boolean;
  data: number[];
}

interface LineChartProps {
  labels: string[]; // ISO days, bucket-aligned
  series: LineSeries[];
  height?: number;
  ariaLabel: string;
}

const W = 800;
const PAD_TOP = 12;
const PAD_BOTTOM = 26;
const PAD_LEFT = 0; // the Y axis is an HTML overlay, so the SVG needs no left gutter

/**
 * Hand-rolled multi-series line/area chart. No chart library: the codebase already
 * hand-writes its SVG (header logo, icons), and this keeps the bundle free of a
 * dependency that would only be used on one page.
 *
 * Geometry is drawn in a fixed 800-wide coordinate system with
 * preserveAspectRatio="none", so CSS scales it to any width. Every stroke carries
 * vector-effect="non-scaling-stroke" so the scaling doesn't stretch line weight.
 */
export default function LineChart({ labels, series, height = 240, ariaLabel }: LineChartProps) {
  const uid = useId().replace(/:/g, '');
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const plotH = height - PAD_TOP - PAD_BOTTOM;

  const max = useMemo(() => {
    const peak = Math.max(0, ...series.flatMap((s) => s.data));
    return niceMax(peak || 1);
  }, [series]);

  const n = labels.length;
  const x = (i: number) => (n <= 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => PAD_TOP + plotH - (v / max) * plotH;

  // Thin X labels so a 90-day range stays readable.
  const labelStep = Math.max(1, Math.ceil(n / 7));
  const gridValues = [0, 0.25, 0.5, 0.75, 1].map((f) => max * f);

  const pathFor = (data: number[]) =>
    data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(' ');

  const areaFor = (data: number[]) =>
    `${pathFor(data)} L${x(n - 1).toFixed(2)},${y(0).toFixed(2)} L${x(0).toFixed(2)},${y(0).toFixed(2)} Z`;

  const handleMove = (e: React.MouseEvent) => {
    const el = wrapRef.current;
    if (!el || n === 0) return;
    const rect = el.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    setHover(Math.max(0, Math.min(n - 1, Math.round(ratio * (n - 1)))));
  };

  return (
    <div className="relative">
      <div className="flex">
        {/* Y-axis labels as real DOM text (crisp under non-uniform SVG scaling) */}
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
              {formatCompact(v)}
            </span>
          ))}
        </div>

        <div
          ref={wrapRef}
          className="relative flex-1 min-w-[560px]"
          style={{ height }}
          onMouseMove={handleMove}
          onMouseLeave={() => setHover(null)}
        >
          <svg
            viewBox={`0 0 ${W} ${height}`}
            preserveAspectRatio="none"
            className="w-full h-full"
            role="img"
            aria-label={ariaLabel}
          >
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

            {series.map((s) => (
              <g key={s.key}>
                <path d={areaFor(s.data)} style={{ fill: s.color }} fillOpacity={0.12} stroke="none" />
                <path
                  d={pathFor(s.data)}
                  fill="none"
                  style={{ stroke: s.color }}
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeDasharray={s.dashed ? '6 4' : undefined}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            ))}

            {hover !== null && (
              <line
                x1={x(hover)}
                y1={PAD_TOP}
                x2={x(hover)}
                y2={PAD_TOP + plotH}
                className="stroke-base-content/30"
                strokeWidth="1"
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>

          {/* X labels: HTML overlay so they don't get stretched by the SVG scaling */}
          <div className="absolute left-0 right-0 bottom-0 h-5" aria-hidden="true">
            {labels.map((d, i) =>
              i % labelStep === 0 ? (
                <span
                  key={d}
                  className="absolute -translate-x-1/2 text-[11px] text-base-content/50 tabular-nums"
                  style={{ left: `${(i / Math.max(1, n - 1)) * 100}%` }}
                >
                  {formatDayLabel(d)}
                </span>
              ) : null
            )}
          </div>

          {hover !== null && (
            <div
              className="pointer-events-none absolute top-0 -translate-x-1/2 bg-base-100 border border-base-300 rounded-lg shadow-md px-3 py-2 text-xs z-10"
              style={{ left: `${(hover / Math.max(1, n - 1)) * 100}%` }}
            >
              <p className="font-semibold text-base-content mb-1 whitespace-nowrap">
                {labels[hover]}
              </p>
              {series.map((s) => (
                <p key={s.key} className="flex items-center gap-2 whitespace-nowrap text-base-content/80">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: s.color }} />
                  {s.label}: <span className="font-semibold tabular-nums">{s.data[hover] ?? 0}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
