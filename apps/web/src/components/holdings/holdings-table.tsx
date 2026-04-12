'use client';

import { clsx } from 'clsx';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatCurrency, formatNumber, formatPercent, pnlColor } from '@/lib/format';
import type { HoldingWithPnl } from '@/types';

interface Props {
  holdings: HoldingWithPnl[];
  currency?: string;
}

const ASSET_CLASS_BADGE: Record<string, string> = {
  STOCK:     'bg-blue-950 text-blue-400',
  CRYPTO:    'bg-amber-950 text-amber-400',
  ETF:       'bg-purple-950 text-purple-400',
  COMMODITY: 'bg-yellow-950 text-yellow-400',
  BOND:      'bg-green-950 text-green-400',
  INDEX:     'bg-cyan-950 text-cyan-400',
  FOREX:     'bg-pink-950 text-pink-400',
  OTHER:     'bg-slate-800 text-slate-400',
};

// Avatar background uses a single accent color per asset class
const ASSET_CLASS_AVATAR: Record<string, string> = {
  STOCK:     'bg-blue-900 text-blue-300',
  CRYPTO:    'bg-amber-900 text-amber-300',
  ETF:       'bg-purple-900 text-purple-300',
  COMMODITY: 'bg-yellow-900 text-yellow-300',
  BOND:      'bg-green-900 text-green-300',
  INDEX:     'bg-cyan-900 text-cyan-300',
  FOREX:     'bg-pink-900 text-pink-300',
  OTHER:     'bg-slate-700 text-slate-300',
};

function priceAge(isoStr: string): string {
  const mins = Math.floor((Date.now() - new Date(isoStr).getTime()) / 60_000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function DayChangeCell({ percent, absolute, currency }: { percent: number | null | undefined; absolute: number | null | undefined; currency: string }) {
  if (percent == null) return <span className="text-slate-500">—</span>;

  const isUp = percent > 0;
  const isDown = percent < 0;
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;

  return (
    <div className={clsx('flex flex-col items-end gap-0.5', pnlColor(percent))}>
      <div className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        <span className="text-sm font-mono font-medium">{formatPercent(percent)}</span>
      </div>
      {absolute != null && (
        <span className="text-xs font-mono opacity-70">
          {absolute >= 0 ? '+' : ''}{formatCurrency(absolute, currency)}
        </span>
      )}
    </div>
  );
}

export function HoldingsTable({ holdings, currency = 'USD' }: Props) {
  if (holdings.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-slate-400">No holdings yet. Add a transaction to get started.</p>
      </div>
    );
  }

  const sorted = [...holdings].sort((a, b) => (b.currentValue ?? 0) - (a.currentValue ?? 0));

  return (
    <div className="card p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px]">
          <thead className="border-b border-surface-border bg-surface">
            <tr>
              <th className="table-header">Asset</th>
              <th className="table-header text-right">Qty</th>
              <th className="table-header text-right">Avg Cost</th>
              <th className="table-header text-right">Price</th>
              <th className="table-header text-right">Value</th>
              <th className="table-header text-right">Unrealized P&L</th>
              <th className="table-header text-right">Return</th>
              <th className="table-header text-right">Day Change</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((h) => (
              <tr key={h.holdingId} className="table-row">
                {/* Asset */}
                <td className="table-cell">
                  <div className="flex items-center gap-3">
                    <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0', ASSET_CLASS_AVATAR[h.assetClass] ?? ASSET_CLASS_AVATAR.OTHER)}>
                      {h.symbol[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{h.symbol}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-400 truncate max-w-[110px]">{h.name}</span>
                        <span className={clsx('badge text-[10px]', ASSET_CLASS_BADGE[h.assetClass] ?? ASSET_CLASS_BADGE.OTHER)}>
                          {h.assetClass}
                        </span>
                      </div>
                    </div>
                  </div>
                </td>

                {/* Quantity */}
                <td className="table-cell text-right font-mono text-slate-300">
                  {formatNumber(h.quantity)}
                </td>

                {/* Avg Cost */}
                <td className="table-cell text-right font-mono text-slate-400">
                  {formatCurrency(h.averageBuyPrice, currency)}
                </td>

                {/* Current Price */}
                <td className="table-cell text-right font-mono">
                  {h.currentPrice != null ? (
                    <div>
                      <span className="text-white">{formatCurrency(h.currentPrice, currency)}</span>
                      {h.lastUpdatedAt && (
                        <p className="text-[10px] text-slate-600 mt-0.5">{priceAge(h.lastUpdatedAt)}</p>
                      )}
                    </div>
                  ) : (
                    <span className="text-amber-500 text-xs">No quote</span>
                  )}
                </td>

                {/* Current Value */}
                <td className="table-cell text-right font-mono font-semibold text-white">
                  {formatCurrency(h.currentValue ?? h.totalCost, currency)}
                </td>

                {/* Unrealized P&L */}
                <td className="table-cell text-right">
                  <div className={clsx('font-mono font-medium', pnlColor(h.unrealizedPnl))}>
                    {h.unrealizedPnl != null
                      ? (h.unrealizedPnl >= 0 ? '+' : '') + formatCurrency(h.unrealizedPnl, currency)
                      : <span className="text-slate-500">—</span>}
                  </div>
                </td>

                {/* Return % */}
                <td className="table-cell text-right">
                  {h.totalReturn != null ? (
                    <span className={clsx('badge font-mono', h.totalReturn >= 0 ? 'bg-emerald-950 text-emerald-400' : 'bg-red-950 text-red-400')}>
                      {formatPercent(h.totalReturn)}
                    </span>
                  ) : <span className="text-slate-500">—</span>}
                </td>

                {/* Day Change */}
                <td className="table-cell text-right">
                  <DayChangeCell percent={h.dayChangePercent} absolute={h.dayChange} currency={currency} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
