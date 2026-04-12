'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useState } from 'react';
import { Plus, Trash2, RefreshCw, Link2Off } from 'lucide-react';
import { formatDate } from '@/lib/format';

function useBrokerAccounts() {
  return useQuery({
    queryKey: ['broker-accounts'],
    queryFn: async () => {
      const res = await api.get('/broker-accounts');
      return res.data.data;
    },
  });
}

export default function AccountsPage() {
  const qc = useQueryClient();
  const { data: accounts = [], isLoading } = useBrokerAccounts();
  const [showAdd, setShowAdd] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/broker-accounts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['broker-accounts'] }),
  });

  const handleSync = async (id: string) => {
    setSyncingId(id);
    try {
      await api.post(`/broker-accounts/${id}/sync`);
      qc.invalidateQueries({ queryKey: ['broker-accounts'] });
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Broker Accounts</h1>
          <p className="text-slate-400 text-sm mt-0.5">Connect exchanges and brokers to sync your positions</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Connect Account
        </button>
      </div>

      {isLoading ? (
        <div className="card text-center py-12 text-slate-400">Loading...</div>
      ) : accounts.length === 0 ? (
        <div className="card text-center py-16">
          <Link2Off className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 font-medium">No accounts connected</p>
          <p className="text-slate-500 text-sm mt-1">Connect a broker or exchange to import your transactions automatically</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {accounts.map((account: any) => (
            <div key={account.id} className="card flex items-center justify-between">
              <div>
                <p className="font-semibold text-white">{account.name}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="badge bg-slate-800 text-slate-400">{account.brokerSlug}</span>
                  <span className="badge bg-slate-800 text-slate-400">{account.brokerType}</span>
                  {account.lastSyncedAt && (
                    <span className="text-xs text-slate-500">Last synced {formatDate(account.lastSyncedAt)}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSync(account.id)}
                  disabled={syncingId === account.id}
                  className="btn-ghost flex items-center gap-2 text-sm"
                >
                  <RefreshCw className={`w-4 h-4 ${syncingId === account.id ? 'animate-spin' : ''}`} />
                  Sync
                </button>
                <button
                  onClick={() => deleteMutation.mutate(account.id)}
                  className="p-2 hover:bg-red-950 hover:text-red-400 text-slate-400 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddAccountModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function AddAccountModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    brokerSlug: 'mock_broker',
    brokerType: 'STOCK_BROKER',
    apiKey: '',
    apiSecret: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const credentials = form.apiKey ? { apiKey: form.apiKey, apiSecret: form.apiSecret } : undefined;
      await api.post('/broker-accounts', {
        name: form.name,
        brokerSlug: form.brokerSlug,
        brokerType: form.brokerType,
        credentials,
      });
      qc.invalidateQueries({ queryKey: ['broker-accounts'] });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to connect account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface-card border border-surface-border rounded-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-white mb-5">Connect Account</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Account Name</label>
            <input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="input"
              placeholder="My Binance Account"
              required
            />
          </div>
          <div>
            <label className="label">Broker / Exchange</label>
            <select
              value={form.brokerSlug}
              onChange={e => setForm({ ...form, brokerSlug: e.target.value })}
              className="input"
            >
              <option value="mock_broker">Mock Broker (Demo)</option>
              <option value="binance">Binance</option>
            </select>
          </div>
          {form.brokerSlug === 'binance' && (
            <>
              <div>
                <label className="label">API Key</label>
                <input
                  value={form.apiKey}
                  onChange={e => setForm({ ...form, apiKey: e.target.value })}
                  className="input"
                  placeholder="Your Binance API Key"
                />
              </div>
              <div>
                <label className="label">API Secret</label>
                <input
                  value={form.apiSecret}
                  onChange={e => setForm({ ...form, apiSecret: e.target.value })}
                  type="password"
                  className="input"
                />
              </div>
            </>
          )}

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
