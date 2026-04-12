'use client';

import { useState, useRef } from 'react';
import { Upload, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import api from '@/lib/api';
import { usePortfolios } from '@/hooks/useApi';
import { clsx } from 'clsx';

interface PreviewRow {
  rowIndex: number;
  date: string;
  symbol: string;
  type: string;
  quantity: number;
  pricePerUnit: number;
  fee: number;
  currency: string;
  errors: string[];
  valid: boolean;
}

export default function ImportPage() {
  const { data: portfolios = [] } = usePortfolios();
  const defaultPortfolio = portfolios.find((p) => p.isDefault) ?? portfolios[0];

  const [preview, setPreview] = useState<{ rows: PreviewRow[]; summary: any } | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError('');
    setPreview(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/import/csv/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreview(res.data.data);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to parse CSV');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!preview || !defaultPortfolio) return;
    setLoading(true);
    try {
      const res = await api.post('/import/csv/execute', {
        portfolioId: defaultPortfolio.id,
        rows: preview.rows,
      });
      setResult(res.data.data);
      setPreview(null);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Import Transactions</h1>
        <p className="text-slate-400 text-sm mt-0.5">Upload a CSV file to bulk import transactions</p>
      </div>

      {/* Format help */}
      <div className="card bg-brand-600/10 border-brand-600/30">
        <h3 className="text-sm font-semibold text-brand-400 mb-2">Expected CSV format</h3>
        <code className="text-xs text-slate-300 font-mono">
          date,symbol,type,quantity,price,fee,currency,notes<br />
          2023-01-15,AAPL,BUY,10,150.00,0,USD,Initial purchase<br />
          2023-06-10,BTC,BUY,0.5,25000,12.50,USD,
        </code>
        <p className="text-xs text-slate-500 mt-2">
          Type values: BUY, SELL, DIVIDEND, FEE, DEPOSIT, WITHDRAWAL, TRANSFER_IN, TRANSFER_OUT, AIRDROP, REWARD
        </p>
      </div>

      {/* Upload area */}
      <div
        className="border-2 border-dashed border-surface-border rounded-xl p-10 text-center cursor-pointer hover:border-brand-500 transition-colors"
        onClick={() => fileRef.current?.click()}
      >
        <Upload className="w-10 h-10 text-slate-500 mx-auto mb-3" />
        <p className="text-slate-300 font-medium">Click to upload CSV file</p>
        <p className="text-slate-500 text-sm mt-1">or drag & drop</p>
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
      </div>

      {error && (
        <div className="bg-red-950 border border-red-800 text-red-400 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
          <XCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {loading && (
        <div className="card text-center py-8 text-slate-400">Processing...</div>
      )}

      {/* Preview */}
      {preview && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="badge bg-emerald-950 text-emerald-400">{preview.summary.valid} valid</span>
              {preview.summary.invalid > 0 && (
                <span className="badge bg-red-950 text-red-400">{preview.summary.invalid} invalid</span>
              )}
            </div>
            <button onClick={handleImport} disabled={loading || preview.summary.valid === 0} className="btn-primary">
              Import {preview.summary.valid} rows
            </button>
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead className="border-b border-surface-border bg-surface">
                  <tr>
                    <th className="table-header">#</th>
                    <th className="table-header">Date</th>
                    <th className="table-header">Symbol</th>
                    <th className="table-header">Type</th>
                    <th className="table-header text-right">Qty</th>
                    <th className="table-header text-right">Price</th>
                    <th className="table-header text-right">Fee</th>
                    <th className="table-header">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr key={row.rowIndex} className={clsx('table-row', !row.valid && 'bg-red-950/10')}>
                      <td className="table-cell text-slate-500">{row.rowIndex}</td>
                      <td className="table-cell">{row.date}</td>
                      <td className="table-cell font-semibold text-white">{row.symbol}</td>
                      <td className="table-cell">{row.type}</td>
                      <td className="table-cell text-right font-mono">{row.quantity}</td>
                      <td className="table-cell text-right font-mono">{row.pricePerUnit}</td>
                      <td className="table-cell text-right font-mono">{row.fee}</td>
                      <td className="table-cell">
                        {row.valid ? (
                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <div className="flex items-center gap-1">
                            <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                            <span className="text-xs text-red-400">{row.errors.join(', ')}</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Success */}
      {result && (
        <div className="card bg-emerald-950/30 border-emerald-800 flex items-center gap-4">
          <CheckCircle className="w-8 h-8 text-emerald-400 flex-shrink-0" />
          <div>
            <p className="font-semibold text-emerald-400">Import complete!</p>
            <p className="text-sm text-slate-300">
              {result.imported} transactions imported, {result.skipped} skipped.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
