import { clsx } from 'clsx';
import { formatCurrency, formatPercent, pnlColor } from '@/lib/format';

interface StatCardProps {
  label: string;
  value: number | null;
  change?: number | null;
  changePercent?: number | null;
  currency?: string;
  subtitle?: string;
  loading?: boolean;
}

export function StatCard({ label, value, change, changePercent, currency = 'USD', subtitle, loading }: StatCardProps) {
  if (loading) {
    return (
      <div className="card-sm animate-pulse">
        <div className="h-4 bg-surface-border rounded w-1/2 mb-3" />
        <div className="h-8 bg-surface-border rounded w-3/4 mb-2" />
        <div className="h-4 bg-surface-border rounded w-1/3" />
      </div>
    );
  }

  return (
    <div className="card-sm">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-white font-mono">
        {formatCurrency(value, currency)}
      </p>
      {(change !== undefined || changePercent !== undefined) && (
        <div className={clsx('flex items-center gap-2 mt-1 text-sm font-medium', pnlColor(change ?? changePercent))}>
          {change !== null && change !== undefined && (
            <span>{change > 0 ? '+' : ''}{formatCurrency(change, currency)}</span>
          )}
          {changePercent !== null && changePercent !== undefined && (
            <span>{formatPercent(changePercent)}</span>
          )}
        </div>
      )}
      {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
    </div>
  );
}
