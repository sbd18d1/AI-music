'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Eye,
  Users,
  Globe,
  MapPin,
  Music,
  CheckCircle2,
  CreditCard,
  DollarSign,
  RefreshCw,
  LogOut,
  Loader2,
} from 'lucide-react';
import StatTile from '@/components/charts/StatTile';
import LineChart from '@/components/charts/LineChart';
import BarChart from '@/components/charts/BarChart';
import HBarList from '@/components/charts/HBarList';
import FunnelChart from '@/components/charts/FunnelChart';
import { ChartFrame } from '@/components/charts/ChartFrame';
import { CHART_COLORS } from '@/lib/chart-palette';

type Range = '7d' | '30d' | '90d' | 'all';

interface DayPoint {
  day: string;
  views?: number;
  visitors?: number;
  events?: number;
  trialCalls?: number;
  paidCalls?: number;
  success?: number;
  failed?: number;
  payments?: number;
  revenue?: number;
  freeViaCoupon?: number;
}

interface Stats {
  range: string;
  visitsByDay: DayPoint[];
  generationsByDay: DayPoint[];
  outcomesByDay: DayPoint[];
  paymentsByDay: DayPoint[];
  topPaths: { label: string; views: number; visitors: number }[];
  topReferrers: { label: string; views: number }[];
  countries: { label: string; views: number; visitors: number }[];
  cities: { label: string; views: number; visitors: number }[];
  funnel: {
    visitors: number;
    trialsStarted: number;
    trialsCompleted: number;
    checkoutsStarted: number;
    paid: number;
    rates: Record<string, number | null>;
  };
  totals: {
    views: number;
    visitors: number;
    trialsStarted: number;
    trialsCompleted: number;
    checkoutsStarted: number;
    paid: number;
    revenue: number;
    topCountry: string | null;
    topCity: string | null;
  };
  previousTotals: {
    views: number;
    visitors: number;
    trialsStarted: number;
    trialsCompleted: number;
    checkoutsStarted: number;
    paid: number;
    revenue: number;
  } | null;
  recent: {
    type: string;
    path: string;
    country: string | null;
    city: string | null;
    deviceId: string | null;
    referrer: string | null;
    at: string | null;
  }[];
}

const RANGES: { id: Range; label: string }[] = [
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: '90d', label: '90d' },
  { id: 'all', label: 'All' },
];

/** Fractional change vs the previous period, or null when there is no baseline. */
function delta(current: number, previous: number | undefined): number | null {
  if (previous === undefined) return null;
  if (!previous) return null; // never render +100% from a zero baseline
  return (current - previous) / previous;
}

export default function AdminDashboardPage() {
  const [range, setRange] = useState<Range>('30d');
  const [data, setData] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Restore the last range so a refresh doesn't snap back to 30d.
  useEffect(() => {
    try {
      const saved = localStorage.getItem('admin_range') as Range | null;
      if (saved && RANGES.some((r) => r.id === saved)) setRange(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(
    (r: Range, signal?: AbortSignal) => {
      setLoading(true);
      setError('');
      fetch(`/api/admin/stats?range=${r}`, { signal, cache: 'no-store' })
        .then(async (res) => {
          if (res.status === 401) {
            // The cookie can expire mid-session; the page middleware doesn't guard fetches.
            window.location.href = '/admin/login';
            return null;
          }
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((d) => {
          if (d) setData(d as Stats);
        })
        .catch((e: Error) => {
          if (e.name !== 'AbortError') setError(e.message || 'Failed to load');
        })
        .finally(() => setLoading(false));
    },
    []
  );

  useEffect(() => {
    try {
      localStorage.setItem('admin_range', range);
    } catch {
      /* ignore */
    }
    const ac = new AbortController();
    load(range, ac.signal);
    return () => ac.abort();
  }, [range, load]);

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    window.location.href = '/admin/login';
  };

  const dayLabels = (data?.visitsByDay ?? []).map((d) => d.day);
  const prev = data?.previousTotals ?? undefined;
  const hasAnyTraffic = (data?.totals.views ?? 0) > 0;
  const hasAnyOrders = (data?.totals.trialsStarted ?? 0) > 0 || (data?.totals.paid ?? 0) > 0;

  return (
    <div className="min-h-screen bg-base-200">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="font-serif text-2xl md:text-3xl font-bold text-base-content">
              Monitoring
            </h1>
            <p className="text-base-content/60 text-sm mt-1">
              Traffic, generation and payments for Smart Music Lab
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="join" role="group" aria-label="Date range">
              {RANGES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRange(r.id)}
                  aria-pressed={range === r.id}
                  className={`btn btn-sm join-item ${range === r.id ? 'btn-active' : ''}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => load(range)}
              className="btn btn-sm"
              aria-label="Refresh"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button type="button" onClick={handleLogout} className="btn btn-sm" aria-label="Sign out">
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-error/10 border border-error/30 rounded-xl p-4 mb-6 flex items-center justify-between gap-3">
            <p className="text-error text-sm">Failed to load stats: {error}</p>
            <button type="button" onClick={() => load(range)} className="btn btn-sm bg-primary text-white">
              Retry
            </button>
          </div>
        )}

        {loading && !data ? (
          <DashboardSkeleton />
        ) : data ? (
          <div className="space-y-6" aria-busy={loading}>
            {/* ---- KPI tiles ---- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatTile
                label="Page views"
                value={data.totals.views}
                icon={<Eye className="w-6 h-6 text-primary" />}
                delta={delta(data.totals.views, prev?.views)}
                sub={prev ? `vs previous ${prev.views}` : undefined}
              />
              <StatTile
                label="Unique visitors"
                value={data.totals.visitors}
                icon={<Users className="w-6 h-6 text-primary" />}
                delta={delta(data.totals.visitors, prev?.visitors)}
                sub={prev ? `vs previous ${prev.visitors}` : undefined}
              />
              <StatTile
                label="Generation calls"
                value={data.totals.trialsStarted}
                icon={<Music className="w-6 h-6 text-primary" />}
                delta={delta(data.totals.trialsStarted, prev?.trialsStarted)}
                sub={prev ? `vs previous ${prev.trialsStarted}` : undefined}
              />
              <StatTile
                label="Payments"
                value={data.totals.paid}
                icon={<CreditCard className="w-6 h-6 text-primary" />}
                delta={delta(data.totals.paid, prev?.paid)}
                sub={prev ? `vs previous ${prev.paid}` : undefined}
              />
              <StatTile
                label="Revenue"
                value={data.totals.revenue}
                prefix="$"
                icon={<DollarSign className="w-6 h-6 text-primary" />}
                delta={delta(data.totals.revenue, prev?.revenue)}
                sub={prev ? `vs previous $${prev.revenue}` : undefined}
              />
              <StatTile
                label="Trial success rate"
                value={
                  data.totals.trialsStarted
                    ? `${Math.round((data.totals.trialsCompleted / data.totals.trialsStarted) * 1000) / 10}%`
                    : '—'
                }
                icon={<CheckCircle2 className="w-6 h-6 text-primary" />}
                sub={`${data.totals.trialsCompleted}/${data.totals.trialsStarted} completed`}
              />
              <StatTile
                label="Top country"
                value={data.totals.topCountry || '—'}
                icon={<Globe className="w-6 h-6 text-primary" />}
                sub={`${data.countries.length} countries`}
              />
              <StatTile
                label="Top city"
                value={data.totals.topCity || '—'}
                icon={<MapPin className="w-6 h-6 text-primary" />}
                sub={`${data.cities.length} cities`}
              />
            </div>

            {/* ---- Traffic over time ---- */}
            <ChartFrame
              title="Traffic"
              subtitle="Page views and unique visitors per day"
              ariaLabel="Page views and unique visitors per day"
              legend={[
                { label: 'Page views', color: CHART_COLORS.primary },
                { label: 'Unique visitors', color: CHART_COLORS.secondary, dashed: true },
              ]}
              isEmpty={!hasAnyTraffic}
              emptyHint="Traffic appears here once visitors reach the site."
              table={{
                headers: ['Day', 'Page views', 'Unique visitors'],
                rows: data.visitsByDay.map((d) => [d.day, d.views ?? 0, d.visitors ?? 0]),
              }}
            >
              <LineChart
                labels={dayLabels}
                ariaLabel="Page views and unique visitors per day"
                series={[
                  {
                    key: 'views',
                    label: 'Page views',
                    color: CHART_COLORS.primary,
                    data: data.visitsByDay.map((d) => d.views ?? 0),
                  },
                  {
                    key: 'visitors',
                    label: 'Unique visitors',
                    color: CHART_COLORS.secondary,
                    dashed: true,
                    data: data.visitsByDay.map((d) => d.visitors ?? 0),
                  },
                ]}
              />
            </ChartFrame>

            {/* ---- Generation ---- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartFrame
                title="Song generation calls"
                subtitle="Trial and paid submissions per day"
                ariaLabel="Song generation calls per day, split by trial and paid"
                legend={[
                  { label: 'Free trials', color: CHART_COLORS.primary },
                  { label: 'Paid', color: CHART_COLORS.secondary, dashed: true },
                ]}
                isEmpty={!hasAnyOrders}
                table={{
                  headers: ['Day', 'Free trials', 'Paid'],
                  rows: data.generationsByDay.map((d) => [d.day, d.trialCalls ?? 0, d.paidCalls ?? 0]),
                }}
              >
                <LineChart
                  labels={dayLabels}
                  ariaLabel="Song generation calls per day, split by trial and paid"
                  series={[
                    {
                      key: 'trial',
                      label: 'Free trials',
                      color: CHART_COLORS.primary,
                      data: data.generationsByDay.map((d) => d.trialCalls ?? 0),
                    },
                    {
                      key: 'paid',
                      label: 'Paid',
                      color: CHART_COLORS.secondary,
                      dashed: true,
                      data: data.generationsByDay.map((d) => d.paidCalls ?? 0),
                    },
                  ]}
                />
              </ChartFrame>

              <ChartFrame
                title="Generation outcomes"
                subtitle="Settled per day (a slow song can land a day later)"
                ariaLabel="Generation outcomes per day: success and failed"
                legend={[
                  { label: 'Success', color: CHART_COLORS.success },
                  { label: 'Failed', color: CHART_COLORS.error },
                ]}
                isEmpty={!hasAnyOrders}
                table={{
                  headers: ['Day', 'Success', 'Failed'],
                  rows: data.outcomesByDay.map((d) => [d.day, d.success ?? 0, d.failed ?? 0]),
                }}
              >
                <LineChart
                  labels={dayLabels}
                  ariaLabel="Generation outcomes per day: success and failed"
                  series={[
                    {
                      key: 'success',
                      label: 'Success',
                      color: CHART_COLORS.success,
                      data: data.outcomesByDay.map((d) => d.success ?? 0),
                    },
                    {
                      key: 'failed',
                      label: 'Failed',
                      color: CHART_COLORS.error,
                      data: data.outcomesByDay.map((d) => d.failed ?? 0),
                    },
                  ]}
                />
              </ChartFrame>
            </div>

            {/* ---- Payments ---- */}
            <ChartFrame
              title="Payments"
              subtitle="Completed PayPal captures per day"
              ariaLabel="Payments and revenue per day"
              legend={[
                { label: 'Payments', color: CHART_COLORS.secondary },
                { label: 'Revenue ($)', color: CHART_COLORS.info, hatched: true },
              ]}
              isEmpty={(data.totals.paid ?? 0) === 0}
              table={{
                headers: ['Day', 'Payments', '$0 coupon unlocks', 'Revenue (USD)'],
                rows: data.paymentsByDay.map((d) => [
                  d.day,
                  d.payments ?? 0,
                  d.freeViaCoupon ?? 0,
                  d.revenue ?? 0,
                ]),
              }}
            >
              <BarChart
                labels={dayLabels}
                ariaLabel="Payments and revenue per day"
                formatValue={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v)))}
                series={[
                  {
                    key: 'payments',
                    label: 'Payments',
                    color: CHART_COLORS.secondary,
                    data: data.paymentsByDay.map((d) => d.payments ?? 0),
                  },
                  {
                    key: 'revenue',
                    label: 'Revenue ($)',
                    color: CHART_COLORS.info,
                    hatched: true,
                    data: data.paymentsByDay.map((d) => d.revenue ?? 0),
                  },
                ]}
              />
            </ChartFrame>

            {/* ---- Funnel + geo ---- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="bg-base-200/80 border border-base-300 rounded-2xl p-5 md:p-6 shadow-vintage">
                <h3 className="font-serif text-lg font-bold text-base-content mb-1">Conversion funnel</h3>
                <p className="text-base-content/60 text-xs mb-5">
                  Overall visit → paid:{' '}
                  <span className="font-semibold text-base-content">
                    {data.funnel.rates.visitToPaid === null
                      ? '—'
                      : `${Math.round(data.funnel.rates.visitToPaid * 1000) / 10}%`}
                  </span>
                </p>
                <FunnelChart
                  stages={[
                    {
                      label: 'Visitors',
                      count: data.funnel.visitors,
                      rateFromPrev: null,
                      color: CHART_COLORS.primary,
                    },
                    {
                      label: 'Trials started',
                      count: data.funnel.trialsStarted,
                      rateFromPrev: data.funnel.rates.visitToTrial,
                      color: CHART_COLORS.secondary,
                    },
                    {
                      label: 'Trials completed',
                      count: data.funnel.trialsCompleted,
                      rateFromPrev: data.funnel.rates.trialToComplete,
                      color: CHART_COLORS.info,
                    },
                    {
                      label: 'Checkouts started',
                      count: data.funnel.checkoutsStarted,
                      rateFromPrev: data.funnel.rates.completeToCheckout,
                      color: CHART_COLORS.warning,
                    },
                    {
                      label: 'Paid',
                      count: data.funnel.paid,
                      rateFromPrev: data.funnel.rates.checkoutToPaid,
                      color: CHART_COLORS.success,
                    },
                  ]}
                />
              </section>

              <section className="bg-base-200/80 border border-base-300 rounded-2xl p-5 md:p-6 shadow-vintage">
                <h3 className="font-serif text-lg font-bold text-base-content mb-1">Visitor locations</h3>
                <p className="text-base-content/60 text-xs mb-4">
                  Country and city, from the hosting provider&apos;s request headers
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <h4 className="text-xs font-semibold text-base-content/70 uppercase tracking-wide mb-3">
                      Countries
                    </h4>
                    <HBarList
                      items={data.countries.map((c) => ({
                        label: c.label,
                        value: c.views,
                        hint: `${c.views}`,
                      }))}
                      emptyHint="No location data yet"
                    />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-base-content/70 uppercase tracking-wide mb-3">
                      Cities
                    </h4>
                    <HBarList
                      items={data.cities.map((c) => ({
                        label: c.label,
                        value: c.views,
                        hint: `${c.views}`,
                      }))}
                      color={CHART_COLORS.secondary}
                      emptyHint="No location data yet"
                    />
                  </div>
                </div>
              </section>
            </div>

            {/* ---- Top pages / referrers ---- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="bg-base-200/80 border border-base-300 rounded-2xl p-5 md:p-6 shadow-vintage">
                <h3 className="font-serif text-lg font-bold text-base-content mb-4">Top pages</h3>
                <HBarList
                  items={data.topPaths.map((p) => ({ label: p.label, value: p.views, hint: `${p.views}` }))}
                  emptyHint="No page views yet"
                />
              </section>
              <section className="bg-base-200/80 border border-base-300 rounded-2xl p-5 md:p-6 shadow-vintage">
                <h3 className="font-serif text-lg font-bold text-base-content mb-4">Top referrers</h3>
                <HBarList
                  items={data.topReferrers.map((p) => ({ label: p.label, value: p.views, hint: `${p.views}` }))}
                  color={CHART_COLORS.info}
                  emptyHint="No referrer data yet"
                />
              </section>
            </div>

            {/* ---- Recent events ---- */}
            <section className="bg-base-200/80 border border-base-300 rounded-2xl p-5 md:p-6 shadow-vintage">
              <h3 className="font-serif text-lg font-bold text-base-content mb-4">Recent activity</h3>
              {data.recent.length === 0 ? (
                <p className="text-base-content/50 text-sm py-4 text-center">No activity yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-base-content/60 border-b border-base-300">
                        <th className="py-2 pr-3 font-medium whitespace-nowrap">Time</th>
                        <th className="py-2 pr-3 font-medium">Type</th>
                        <th className="py-2 pr-3 font-medium">Path</th>
                        <th className="py-2 pr-3 font-medium">Location</th>
                        <th className="py-2 pr-3 font-medium">Referrer</th>
                        <th className="py-2 font-medium">Device</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recent.map((e, i) => (
                        <tr key={i} className="border-b border-base-300/60 hover:bg-base-200/60 transition-colors">
                          <td className="py-2 pr-3 whitespace-nowrap tabular-nums text-base-content/70">
                            {e.at ? new Date(e.at).toLocaleString() : '—'}
                          </td>
                          <td className="py-2 pr-3">
                            <span className="badge badge-sm bg-primary/10 text-primary border-0">
                              {e.type}
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-base-content/80 max-w-[16rem] truncate">{e.path}</td>
                          <td className="py-2 pr-3 text-base-content/70 whitespace-nowrap">
                            {[e.city, e.country].filter(Boolean).join(', ') || '—'}
                          </td>
                          <td className="py-2 pr-3 text-base-content/70 max-w-[12rem] truncate">
                            {e.referrer || '—'}
                          </td>
                          <td className="py-2 text-base-content/50 font-mono text-xs">
                            {e.deviceId ? `${e.deviceId.slice(0, 8)}…` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="animate-pulse bg-base-300/60 rounded-2xl h-28" />
        ))}
      </div>
      <div className="animate-pulse bg-base-300/60 rounded-2xl h-72" />
      <div className="animate-pulse bg-base-300/60 rounded-2xl h-72" />
      <div className="flex items-center justify-center gap-2 text-base-content/50 text-sm py-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading dashboard…
      </div>
    </div>
  );
}
