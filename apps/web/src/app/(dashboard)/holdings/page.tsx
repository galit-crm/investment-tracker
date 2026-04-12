'use client';

import { usePortfolios, useHoldings } from '@/hooks/useApi';
import { useAuthStore } from '@/stores/auth.store';
import { HoldingsTable } from '@/components/holdings/holdings-table';
import { formatCurrency, formatPercent, pnlColor } from '@/lib/format';
import { clsx } from 'clsx';

export default function HoldingsPage() {
  const { user } = useAuthStore();
  const { data: portfolios } = usePortfolios();
  const defaultPortfolio = portfolios?.find((p) => p.isDefault) ?? portfolios?.[0];
  const { data: holdings = [], isLoading } = useHoldings(defaultPortfolio?.id);

  const currency = user?.settings?.baseCurrency ?? 'USD';

  const totalValue = holdings.reduce((s, h) => s + (h.currentValue ?? h.totalCost), 0);
  const totalCost = holdings.reduce((s, h) => s + h.totalCost, 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Holdings</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {holdings.length} positions · Total value {formatCurrency(totalValue, currency)}
          </p>
        </div>
        <div className={clsx('text-right', pnlColor(totalPnl))}>
          <p className="text-lg font-bold font-mono">
            {totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl, currency)}
          </p>
          <p className="text-sm font-mono">{formatPercent(totalPnlPercent)}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="card text-center py-12 text-slate-400">Loading...</div>
      ) : (
        <HoldingsTable holdings={holdings} currency={currency} />
      )}
    </div>
  );
}
