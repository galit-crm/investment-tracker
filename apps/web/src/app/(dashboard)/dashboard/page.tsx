'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { usePortfolios, usePortfolioSummary, useHoldings, useAnalyticsSummary, useRefreshAllQuotes, useNewsDashboard, useReconciliation, type NewsArticle, type ReconciliationStatus } from '@/hooks/useApi';
import { StatCard } from '@/components/dashboard/stat-card';
import { AllocationChart } from '@/components/charts/allocation-chart';
import { HoldingsTable } from '@/components/holdings/holdings-table';
import { formatCurrency, formatPercent, pnlColor } from '@/lib/format';
import { clsx } from 'clsx';
import { RefreshCw, ExternalLink, AlertTriangle, Info, TrendingUp as TrendUp, ShieldCheck, ShieldAlert, Clock } from 'lucide-react';
import Link from 'next/link';
import type { HoldingWithPnl } from '@/types';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const refreshMutation = useRefreshAllQuotes();
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const { data: portfolios } = usePortfolios();
  const defaultPortfolio = portfolios?.find((p) => p.isDefault) ?? portfolios?.[0];

  const { data: summary, isLoading: summaryLoading } = usePortfolioSummary(defaultPortfolio?.id);
  const { data: holdings = [], isLoading: holdingsLoading } = useHoldings(defaultPortfolio?.id);
  const { data: analytics } = useAnalyticsSummary();
  const { data: newsData } = useNewsDashboard();
  const { data: reconciliation } = useReconciliation();
  const highImpactNews = newsData?.highImpact ?? [];
  const recentNews = newsData?.recent ?? [];

  const currency = user?.settings?.baseCurrency ?? 'USD';

  const topWinners = [...holdings]
    .filter((h: HoldingWithPnl) => h.totalReturn != null)
    .sort((a: HoldingWithPnl, b: HoldingWithPnl) => (b.totalReturn ?? 0) - (a.totalReturn ?? 0))
    .slice(0, 3);

  const topLosers = [...holdings]
    .filter((h: HoldingWithPnl) => h.totalReturn != null)
    .sort((a: HoldingWithPnl, b: HoldingWithPnl) => (a.totalReturn ?? 0) - (b.totalReturn ?? 0))
    .slice(0, 3);

  const totalDayChange = holdings.reduce((s: number, h: HoldingWithPnl) => s + (h.dayChange ?? 0), 0);
  const totalDayChangePercent = analytics?.totalValue && analytics.totalValue > 0
    ? (totalDayChange / (analytics.totalValue - totalDayChange)) * 100
    : null;

  const handleRefresh = async () => {
    const result = await refreshMutation.mutateAsync();
    setLastRefreshed(result?.refreshedAt ? new Date(result.refreshedAt) : new Date());
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Good {getGreeting()}, {user?.displayName?.split(' ')[0] ?? 'Investor'}
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">Here's your portfolio overview</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={handleRefresh}
            disabled={refreshMutation.isPending}
            className="btn-ghost flex items-center gap-2"
          >
            <RefreshCw className={clsx('w-4 h-4', refreshMutation.isPending && 'animate-spin')} />
            {refreshMutation.isPending ? 'Refreshing…' : 'Refresh'}
          </button>
          {lastRefreshed && (
            <p className="text-[11px] text-slate-500">
              Updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Value"
          value={analytics?.totalValue ?? null}
          currency={currency}
          loading={!analytics}
        />
        <StatCard
          label="Total Invested"
          value={analytics?.totalCost ?? null}
          currency={currency}
          loading={!analytics}
        />
        <StatCard
          label="Unrealized P&L"
          value={analytics?.totalUnrealizedPnl ?? null}
          changePercent={analytics?.totalUnrealizedPnlPercent ?? null}
          currency={currency}
          loading={!analytics}
        />
        <StatCard
          label="Day Change"
          value={totalDayChange || null}
          changePercent={totalDayChangePercent}
          currency={currency}
          loading={holdingsLoading}
        />
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Allocation chart */}
        {summary?.allocation && summary.allocation.length > 0 && (
          <AllocationChart data={summary.allocation} title="Allocation by Asset Class" />
        )}

        {/* Top winners */}
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Top Winners</h3>
          <div className="space-y-3">
            {topWinners.length === 0 && <p className="text-slate-500 text-sm">No data</p>}
            {topWinners.map((h) => (
              <MiniHoldingRow key={h.holdingId} holding={h} currency={currency} />
            ))}
          </div>
        </div>

        {/* Top losers */}
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Top Losers</h3>
          <div className="space-y-3">
            {topLosers.length === 0 && <p className="text-slate-500 text-sm">No data</p>}
            {topLosers.map((h) => (
              <MiniHoldingRow key={h.holdingId} holding={h} currency={currency} />
            ))}
          </div>
        </div>
      </div>

      {/* Holdings table */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">
          All Holdings
          {holdings.length > 0 && (
            <span className="ml-2 text-sm font-normal text-slate-500">({holdings.length} positions)</span>
          )}
        </h2>
        {holdingsLoading ? (
          <div className="card text-center py-12 text-slate-400">Loading holdings…</div>
        ) : (
          <HoldingsTable holdings={holdings} currency={currency} />
        )}
      </div>

      {/* Data Health */}
      {reconciliation && (
        <DataHealthWidget reconciliation={reconciliation} />
      )}

      {/* Market Intelligence */}
      {(highImpactNews.length > 0 || recentNews.length > 0) && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Market Intelligence</h2>
              {newsData?.lastFetchedAt && (
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Updated {timeAgo(newsData.lastFetchedAt)}
                </p>
              )}
            </div>
            <Link href="/news" className="text-sm text-brand-400 hover:text-brand-300 transition-colors">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* High impact */}
            <div className="lg:col-span-2 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">High Impact Events</p>
              {highImpactNews.map((article) => (
                <DashboardNewsCard key={article.id} article={article} />
              ))}
            </div>
            {/* Recent */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Latest Headlines</p>
              <div className="card divide-y divide-surface-border p-0 overflow-hidden">
                {recentNews.map((article) => (
                  <a
                    key={article.id}
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 p-3 hover:bg-surface transition-colors"
                  >
                    <span className={clsx(
                      'mt-0.5 flex-shrink-0 w-1.5 h-1.5 rounded-full',
                      article.impactLevel === 'HIGH' ? 'bg-red-400' :
                      article.impactLevel === 'MEDIUM' ? 'bg-amber-400' : 'bg-slate-500',
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white leading-snug line-clamp-2">{article.title}</p>
                      <p className="text-[10px] text-slate-500 mt-1">{article.source} · {timeAgo(article.publishedAt)}</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DataHealthWidget({ reconciliation }: { reconciliation: ReconciliationStatus }) {
  const issues = reconciliation.assetsWithoutQuotes.length + reconciliation.staleQuotes.length;
  const healthy = issues === 0;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {healthy
            ? <ShieldCheck className="w-4 h-4 text-emerald-400" />
            : <ShieldAlert className="w-4 h-4 text-amber-400" />}
          <span className="text-sm font-semibold text-slate-300">Data Health</span>
        </div>
        <span className="text-[10px] text-slate-500 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Checked {timeAgo(reconciliation.checkedAt)}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <div className="bg-surface rounded-lg px-3 py-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Holdings</p>
          <p className="text-lg font-bold text-white font-mono">{reconciliation.holdingsCount}</p>
        </div>
        <div className="bg-surface rounded-lg px-3 py-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Transactions</p>
          <p className="text-lg font-bold text-white font-mono">{reconciliation.transactionsCount}</p>
        </div>
        <div className="bg-surface rounded-lg px-3 py-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">No Quote</p>
          <p className={clsx('text-lg font-bold font-mono', reconciliation.assetsWithoutQuotes.length > 0 ? 'text-amber-400' : 'text-emerald-400')}>
            {reconciliation.assetsWithoutQuotes.length}
          </p>
        </div>
        <div className="bg-surface rounded-lg px-3 py-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Stale (&gt;2h)</p>
          <p className={clsx('text-lg font-bold font-mono', reconciliation.staleQuotes.length > 0 ? 'text-amber-400' : 'text-emerald-400')}>
            {reconciliation.staleQuotes.length}
          </p>
        </div>
      </div>

      {!healthy && (
        <div className="space-y-1.5">
          {reconciliation.assetsWithoutQuotes.map((a) => (
            <div key={a.id} className="flex items-center gap-2 text-xs text-amber-400 bg-amber-950/30 px-3 py-1.5 rounded-lg">
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              <span className="font-mono font-semibold">{a.symbol}</span>
              <span className="text-amber-600">{a.name}</span>
              <span className="ml-auto text-amber-700">no price data</span>
            </div>
          ))}
          {reconciliation.staleQuotes.map((a) => (
            <div key={a.id} className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800/40 px-3 py-1.5 rounded-lg">
              <Clock className="w-3 h-3 flex-shrink-0" />
              <span className="font-mono font-semibold">{a.symbol}</span>
              <span className="text-slate-500">{a.name}</span>
              <span className="ml-auto text-slate-600">{a.lastQuoteAt ? `last: ${timeAgo(a.lastQuoteAt)}` : 'unknown'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniHoldingRow({ holding, currency }: { holding: HoldingWithPnl; currency: string }) {
  const AVATAR: Record<string, string> = {
    STOCK: 'bg-blue-900 text-blue-300', CRYPTO: 'bg-amber-900 text-amber-300',
    ETF: 'bg-purple-900 text-purple-300', COMMODITY: 'bg-yellow-900 text-yellow-300',
    OTHER: 'bg-slate-700 text-slate-300',
  };
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className={clsx('w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold', AVATAR[holding.assetClass] ?? AVATAR.OTHER)}>
          {holding.symbol[0]}
        </div>
        <div>
          <p className="text-sm font-medium text-white">{holding.symbol}</p>
          <p className="text-xs text-slate-400">{formatCurrency(holding.currentValue, currency)}</p>
        </div>
      </div>
      <div className="text-right">
        <p className={clsx('text-sm font-mono font-semibold', pnlColor(holding.totalReturn))}>
          {holding.totalReturn != null ? (holding.totalReturn >= 0 ? '+' : '') + formatPercent(holding.totalReturn) : '—'}
        </p>
        {holding.dayChangePercent != null && (
          <p className={clsx('text-xs font-mono', pnlColor(holding.dayChangePercent))}>
            {formatPercent(holding.dayChangePercent)} today
          </p>
        )}
      </div>
    </div>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const CATEGORY_LABELS: Record<string, string> = {
  FED_CENTRAL_BANKS: 'Central Banks',
  INFLATION_MACRO: 'Macro',
  EARNINGS: 'Earnings',
  GEOPOLITICS: 'Geopolitics',
  CRYPTO: 'Crypto',
  MARKET_NEWS: 'Markets',
  REGULATORY: 'Regulatory',
};

function DashboardNewsCard({ article }: { article: NewsArticle }) {
  const ImpactIcon = article.impactLevel === 'HIGH' ? AlertTriangle :
                     article.impactLevel === 'MEDIUM' ? TrendUp : Info;
  const impactStyle = article.impactLevel === 'HIGH'
    ? 'text-red-400 bg-red-950/40 border-red-900/60'
    : article.impactLevel === 'MEDIUM'
    ? 'text-amber-400 bg-amber-950/40 border-amber-900/60'
    : 'text-slate-400 bg-slate-800/40 border-slate-700/60';

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="card p-4 flex gap-3 hover:border-slate-600 transition-colors group"
    >
      <div className={clsx('flex-shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center', impactStyle)}>
        <ImpactIcon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            {CATEGORY_LABELS[article.category] ?? article.category}
          </span>
          <span className={clsx('text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded', impactStyle)}>
            {article.impactLevel}
          </span>
        </div>
        <p className="text-sm font-semibold text-white leading-snug group-hover:text-brand-300 transition-colors line-clamp-2">
          {article.title}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[11px] text-slate-500">{article.source}</span>
          <span className="text-slate-700">·</span>
          <span className="text-[11px] text-slate-500">{timeAgo(article.publishedAt)}</span>
          <ExternalLink className="w-3 h-3 text-slate-600 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    </a>
  );
}
