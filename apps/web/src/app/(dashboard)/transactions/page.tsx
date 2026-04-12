'use client';

import { useState } from 'react';
import { useTransactions, useDeleteTransaction, usePortfolios } from '@/hooks/useApi';
import { useAuthStore } from '@/stores/auth.store';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import { clsx } from 'clsx';
import { Trash2, Plus } from 'lucide-react';
import { AddTransactionModal } from './add-transaction-modal';
import type { TransactionType } from '@/types';

const TX_BADGE: Record<TransactionType, string> = {
  BUY: 'bg-emerald-950 text-emerald-400',
  SELL: 'bg-red-950 text-red-400',
  DEPOSIT: 'bg-blue-950 text-blue-400',
  WITHDRAWAL: 'bg-orange-950 text-orange-400',
  FEE: 'bg-slate-800 text-slate-400',
  DIVIDEND: 'bg-purple-950 text-purple-400',
  TRANSFER_IN: 'bg-cyan-950 text-cyan-400',
  TRANSFER_OUT: 'bg-yellow-950 text-yellow-400',
  AIRDROP: 'bg-pink-950 text-pink-400',
  REWARD: 'bg-violet-950 text-violet-400',
  INTEREST: 'bg-teal-950 text-teal-400',
  SPLIT: 'bg-slate-700 text-slate-300',
};

export default function TransactionsPage() {
  const { user } = useAuthStore();
  const { data: portfolios } = usePortfolios();
  const defaultPortfolio = portfolios?.find((p) => p.isDefault) ?? portfolios?.[0];

  const { data: txResult, isLoading } = useTransactions(defaultPortfolio?.id);
  const transactions = txResult?.data ?? [];
  const deleteMutation = useDeleteTransaction();
  const [showAdd, setShowAdd] = useState(false);

  const currency = user?.settings?.baseCurrency ?? 'USD';

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this transaction? This will recalculate your holdings.')) return;
    await deleteMutation.mutateAsync(id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Transactions</h1>
          <p className="text-slate-400 text-sm mt-0.5">{txResult?.total ?? 0} records</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          disabled={!defaultPortfolio}
          className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          title={!defaultPortfolio ? 'Portfolio not loaded' : undefined}
        >
          <Plus className="w-4 h-4" />
          Add Transaction
        </button>
      </div>

      {isLoading ? (
        <div className="card text-center py-12 text-slate-400">Loading...</div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="border-b border-surface-border bg-surface">
                <tr>
                  <th className="table-header">Date</th>
                  <th className="table-header">Type</th>
                  <th className="table-header">Asset</th>
                  <th className="table-header text-right">Quantity</th>
                  <th className="table-header text-right">Price</th>
                  <th className="table-header text-right">Total</th>
                  <th className="table-header text-right">Fee</th>
                  <th className="table-header"></th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-400">
                      No transactions yet.
                    </td>
                  </tr>
                )}
                {transactions.map((tx) => (
                  <tr key={tx.id} className="table-row">
                    <td className="table-cell text-slate-300">{formatDate(tx.executedAt)}</td>
                    <td className="table-cell">
                      <span className={clsx('badge font-medium', TX_BADGE[tx.type] ?? 'bg-slate-800 text-slate-400')}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="table-cell">
                      {tx.asset ? (
                        <div>
                          <span className="font-semibold text-white">{tx.asset.symbol}</span>
                          <span className="text-slate-400 text-xs ml-1">{tx.asset.name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="table-cell text-right font-mono">
                      {tx.quantity != null ? formatNumber(tx.quantity) : '—'}
                    </td>
                    <td className="table-cell text-right font-mono text-slate-300">
                      {tx.pricePerUnit != null ? formatCurrency(tx.pricePerUnit, tx.currency) : '—'}
                    </td>
                    <td className="table-cell text-right font-mono font-semibold text-white">
                      {formatCurrency(tx.totalAmount, tx.currency)}
                    </td>
                    <td className="table-cell text-right font-mono text-slate-400">
                      {Number(tx.fee) > 0 ? formatCurrency(tx.fee, tx.currency) : '—'}
                    </td>
                    <td className="table-cell text-right">
                      <button
                        onClick={() => handleDelete(tx.id)}
                        className="p-1.5 rounded hover:bg-red-950 hover:text-red-400 text-slate-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAdd && defaultPortfolio && (
        <AddTransactionModal
          portfolioId={defaultPortfolio.id}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}
