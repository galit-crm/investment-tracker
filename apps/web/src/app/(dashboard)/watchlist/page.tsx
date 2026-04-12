'use client';

import { useState } from 'react';
import { Star, X, TrendingUp, TrendingDown, Plus, Search } from 'lucide-react';
import { clsx } from 'clsx';
import { useWatchlist, useAddToWatchlist, useRemoveFromWatchlist, useAssetSearch } from '@/hooks/useApi';
import { formatCurrency, formatPercent, pnlColor } from '@/lib/format';
import Link from 'next/link';

const ASSET_CLASS_AVATAR: Record<string, string> = {
  STOCK:  'bg-blue-900 text-blue-300',
  CRYPTO: 'bg-amber-900 text-amber-300',
  ETF:    'bg-purple-900 text-purple-300',
  OTHER:  'bg-slate-700 text-slate-300',
};

const ASSET_CLASS_BADGE: Record<string, string> = {
  STOCK:     'bg-blue-950 text-blue-400',
  CRYPTO:    'bg-amber-950 text-amber-400',
  ETF:       'bg-purple-950 text-purple-400',
  COMMODITY: 'bg-yellow-950 text-yellow-400',
  BOND:      'bg-green-950 text-green-400',
  OTHER:     'bg-slate-800 text-slate-400',
};

export default function WatchlistPage() {
  const { data: watchlist, isLoading } = useWatchlist();
  const addMutation = useAddToWatchlist();
  const removeMutation = useRemoveFromWatchlist();

  const [searchQ, setSearchQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const { data: searchResults = [] } = useAssetSearch(debouncedQ);

  const items: any[] = watchlist?.items ?? [];
  const watchedAssetIds = new Set(items.map((i: any) => i.assetId));

  const handleSearch = (val: string) => {
    setSearchQ(val);
    clearTimeout((handleSearch as any)._t);
    (handleSearch as any)._t = setTimeout(() => setDebouncedQ(val), 300);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Star className="w-6 h-6 text-amber-400 fill-amber-400" />
            Watchlist
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {items.length} asset{items.length !== 1 ? 's' : ''} watched
          </p>
        </div>
        <button
          onClick={() => setShowSearch((v) => !v)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Asset
        </button>
      </div>

      {/* Search panel */}
      {showSearch && (
        <div className="card space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={searchQ}
              onChange={(e) => handleSearch(e.target.value)}
              className="input pl-9"
              placeholder="Search symbol or name…"
              autoFocus
            />
          </div>
          {searchResults.length > 0 && debouncedQ.length >= 2 && (
            <div className="space-y-1">
              {(searchResults as any[]).map((a) => {
                const alreadyAdded = watchedAssetIds.has(a.id);
                return (
                  <div key={a.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface transition-colors">
                    <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0', ASSET_CLASS_AVATAR[a.assetClass] ?? ASSET_CLASS_AVATAR.OTHER)}>
                      {a.symbol[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-sm">{a.symbol}</span>
                        <span className={clsx('badge text-[10px]', ASSET_CLASS_BADGE[a.assetClass] ?? ASSET_CLASS_BADGE.OTHER)}>{a.assetClass}</span>
                      </div>
                      <p className="text-xs text-slate-400 truncate">{a.name}</p>
                    </div>
                    <button
                      disabled={alreadyAdded || addMutation.isPending}
                      onClick={() => addMutation.mutate(a.id)}
                      className={clsx(
                        'text-xs px-3 py-1.5 rounded-md font-medium transition-colors flex-shrink-0',
                        alreadyAdded
                          ? 'text-slate-500 bg-surface-border cursor-default'
                          : 'bg-brand-600 text-white hover:bg-brand-500',
                      )}
                    >
                      {alreadyAdded ? 'Watching' : 'Add'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Watchlist table */}
      {isLoading ? (
        <div className="card text-center py-12 text-slate-400">Loading…</div>
      ) : items.length === 0 ? (
        <div className="card text-center py-16">
          <Star className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">No assets on your watchlist yet</p>
          <p className="text-slate-500 text-sm mt-1">Click "Add Asset" to start watching prices</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="border-b border-surface-border bg-surface">
                <tr>
                  <th className="table-header">Asset</th>
                  <th className="table-header text-right">Price</th>
                  <th className="table-header text-right">24h Change</th>
                  <th className="table-header text-right">Market Cap</th>
                  <th className="table-header text-right">Volume 24h</th>
                  <th className="table-header"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any) => {
                  const asset = item.asset;
                  const quote = asset.quotes?.[0];
                  const changePercent = quote?.changePercent ? Number(quote.changePercent) : null;
                  const isUp = changePercent != null && changePercent > 0;
                  const isDown = changePercent != null && changePercent < 0;

                  return (
                    <tr key={item.id} className="table-row">
                      <td className="table-cell">
                        <Link href={`/assets/${asset.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                          <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0', ASSET_CLASS_AVATAR[asset.assetClass] ?? ASSET_CLASS_AVATAR.OTHER)}>
                            {asset.symbol[0]}
                          </div>
                          <div>
                            <p className="font-semibold text-white">{asset.symbol}</p>
                            <p className="text-xs text-slate-400 truncate max-w-[160px]">{asset.name}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="table-cell text-right font-mono font-semibold text-white">
                        {quote ? formatCurrency(Number(quote.price), 'USD') : '—'}
                      </td>
                      <td className="table-cell text-right">
                        {changePercent != null ? (
                          <div className={clsx('flex items-center justify-end gap-1 font-mono font-medium', pnlColor(changePercent))}>
                            {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : isDown ? <TrendingDown className="w-3.5 h-3.5" /> : null}
                            {formatPercent(changePercent)}
                          </div>
                        ) : <span className="text-slate-500">—</span>}
                      </td>
                      <td className="table-cell text-right font-mono text-slate-300">
                        {quote?.marketCap ? formatCurrency(Number(quote.marketCap), 'USD', true) : '—'}
                      </td>
                      <td className="table-cell text-right font-mono text-slate-300">
                        {quote?.volume24h ? formatCurrency(Number(quote.volume24h), 'USD', true) : '—'}
                      </td>
                      <td className="table-cell text-right">
                        <button
                          onClick={() => removeMutation.mutate(asset.id)}
                          className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/30 rounded-md transition-colors"
                          title="Remove from watchlist"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
