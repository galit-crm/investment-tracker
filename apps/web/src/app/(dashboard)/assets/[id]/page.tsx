'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { clsx } from 'clsx';
import { ArrowLeft, Star, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  useAssetDetail,
  useAssetHistory,
  useHoldings,
  useTransactions,
  usePortfolios,
  useAddToWatchlist,
  useRemoveFromWatchlist,
  useWatchlist,
  useAssetNews,
  type NewsArticle,
} from '@/hooks/useApi';
import { formatCurrency, formatPercent, formatDate, formatNumber, pnlColor } from '@/lib/format';
import { ExternalLink, AlertTriangle, TrendingUp as TrendUp, Info } from 'lucide-react';

const RANGES = [
  { label: '5D',  value: '5d'  },
  { label: '1M',  value: '1mo' },
  { label: '3M',  value: '3mo' },
  { label: '1Y',  value: '1y'  },
] as const;

const ASSET_CLASS_BADGE: Record<string, string> = {
  STOCK:     'bg-blue-950 text-blue-400',
  CRYPTO:    'bg-amber-950 text-amber-400',
  ETF:       'bg-purple-950 text-purple-400',
  COMMODITY: 'bg-yellow-950 text-yellow-400',
  BOND:      'bg-green-950 text-green-400',
  OTHER:     'bg-slate-800 text-slate-400',
};

const ASSET_CLASS_AVATAR: Record<string, string> = {
  STOCK:  'bg-blue-900 text-blue-300',
  CRYPTO: 'bg-amber-900 text-amber-300',
  ETF:    'bg-purple-900 text-purple-300',
  OTHER:  'bg-slate-700 text-slate-300',
};

type Range = '5d' | '1mo' | '3mo' | '1y';

export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [range, setRange] = useState<Range>('1mo');

  const { data: asset, isLoading: assetLoading } = useAssetDetail(id);
  const { data: assetNews = [] } = useAssetNews(asset?.symbol);
  const { data: history = [], isLoading: historyLoading } = useAssetHistory(id, range);
  const { data: portfolios } = usePortfolios();
  const defaultPortfolio = portfolios?.find((p: any) => p.isDefault) ?? portfolios?.[0];
  const { data: holdings = [] } = useHoldings(defaultPortfolio?.id);
  const { data: transactionsData } = useTransactions(defaultPortfolio?.id);
  const { data: watchlist } = useWatchlist();
  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();

  if (assetLoading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card animate-pulse h-24" />
        ))}
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="card text-center py-16">
        <p className="text-slate-400">Asset not found</p>
        <Link href="/holdings" className="btn-secondary mt-4 inline-block">Back to Holdings</Link>
      </div>
    );
  }

  const quote = asset.quotes?.[0];
  const price = quote ? Number(quote.price) : null;
  const changePercent = quote?.changePercent ? Number(quote.changePercent) : null;
  const priceChange = quote?.priceChange ? Number(quote.priceChange) : null;

  // Holdings for this asset
  const assetHoldings = (holdings as any[]).filter((h: any) => h.assetId === id || h.symbol === asset.symbol);
  const holding = assetHoldings[0];

  // Transactions for this asset
  const allTx: any[] = transactionsData?.data ?? [];
  const assetTx = allTx.filter((t: any) => t.assetId === id).slice(0, 20);

  // Watchlist state
  const isWatched = watchlist?.items?.some((i: any) => i.assetId === id) ?? false;

  // Chart min/max for Y axis domain
  const prices = history.map((h) => h.price).filter(Boolean);
  const minPrice = prices.length ? Math.min(...prices) * 0.995 : 0;
  const maxPrice = prices.length ? Math.max(...prices) * 1.005 : 0;

  // Chart color based on first vs last price
  const chartColor = history.length >= 2
    ? (history[history.length - 1].price >= history[0].price ? '#34d399' : '#f87171')
    : '#6366f1';

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link href="/holdings" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back
      </Link>

      {/* Asset header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0', ASSET_CLASS_AVATAR[asset.assetClass] ?? ASSET_CLASS_AVATAR.OTHER)}>
            {asset.symbol[0]}
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-white">{asset.symbol}</h1>
              <span className={clsx('badge', ASSET_CLASS_BADGE[asset.assetClass] ?? ASSET_CLASS_BADGE.OTHER)}>
                {asset.assetClass}
              </span>
              {asset.exchange && <span className="text-sm text-slate-500">{asset.exchange}</span>}
            </div>
            <p className="text-slate-400 mt-0.5">{asset.name}</p>
          </div>
        </div>
        <button
          onClick={() => isWatched ? removeFromWatchlist.mutate(id) : addToWatchlist.mutate(id)}
          className={clsx(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border flex-shrink-0',
            isWatched
              ? 'bg-amber-950/40 border-amber-800 text-amber-400 hover:bg-red-950/30 hover:text-red-400 hover:border-red-800'
              : 'bg-surface border-surface-border text-slate-400 hover:border-amber-700 hover:text-amber-400',
          )}
        >
          <Star className={clsx('w-4 h-4', isWatched && 'fill-amber-400')} />
          {isWatched ? 'Watching' : 'Watch'}
        </button>
      </div>

      {/* Price + Change */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card-sm col-span-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Current Price</p>
          <p className="text-3xl font-bold text-white font-mono">
            {price != null ? formatCurrency(price, 'USD') : '—'}
          </p>
          {changePercent != null && (
            <div className={clsx('flex items-center gap-2 mt-1.5 text-sm font-medium', pnlColor(changePercent))}>
              {changePercent > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span>{formatPercent(changePercent)} today</span>
              {priceChange != null && <span>({priceChange >= 0 ? '+' : ''}{formatCurrency(priceChange, 'USD')})</span>}
            </div>
          )}
          {quote?.fetchedAt && (
            <p className="text-[11px] text-slate-500 mt-2">
              Updated {new Date(quote.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>

        {quote?.high24h && (
          <div className="card-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">24h High</p>
            <p className="text-xl font-bold text-emerald-400 font-mono">{formatCurrency(Number(quote.high24h), 'USD')}</p>
          </div>
        )}
        {quote?.low24h && (
          <div className="card-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">24h Low</p>
            <p className="text-xl font-bold text-red-400 font-mono">{formatCurrency(Number(quote.low24h), 'USD')}</p>
          </div>
        )}
        {quote?.marketCap && (
          <div className="card-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Market Cap</p>
            <p className="text-xl font-bold text-white font-mono">{formatCurrency(Number(quote.marketCap), 'USD', true)}</p>
          </div>
        )}
        {quote?.volume24h && (
          <div className="card-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Volume 24h</p>
            <p className="text-xl font-bold text-white font-mono">{formatCurrency(Number(quote.volume24h), 'USD', true)}</p>
          </div>
        )}
      </div>

      {/* Price chart */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-300">Price History</h2>
          <div className="flex gap-1">
            {RANGES.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setRange(value)}
                className={clsx(
                  'px-2.5 py-1 rounded-md text-xs font-semibold transition-all',
                  range === value
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-surface',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {historyLoading ? (
          <div className="h-52 flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-slate-500 animate-spin" />
          </div>
        ) : history.length < 2 ? (
          <div className="h-52 flex items-center justify-center text-slate-500 text-sm">
            No historical data available
          </div>
        ) : (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(d) => {
                    const date = new Date(d);
                    return range === '5d'
                      ? date.toLocaleDateString(undefined, { weekday: 'short' })
                      : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                  }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[minPrice, maxPrice]}
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatCurrency(v, 'USD', true)}
                  width={72}
                />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#94a3b8' }}
                  formatter={(v: number) => [formatCurrency(v, 'USD'), 'Price']}
                  labelFormatter={(l) => formatDate(l)}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke={chartColor}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: chartColor }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Holdings summary */}
      {holding && (
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Your Position</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-slate-500 mb-1">Quantity</p>
              <p className="text-lg font-bold text-white font-mono">{formatNumber(holding.quantity)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Avg Cost</p>
              <p className="text-lg font-bold text-white font-mono">{formatCurrency(holding.averageBuyPrice, 'USD')}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Current Value</p>
              <p className="text-lg font-bold text-white font-mono">{formatCurrency(holding.currentValue ?? holding.totalCost, 'USD')}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Unrealized P&L</p>
              <p className={clsx('text-lg font-bold font-mono', pnlColor(holding.unrealizedPnl))}>
                {holding.unrealizedPnl != null
                  ? (holding.unrealizedPnl >= 0 ? '+' : '') + formatCurrency(holding.unrealizedPnl, 'USD')
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Total Cost</p>
              <p className="text-lg font-bold text-slate-300 font-mono">{formatCurrency(holding.totalCost, 'USD')}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Return</p>
              <p className={clsx('text-lg font-bold font-mono', pnlColor(holding.totalReturn))}>
                {holding.totalReturn != null ? formatPercent(holding.totalReturn) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Realized P&L</p>
              <p className={clsx('text-lg font-bold font-mono', pnlColor(holding.realizedPnl))}>
                {holding.realizedPnl != null
                  ? (holding.realizedPnl >= 0 ? '+' : '') + formatCurrency(holding.realizedPnl, 'USD')
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Day Change</p>
              <p className={clsx('text-lg font-bold font-mono', pnlColor(holding.dayChangePercent))}>
                {holding.dayChangePercent != null ? formatPercent(holding.dayChangePercent) : '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Transactions */}
      {assetTx.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Transaction History</h2>
          <div className="space-y-2">
            {assetTx.map((tx: any) => (
              <div key={tx.id} className="flex items-center gap-3 py-2.5 border-b border-surface-border last:border-0">
                <span className={clsx(
                  'text-xs font-semibold px-2 py-0.5 rounded-md flex-shrink-0',
                  tx.type === 'BUY' ? 'bg-emerald-950 text-emerald-400' :
                  tx.type === 'SELL' ? 'bg-red-950 text-red-400' :
                  'bg-slate-800 text-slate-400',
                )}>
                  {tx.type}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">
                    {tx.quantity ? formatNumber(Number(tx.quantity)) : ''} @ {tx.pricePerUnit ? formatCurrency(Number(tx.pricePerUnit), tx.currency ?? 'USD') : '—'}
                  </p>
                  <p className="text-xs text-slate-500">{formatDate(tx.executedAt)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-mono font-semibold text-white">{formatCurrency(Number(tx.totalAmount), tx.currency ?? 'USD')}</p>
                  {Number(tx.fee) > 0 && (
                    <p className="text-xs text-slate-500 font-mono">+{formatCurrency(Number(tx.fee), tx.currency ?? 'USD')} fee</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!holding && assetTx.length === 0 && (
        <div className="card text-center py-8 text-slate-400 text-sm">
          No position or transactions for this asset in your portfolio.
        </div>
      )}

      {/* Related News */}
      {assetNews.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Related News</h2>
          <div className="space-y-3">
            {assetNews.map((article) => (
              <AssetNewsRow key={article.id} article={article} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
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

function AssetNewsRow({ article }: { article: NewsArticle }) {
  const ImpactIcon = article.impactLevel === 'HIGH' ? AlertTriangle :
                     article.impactLevel === 'MEDIUM' ? TrendUp : Info;
  const impactStyle = article.impactLevel === 'HIGH'
    ? 'text-red-400 bg-red-950/40 border-red-900/50'
    : article.impactLevel === 'MEDIUM'
    ? 'text-amber-400 bg-amber-950/40 border-amber-900/50'
    : 'text-slate-400 bg-slate-800/40 border-slate-700/50';

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-3 py-2.5 border-b border-surface-border last:border-0 group"
    >
      <div className={clsx('flex-shrink-0 w-7 h-7 rounded-md border flex items-center justify-center mt-0.5', impactStyle)}>
        <ImpactIcon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            {CATEGORY_LABELS[article.category] ?? article.category}
          </span>
          <span className={clsx('text-[10px] font-bold uppercase px-1.5 py-px rounded border', impactStyle)}>
            {article.impactLevel}
          </span>
        </div>
        <p className="text-sm text-white group-hover:text-brand-300 transition-colors leading-snug line-clamp-2">
          {article.title}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[11px] text-slate-500">{article.source}</span>
          <span className="text-slate-700">·</span>
          <span className="text-[11px] text-slate-500">{timeAgo(article.publishedAt)}</span>
        </div>
      </div>
      <ExternalLink className="w-3.5 h-3.5 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
    </a>
  );
}
