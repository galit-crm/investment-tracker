'use client';

import { useAnalyticsSummary, useRankings, useAllocation } from '@/hooks/useApi';
import { useAuthStore } from '@/stores/auth.store';
import { StatCard } from '@/components/dashboard/stat-card';
import { AllocationChart } from '@/components/charts/allocation-chart';
import { formatCurrency, formatPercent, pnlColor } from '@/lib/format';
import { clsx } from 'clsx';
import type { HoldingWithPnl } from '@/types';

export default function AnalyticsPage() {
  const { user } = useAuthStore();
  const { data: summary } = useAnalyticsSummary();
  const { data: rankings } = useRankings();
  const { data: allocation } = useAllocation();

  const currency = user?.settings?.baseCurrency ?? 'USD';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Analytics</h1>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Value" value={summary?.totalValue ?? null} currency={currency} loading={!summary} />
        <StatCard label="Unrealized P&L" value={summary?.totalUnrealizedPnl ?? null} changePercent={summary?.totalUnrealizedPnlPercent ?? null} currency={currency} loading={!summary} />
        <StatCard label="Realized P&L" value={summary?.totalRealizedPnl ?? null} currency={currency} loading={!summary} />
        <StatCard label="Total Return" value={summary?.totalPnl ?? null} changePercent={summary?.totalPnlPercent ?? null} currency={currency} loading={!summary} />
      </div>

      {/* Allocation charts */}
      {allocation && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AllocationChart data={allocation.byAssetClass} title="By Asset Class" />
          <AllocationChart data={allocation.byExchange} title="By Exchange / Venue" />
        </div>
      )}

      {/* Rankings */}
      {rankings && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RankingTable title="Top Winners (by return %)" holdings={rankings.topWinners} currency={currency} positive />
          <RankingTable title="Top Losers (by return %)" holdings={rankings.topLosers} currency={currency} positive={false} />
          <RankingTable title="Biggest Gains ($)" holdings={rankings.biggestGains} currency={currency} positive />
          <RankingTable title="Biggest Losses ($)" holdings={rankings.biggestLosses} currency={currency} positive={false} />
        </div>
      )}

      {/* Realized vs Unrealized */}
      {allocation && (
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Realized vs Unrealized P&L</h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-slate-400 mb-1">Realized P&L</p>
              <p className={clsx('text-2xl font-bold font-mono', pnlColor(allocation.realizedPnl))}>
                {allocation.realizedPnl >= 0 ? '+' : ''}{formatCurrency(allocation.realizedPnl, currency)}
              </p>
              <p className="text-xs text-slate-500 mt-1">From completed positions</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Unrealized P&L</p>
              <p className={clsx('text-2xl font-bold font-mono', pnlColor(allocation.unrealizedPnl))}>
                {allocation.unrealizedPnl >= 0 ? '+' : ''}{formatCurrency(allocation.unrealizedPnl, currency)}
              </p>
              <p className="text-xs text-slate-500 mt-1">From open positions</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RankingTable({ title, holdings, currency, positive }: {
  title: string;
  holdings: HoldingWithPnl[];
  currency: string;
  positive: boolean;
}) {
  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">{title}</h3>
      <div className="space-y-2">
        {holdings.length === 0 && <p className="text-slate-500 text-sm">No data</p>}
        {holdings.map((h, i) => (
          <div key={h.holdingId} className="flex items-center gap-3">
            <span className="text-xs text-slate-500 w-4 text-right">{i + 1}</span>
            <div className="flex-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-surface-border flex items-center justify-center text-[10px] font-bold text-slate-300">
                  {h.symbol[0]}
                </div>
                <span className="text-sm font-medium text-white">{h.symbol}</span>
              </div>
              <div className="text-right">
                <p className={clsx('text-sm font-mono font-semibold', positive ? 'text-emerald-400' : 'text-red-400')}>
                  {h.totalReturn != null ? (h.totalReturn >= 0 ? '+' : '') + formatPercent(h.totalReturn) : '—'}
                </p>
                <p className="text-xs text-slate-400 font-mono">
                  {h.totalPnl != null ? (h.totalPnl >= 0 ? '+' : '') + formatCurrency(h.totalPnl, currency) : '—'}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
