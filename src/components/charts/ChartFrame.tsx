'use client';

import { useId, type ReactNode } from 'react';

/**
 * Shared chrome for the hand-rolled SVG charts: a title, a legend, the plot area with
 * an HTML-overlaid Y axis (labels stay crisp because they are real DOM text — SVG text
 * would be stretched by preserveAspectRatio="none"), and a screen-reader data table.
 *
 * The sr-only table is what actually makes these charts accessible, and it doubles as
 * the "read the exact numbers" affordance. Hover tooltips are additive, never the only
 * way to read a value.
 */

export interface LegendItem {
  label: string;
  color: string;
  /** Rendered as a dashed line in the legend when the series uses dashes. */
  dashed?: boolean;
  /** Rendered as a diagonal-hatched swatch when the series uses a hatch overlay. */
  hatched?: boolean;
}

interface ChartFrameProps {
  title: string;
  subtitle?: string;
  legend?: LegendItem[];
  /** Accessible description of what the chart shows. */
  ariaLabel: string;
  /** Rows for the sr-only fallback table. */
  table?: { headers: string[]; rows: (string | number)[][] };
  children: ReactNode;
  isEmpty?: boolean;
  emptyHint?: string;
  className?: string;
}

export function ChartFrame({
  title,
  subtitle,
  legend,
  ariaLabel,
  table,
  children,
  isEmpty,
  emptyHint,
  className = '',
}: ChartFrameProps) {
  const uid = useId().replace(/:/g, '');
  return (
    <section
      className={`bg-base-200/80 border border-base-300 rounded-2xl p-5 md:p-6 shadow-vintage ${className}`}
      aria-label={ariaLabel}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-serif text-lg font-bold text-base-content">{title}</h3>
          {subtitle && <p className="text-base-content/60 text-xs mt-0.5">{subtitle}</p>}
        </div>
        {legend && legend.length > 0 && (
          <ul className="flex flex-wrap items-center gap-3">
            {legend.map((item) => (
              <li key={item.label} className="flex items-center gap-1.5 text-xs text-base-content/70">
                {item.hatched ? (
                  // Rounded swatch with a diagonal hatch, matching the bar encoding.
                  <svg width="14" height="10" aria-hidden="true">
                    <defs>
                      <pattern id={`lg-${uid}-${item.label}`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                        <line x1="0" y1="0" x2="0" y2="4" stroke="rgba(0,0,0,0.45)" strokeWidth="2" />
                      </pattern>
                    </defs>
                    <rect x="0" y="0" width="14" height="10" rx="2" style={{ fill: item.color }} />
                    <rect x="0" y="0" width="14" height="10" rx="2" fill={`url(#lg-${uid}-${item.label})`} />
                  </svg>
                ) : (
                  <svg width="14" height="10" aria-hidden="true">
                    <line
                      x1="0"
                      y1="5"
                      x2="14"
                      y2="5"
                      style={{ stroke: item.color }}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeDasharray={item.dashed ? '4 3' : undefined}
                    />
                  </svg>
                )}
                {item.label}
              </li>
            ))}
          </ul>
        )}
      </div>

      {isEmpty ? (
        <div className="py-10 text-center">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6m4 6V9m4 10v-3M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-base-content/60 text-sm">No data for this period</p>
          {emptyHint && <p className="text-base-content/40 text-xs mt-1">{emptyHint}</p>}
        </div>
      ) : (
        children
      )}

      {table && !isEmpty && (
        <table className="sr-only">
          <caption>{title}</caption>
          <thead>
            <tr>
              {table.headers.map((h) => (
                <th key={h} scope="col">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={uid + i}>
                {row.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
