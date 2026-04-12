/**
 * Formatting utilities for numbers, currencies, and percentages.
 */

export function formatCurrency(
  value: number | null | undefined,
  currency = 'USD',
  compact = false,
): string {
  if (value == null) return '—';

  const opts: Intl.NumberFormatOptions = {
    style: 'currency',
    currency,
    notation: compact && Math.abs(value) >= 1_000_000 ? 'compact' : 'standard',
    maximumFractionDigits: Math.abs(value) >= 1000 ? 0 : 2,
  };

  return new Intl.NumberFormat('en-US', opts).format(value);
}

export function formatPercent(value: number | null | undefined, decimals = 2): string {
  if (value == null) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

export function formatNumber(value: number | null | undefined, decimals = 4): string {
  if (value == null) return '—';
  if (value === 0) return '0';

  // Crypto: show more decimals for small values
  const fractionDigits = value < 0.01 ? 8 : value < 1 ? 6 : decimals;

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

export function pnlColor(value: number | null | undefined): string {
  if (value == null) return 'text-slate-400';
  if (value > 0) return 'text-emerald-400';
  if (value < 0) return 'text-red-400';
  return 'text-slate-400';
}

export function pnlBgColor(value: number | null | undefined): string {
  if (value == null) return 'bg-slate-800';
  if (value > 0) return 'bg-emerald-950 text-emerald-400';
  if (value < 0) return 'bg-red-950 text-red-400';
  return 'bg-slate-800 text-slate-400';
}
