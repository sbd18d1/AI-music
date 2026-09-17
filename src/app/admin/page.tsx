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
  X,
  AlertCircle,
} from 'lucide-react';
import StatTile from '@/components/charts/StatTile';
import LineChart from '@/components/charts/LineChart';
import BarChart from '@/components/charts/BarChart';
import HBarList from '@/components/charts/HBarList';
import FunnelChart from '@/components/charts/FunnelChart';
import { ChartFrame } from '@/components/charts/ChartFrame';
import { CHART_COLORS } from '@/lib/chart-palette';

type PresetRange = '1d' | '3d' | '7d' | '30d' | 'custom';

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

interface PaymentRow {
  id: string;
  status: string;
  amountPaid: number | null;
  currency: string | null;
  customerEmail: string | null;
  couponCode: string | null;
  fromTrial: boolean;
  paypalOrderId: string | null;
  genre: string | null;
  country: string | null;
  city: string | null;
  ipAddress: string | null;
  deviceId: string | null;
  recipientName: string | null;
  title: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface Stats {
  range: string;
  window: { fromDay: string | null; toDay: string; days: number | null };
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
  payments: PaymentRow[];
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

interface PaymentDetail extends PaymentRow {
  userEmail?: string | null;
  coupon?: { code: string | null; value: number | null; currency: string | null; used: boolean } | null;
  trialOrderId?: string | null;
  duration?: string | null;
  aiRequestId?: string | null;
  emailSentAt?: string | null;
  location?: { country: string | null; city: string | null; region: string | null; referrer: string | null };
}

const PRESETS: { id: PresetRange; label: string }[] = [
  { id: '1d', label: '今天' },
  { id: '3d', label: '近 3 天' },
  { id: '7d', label: '近 7 天' },
  { id: '30d', label: '近 30 天' },
  { id: 'custom', label: '自定义' },
];

/** Fractional change vs the previous period, or null when there is no baseline. */
function delta(current: number, previous: number | undefined): number | null {
  if (previous === undefined) return null;
  if (!previous) return null; // never render +100% from a zero baseline
  return (current - previous) / previous;
}

const fmtMoney = (v: number | null, currency = 'USD') =>
  v === null ? '—' : `$${v.toFixed(2)} ${currency}`;

const fmtTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString('zh-CN') : '—');

export default function AdminDashboardPage() {
  const [range, setRange] = useState<PresetRange>('7d');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<PaymentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Restore the last range so a refresh doesn't reset.
  useEffect(() => {
    try {
      const savedRange = localStorage.getItem('admin_range') as PresetRange | null;
      if (savedRange && PRESETS.some((p) => p.id === savedRange)) setRange(savedRange);
      const savedFrom = localStorage.getItem('admin_from');
      const savedTo = localStorage.getItem('admin_to');
      if (savedFrom) setFrom(savedFrom);
      if (savedTo) setTo(savedTo);
    } catch {
      /* ignore */
    }
  }, []);

  const buildQuery = useCallback(
    (r: PresetRange, f: string, t: string) => {
      if (r === 'custom' && f && t) {
        return `/api/admin/stats?range=custom&from=${encodeURIComponent(f)}&to=${encodeURIComponent(t)}`;
      }
      return `/api/admin/stats?range=${r}`;
    },
    []
  );

  const load = useCallback(
    (r: PresetRange, f: string, t: string, signal?: AbortSignal) => {
      setLoading(true);
      setError('');
      fetch(buildQuery(r, f, t), { signal, cache: 'no-store' })
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
          if (e.name !== 'AbortError') setError(e.message || '加载失败');
        })
        .finally(() => setLoading(false));
    },
    [buildQuery]
  );

  useEffect(() => {
    try {
      localStorage.setItem('admin_range', range);
      localStorage.setItem('admin_from', from);
      localStorage.setItem('admin_to', to);
    } catch {
      /* ignore */
    }
    // A custom range needs both dates before it is worth querying.
    if (range === 'custom' && (!from || !to)) return;
    const ac = new AbortController();
    load(range, from, to, ac.signal);
    return () => ac.abort();
  }, [range, from, to, load]);

  const openDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/payments/${encodeURIComponent(id)}`);
      if (res.status === 401) {
        window.location.href = '/admin/login';
        return;
      }
      const d = await res.json();
      if (d?.success) setDetail(d.payment as PaymentDetail);
    } catch (e) {
      console.error('[admin] payment detail error:', e);
    } finally {
      setDetailLoading(false);
    }
  }, []);

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
        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="font-serif text-2xl md:text-3xl font-bold text-base-content">数据监控</h1>
            <p className="text-base-content/60 text-sm mt-1">
              Smart Music Lab · 访问量 / 生成接口 / 支付
              {data?.window && (
                <span className="ml-2 text-base-content/40">
                  （{data.window.fromDay ?? '最早'} ~ {data.window.toDay}）
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => load(range, from, to)}
              className="btn btn-sm"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </button>
            <button type="button" onClick={handleLogout} className="btn btn-sm">
              <LogOut className="w-4 h-4" />
              退出
            </button>
          </div>
        </div>

        {/* ---- Time range selector ---- */}
        <div className="bg-base-200/80 border border-base-300 rounded-2xl p-4 shadow-vintage mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="join" role="group" aria-label="时间范围">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setRange(p.id)}
                  aria-pressed={range === p.id}
                  className={`btn btn-sm join-item ${range === p.id ? 'btn-active' : ''}`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {range === 'custom' && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={from}
                  max={to || undefined}
                  onChange={(e) => setFrom(e.target.value)}
                  className="input input-sm input-bordered bg-white"
                  aria-label="开始日期"
                />
                <span className="text-base-content/50 text-sm">至</span>
                <input
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => setTo(e.target.value)}
                  className="input input-sm input-bordered bg-white"
                  aria-label="结束日期"
                />
                {(!from || !to) && (
                  <span className="text-base-content/50 text-xs">请选择开始和结束日期</span>
                )}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-error/10 border border-error/30 rounded-xl p-4 mb-6 flex items-center justify-between gap-3">
            <p className="text-error text-sm">加载失败：{error}</p>
            <button type="button" onClick={() => load(range, from, to)} className="btn btn-sm bg-primary text-white">
              重试
            </button>
          </div>
        )}

        {loading && !data ? (
          <DashboardSkeleton />
        ) : data ? (
          <div className="space-y-6" aria-busy={loading}>
            {/* ---- KPI 磁贴 ---- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatTile
                label="访问量"
                value={data.totals.views}
                icon={<Eye className="w-6 h-6 text-primary" />}
                delta={delta(data.totals.views, prev?.views)}
                sub={prev ? `上期 ${prev.views}` : undefined}
              />
              <StatTile
                label="独立访客"
                value={data.totals.visitors}
                icon={<Users className="w-6 h-6 text-primary" />}
                delta={delta(data.totals.visitors, prev?.visitors)}
                sub={prev ? `上期 ${prev.visitors}` : undefined}
              />
              <StatTile
                label="生成调用"
                value={data.totals.trialsStarted}
                icon={<Music className="w-6 h-6 text-primary" />}
                delta={delta(data.totals.trialsStarted, prev?.trialsStarted)}
                sub={prev ? `上期 ${prev.trialsStarted}` : undefined}
              />
              <StatTile
                label="支付笔数"
                value={data.totals.paid}
                icon={<CreditCard className="w-6 h-6 text-primary" />}
                delta={delta(data.totals.paid, prev?.paid)}
                sub={prev ? `上期 ${prev.paid}` : undefined}
              />
              <StatTile
                label="收入"
                value={data.totals.revenue}
                prefix="$"
                icon={<DollarSign className="w-6 h-6 text-primary" />}
                delta={delta(data.totals.revenue, prev?.revenue)}
                sub={prev ? `上期 $${prev.revenue}` : undefined}
              />
              <StatTile
                label="试听成功率"
                value={
                  data.totals.trialsStarted
                    ? `${Math.round((data.totals.trialsCompleted / data.totals.trialsStarted) * 1000) / 10}%`
                    : '—'
                }
                icon={<CheckCircle2 className="w-6 h-6 text-primary" />}
                sub={`${data.totals.trialsCompleted}/${data.totals.trialsStarted} 完成`}
              />
              <StatTile
                label="访问最多国家"
                value={data.totals.topCountry || '—'}
                icon={<Globe className="w-6 h-6 text-primary" />}
                sub={`共 ${data.countries.length} 个国家`}
              />
              <StatTile
                label="访问最多城市"
                value={data.totals.topCity || '—'}
                icon={<MapPin className="w-6 h-6 text-primary" />}
                sub={`共 ${data.cities.length} 个城市`}
              />
            </div>

            {/* ---- 付款明细 ---- */}
            <section className="bg-base-200/80 border border-base-300 rounded-2xl p-5 md:p-6 shadow-vintage">
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
                <h3 className="font-serif text-lg font-bold text-base-content">付款记录</h3>
                <p className="text-base-content/60 text-xs">
                  共 {data.payments.length} 笔 · 点击任意一行查看详情
                </p>
              </div>

              {data.payments.length === 0 ? (
                <p className="text-base-content/50 text-sm py-6 text-center">该时间段暂无付款记录</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-base-content/60 border-b border-base-300">
                        <th className="py-2 pr-3 font-medium whitespace-nowrap">支付时间</th>
                        <th className="py-2 pr-3 font-medium whitespace-nowrap">实际支付金额</th>
                        <th className="py-2 pr-3 font-medium">支付用户</th>
                        <th className="py-2 pr-3 font-medium">地区</th>
                        <th className="py-2 pr-3 font-medium">歌曲</th>
                        <th className="py-2 font-medium">用券</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.payments.map((p) => (
                        <tr
                          key={p.id}
                          onClick={() => openDetail(p.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openDetail(p.id);
                            }
                          }}
                          tabIndex={0}
                          role="button"
                          className="border-b border-base-300/60 hover:bg-base-200/60 transition-colors cursor-pointer focus:outline-none focus:bg-base-200"
                          title="点击查看详情"
                        >
                          <td className="py-2 pr-3 whitespace-nowrap tabular-nums text-base-content/70">
                            {fmtTime(p.updatedAt || p.createdAt)}
                          </td>
                          <td className="py-2 pr-3 whitespace-nowrap">
                            {p.amountPaid === null ? (
                              <span className="text-warning text-xs" title="该订单早于金额记录功能上线，无金额数据">
                                无记录
                              </span>
                            ) : (
                              <span className="font-semibold text-base-content tabular-nums">
                                {fmtMoney(p.amountPaid, p.currency || 'USD')}
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-base-content/80 max-w-[14rem] truncate">
                            {p.customerEmail || '—'}
                          </td>
                          <td className="py-2 pr-3 text-base-content/70 whitespace-nowrap">
                            {[p.city, p.country].filter(Boolean).join(', ') || '—'}
                          </td>
                          <td className="py-2 pr-3 text-base-content/70 max-w-[12rem] truncate">
                            {p.title || p.genre || '—'}
                          </td>
                          <td className="py-2">
                            {p.couponCode ? (
                              <span className="badge badge-sm bg-warning/20 text-base-content border-0">已用券</span>
                            ) : (
                              <span className="text-base-content/40 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {data.payments.some((p) => p.amountPaid === null) && (
                <p className="text-base-content/50 text-xs mt-3 flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  标记「无记录」的订单发生在金额统计功能上线之前，无法回溯，因此不计入收入合计。
                </p>
              )}
            </section>

            {/* ---- 流量趋势 ---- */}
            <ChartFrame
              title="访问趋势"
              subtitle="每日页面访问量与独立访客数"
              ariaLabel="每日页面访问量与独立访客数"
              legend={[
                { label: '访问量', color: CHART_COLORS.primary },
                { label: '独立访客', color: CHART_COLORS.secondary, dashed: true },
              ]}
              isEmpty={!hasAnyTraffic}
              emptyHint="有访客访问后这里会显示数据。"
              table={{
                headers: ['日期', '访问量', '独立访客'],
                rows: data.visitsByDay.map((d) => [d.day, d.views ?? 0, d.visitors ?? 0]),
              }}
            >
              <LineChart
                labels={dayLabels}
                ariaLabel="每日页面访问量与独立访客数"
                series={[
                  {
                    key: 'views',
                    label: '访问量',
                    color: CHART_COLORS.primary,
                    data: data.visitsByDay.map((d) => d.views ?? 0),
                  },
                  {
                    key: 'visitors',
                    label: '独立访客',
                    color: CHART_COLORS.secondary,
                    dashed: true,
                    data: data.visitsByDay.map((d) => d.visitors ?? 0),
                  },
                ]}
              />
            </ChartFrame>

            {/* ---- 生成 ---- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartFrame
                title="歌曲生成调用"
                subtitle="每日免费试听与付费提交次数"
                ariaLabel="每日歌曲生成调用，区分免费试听与付费"
                legend={[
                  { label: '免费试听', color: CHART_COLORS.primary },
                  { label: '付费', color: CHART_COLORS.secondary, dashed: true },
                ]}
                isEmpty={!hasAnyOrders}
                table={{
                  headers: ['日期', '免费试听', '付费'],
                  rows: data.generationsByDay.map((d) => [d.day, d.trialCalls ?? 0, d.paidCalls ?? 0]),
                }}
              >
                <LineChart
                  labels={dayLabels}
                  ariaLabel="每日歌曲生成调用，区分免费试听与付费"
                  series={[
                    {
                      key: 'trial',
                      label: '免费试听',
                      color: CHART_COLORS.primary,
                      data: data.generationsByDay.map((d) => d.trialCalls ?? 0),
                    },
                    {
                      key: 'paid',
                      label: '付费',
                      color: CHART_COLORS.secondary,
                      dashed: true,
                      data: data.generationsByDay.map((d) => d.paidCalls ?? 0),
                    },
                  ]}
                />
              </ChartFrame>

              <ChartFrame
                title="生成结果"
                subtitle="按结果确定日期统计（生成较慢的歌曲可能落在次日）"
                ariaLabel="每日生成成功与失败次数"
                legend={[
                  { label: '成功', color: CHART_COLORS.success },
                  { label: '失败', color: CHART_COLORS.error },
                ]}
                isEmpty={!hasAnyOrders}
                table={{
                  headers: ['日期', '成功', '失败'],
                  rows: data.outcomesByDay.map((d) => [d.day, d.success ?? 0, d.failed ?? 0]),
                }}
              >
                <LineChart
                  labels={dayLabels}
                  ariaLabel="每日生成成功与失败次数"
                  series={[
                    {
                      key: 'success',
                      label: '成功',
                      color: CHART_COLORS.success,
                      data: data.outcomesByDay.map((d) => d.success ?? 0),
                    },
                    {
                      key: 'failed',
                      label: '失败',
                      color: CHART_COLORS.error,
                      data: data.outcomesByDay.map((d) => d.failed ?? 0),
                    },
                  ]}
                />
              </ChartFrame>
            </div>

            {/* ---- 支付 ---- */}
            <ChartFrame
              title="支付趋势"
              subtitle="每日完成的 PayPal 扣款笔数与金额"
              ariaLabel="每日支付笔数与收入"
              legend={[
                { label: '支付笔数', color: CHART_COLORS.secondary },
                { label: '收入 ($)', color: CHART_COLORS.info, hatched: true },
              ]}
              isEmpty={(data.totals.paid ?? 0) === 0}
              table={{
                headers: ['日期', '支付笔数', '券全额免单', '收入 (USD)'],
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
                ariaLabel="每日支付笔数与收入"
                formatValue={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v)))}
                series={[
                  {
                    key: 'payments',
                    label: '支付笔数',
                    color: CHART_COLORS.secondary,
                    data: data.paymentsByDay.map((d) => d.payments ?? 0),
                  },
                  {
                    key: 'revenue',
                    label: '收入 ($)',
                    color: CHART_COLORS.info,
                    hatched: true,
                    data: data.paymentsByDay.map((d) => d.revenue ?? 0),
                  },
                ]}
              />
            </ChartFrame>

            {/* ---- 漏斗 + 地区 ---- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="bg-base-200/80 border border-base-300 rounded-2xl p-5 md:p-6 shadow-vintage">
                <h3 className="font-serif text-lg font-bold text-base-content mb-1">转化漏斗</h3>
                <p className="text-base-content/60 text-xs mb-5">
                  整体「访问 → 付费」转化率：
                  <span className="font-semibold text-base-content">
                    {data.funnel.rates.visitToPaid === null
                      ? '—'
                      : `${Math.round(data.funnel.rates.visitToPaid * 1000) / 10}%`}
                  </span>
                </p>
                <FunnelChart
                  stages={[
                    { label: '访客', count: data.funnel.visitors, rateFromPrev: null, color: CHART_COLORS.primary },
                    {
                      label: '开始试听',
                      count: data.funnel.trialsStarted,
                      rateFromPrev: data.funnel.rates.visitToTrial,
                      color: CHART_COLORS.secondary,
                    },
                    {
                      label: '试听完成',
                      count: data.funnel.trialsCompleted,
                      rateFromPrev: data.funnel.rates.trialToComplete,
                      color: CHART_COLORS.info,
                    },
                    {
                      label: '发起结账',
                      count: data.funnel.checkoutsStarted,
                      rateFromPrev: data.funnel.rates.completeToCheckout,
                      color: CHART_COLORS.warning,
                    },
                    {
                      label: '完成付费',
                      count: data.funnel.paid,
                      rateFromPrev: data.funnel.rates.checkoutToPaid,
                      color: CHART_COLORS.success,
                    },
                  ]}
                />
              </section>

              <section className="bg-base-200/80 border border-base-300 rounded-2xl p-5 md:p-6 shadow-vintage">
                <h3 className="font-serif text-lg font-bold text-base-content mb-1">访客地区</h3>
                <p className="text-base-content/60 text-xs mb-4">国家与城市，来自托管服务商的请求头</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <h4 className="text-xs font-semibold text-base-content/70 uppercase tracking-wide mb-3">
                      国家
                    </h4>
                    <HBarList
                      items={data.countries.map((c) => ({ label: c.label, value: c.views, hint: `${c.views}` }))}
                      emptyHint="暂无地区数据"
                    />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-base-content/70 uppercase tracking-wide mb-3">
                      城市
                    </h4>
                    <HBarList
                      items={data.cities.map((c) => ({ label: c.label, value: c.views, hint: `${c.views}` }))}
                      color={CHART_COLORS.secondary}
                      emptyHint="暂无地区数据"
                    />
                  </div>
                </div>
              </section>
            </div>

            {/* ---- 热门页面 / 来源 ---- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="bg-base-200/80 border border-base-300 rounded-2xl p-5 md:p-6 shadow-vintage">
                <h3 className="font-serif text-lg font-bold text-base-content mb-4">热门页面</h3>
                <HBarList
                  items={data.topPaths.map((p) => ({ label: p.label, value: p.views, hint: `${p.views}` }))}
                  emptyHint="暂无页面访问"
                />
              </section>
              <section className="bg-base-200/80 border border-base-300 rounded-2xl p-5 md:p-6 shadow-vintage">
                <h3 className="font-serif text-lg font-bold text-base-content mb-4">访问来源</h3>
                <HBarList
                  items={data.topReferrers.map((p) => ({ label: p.label, value: p.views, hint: `${p.views}` }))}
                  color={CHART_COLORS.info}
                  emptyHint="暂无来源数据"
                />
              </section>
            </div>

            {/* ---- 最近活动 ---- */}
            <section className="bg-base-200/80 border border-base-300 rounded-2xl p-5 md:p-6 shadow-vintage">
              <h3 className="font-serif text-lg font-bold text-base-content mb-4">最近活动</h3>
              {data.recent.length === 0 ? (
                <p className="text-base-content/50 text-sm py-4 text-center">暂无活动</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-base-content/60 border-b border-base-300">
                        <th className="py-2 pr-3 font-medium whitespace-nowrap">时间</th>
                        <th className="py-2 pr-3 font-medium">类型</th>
                        <th className="py-2 pr-3 font-medium">页面</th>
                        <th className="py-2 pr-3 font-medium">地区</th>
                        <th className="py-2 pr-3 font-medium">来源</th>
                        <th className="py-2 font-medium">设备</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recent.map((e, i) => (
                        <tr key={i} className="border-b border-base-300/60 hover:bg-base-200/60 transition-colors">
                          <td className="py-2 pr-3 whitespace-nowrap tabular-nums text-base-content/70">
                            {fmtTime(e.at)}
                          </td>
                          <td className="py-2 pr-3">
                            <span className="badge badge-sm bg-primary/10 text-primary border-0">
                              {EVENT_LABELS[e.type] || e.type}
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

      {/* ---- 付款详情弹窗 ---- */}
      {(detail || detailLoading) && (
        <PaymentDetailModal
          detail={detail}
          loading={detailLoading}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

const EVENT_LABELS: Record<string, string> = {
  pageview: '浏览',
  identify: '身份识别',
  trial_start: '开始试听',
  checkout_start: '发起结账',
  share: '分享',
  download: '下载',
};

function PaymentDetailModal({
  detail,
  loading,
  onClose,
}: {
  detail: PaymentDetail | null;
  loading: boolean;
  onClose: () => void;
}) {
  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-base-300/60 last:border-0">
      <span className="text-base-content/60 text-sm flex-shrink-0">{label}</span>
      <span className="text-base-content text-sm text-right break-all">{value}</span>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-base-100 border-2 border-base-content rounded-2xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="付款详情"
      >
        <div className="flex items-center justify-between p-5 border-b border-base-300">
          <h3 className="font-serif text-lg font-bold text-base-content">付款详情</h3>
          <button type="button" onClick={onClose} className="btn btn-sm btn-ghost" aria-label="关闭">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading || !detail ? (
          <div className="p-10 flex items-center justify-center gap-2 text-base-content/60 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            加载中…
          </div>
        ) : (
          <div className="p-5">
            <div className="bg-base-200/80 border border-base-300 rounded-xl p-4 mb-4 text-center">
              <p className="text-base-content/60 text-xs mb-1">实际支付金额</p>
              <p className="font-serif text-3xl font-bold text-base-content tabular-nums">
                {detail.amountPaid === null ? '无记录' : fmtMoney(detail.amountPaid, detail.currency || 'USD')}
              </p>
              {detail.amountPaid === null && (
                <p className="text-warning text-xs mt-1">该订单早于金额统计功能上线</p>
              )}
            </div>

            <Row label="支付时间" value={fmtTime(detail.updatedAt || detail.createdAt)} />
            <Row label="下单时间" value={fmtTime(detail.createdAt)} />
            <Row label="支付用户邮箱" value={detail.customerEmail || '—'} />
            <Row label="订单状态" value={detail.status} />
            <Row label="PayPal 交易号" value={<span className="font-mono text-xs">{detail.paypalOrderId || '—'}</span>} />
            <Row label="内部订单号" value={<span className="font-mono text-xs">{detail.id}</span>} />
            <Row
              label="地区"
              value={
                [detail.location?.city, detail.location?.region, detail.location?.country]
                  .filter(Boolean)
                  .join(', ') || '—'
              }
            />
            <Row label="设备指纹" value={<span className="font-mono text-xs">{detail.deviceId || '—'}</span>} />
            <Row label="下单 IP" value={<span className="font-mono text-xs">{detail.ipAddress || '—'}</span>} />
            <Row label="歌曲" value={detail.title || detail.genre || '—'} />
            <Row label="收件人" value={detail.recipientName || '—'} />
            <Row label="来源" value={detail.location?.referrer || '—'} />
            <Row
              label="抵扣券"
              value={
                detail.couponCode
                  ? `${detail.couponCode}${detail.coupon?.value ? `（面值 $${Number(detail.coupon.value).toFixed(2)}）` : ''}`
                  : '未使用'
              }
            />
            <Row label="解锁方式" value={detail.fromTrial ? '解锁已生成的试听歌曲' : '支付后全新生成'} />
            <Row label="邮件发送" value={detail.emailSentAt ? fmtTime(detail.emailSentAt) : '未发送'} />
          </div>
        )}
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
      <div className="animate-pulse bg-base-300/60 rounded-2xl h-64" />
      <div className="animate-pulse bg-base-300/60 rounded-2xl h-72" />
      <div className="flex items-center justify-center gap-2 text-base-content/50 text-sm py-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        加载中…
      </div>
    </div>
  );
}
