'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, TrendingUp, TrendingDown, ChevronDown, Clock } from 'lucide-react';
import { useCreateTransaction, useAssetSearch } from '@/hooks/useApi';
import { clsx } from 'clsx';

const RECENT_KEY = 'tracker:recent_assets';
const MAX_RECENT = 5;

function getRecentAssets(): SelectedAsset[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); } catch { return []; }
}

function saveRecentAsset(asset: SelectedAsset) {
  const prev = getRecentAssets().filter((a) => a.id !== asset.id);
  localStorage.setItem(RECENT_KEY, JSON.stringify([asset, ...prev].slice(0, MAX_RECENT)));
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

const PRIMARY_TYPES = ['BUY', 'SELL'] as const;
const OTHER_TYPES = ['DIVIDEND', 'FEE', 'DEPOSIT', 'WITHDRAWAL', 'TRANSFER_IN', 'TRANSFER_OUT', 'AIRDROP', 'REWARD', 'INTEREST', 'SPLIT'];

const schema = z.object({
  type: z.enum(['BUY', 'SELL', 'DEPOSIT', 'WITHDRAWAL', 'FEE', 'DIVIDEND', 'TRANSFER_IN', 'TRANSFER_OUT', 'AIRDROP', 'REWARD', 'INTEREST', 'SPLIT']),
  assetId: z.string().optional(),
  quantity: z.coerce.number().positive().optional(),
  pricePerUnit: z.coerce.number().min(0).optional(),
  fee: z.coerce.number().min(0).default(0),
  currency: z.enum(['USD', 'EUR', 'ILS', 'GBP', 'BTC', 'ETH']).default('USD'),
  notes: z.string().optional(),
  executedAt: z.string().min(1, 'Date required'),
});

type FormData = z.infer<typeof schema>;

interface SelectedAsset {
  id: string;
  symbol: string;
  name: string;
  assetClass?: string;
  exchange?: string;
}

interface Props {
  portfolioId: string;
  onClose: () => void;
}

export function AddTransactionModal({ portfolioId, onClose }: Props) {
  const createMutation = useCreateTransaction();

  // Debounced search
  const [searchInput, setSearchInput] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showMoreTypes, setShowMoreTypes] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<SelectedAsset | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: searchResults = [] } = useAssetSearch(searchQ);

  // Debounce: only update searchQ 300ms after the user stops typing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (searchInput.length >= 2) {
      debounceRef.current = setTimeout(() => setSearchQ(searchInput), 300);
    } else {
      setSearchQ('');
    }
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'BUY',
      currency: 'USD',
      fee: 0,
      executedAt: new Date().toISOString().split('T')[0],
    },
  });

  const selectedType = watch('type');
  const qty = watch('quantity');
  const price = watch('pricePerUnit');
  const fee = watch('fee') ?? 0;
  const subtotal = (qty ?? 0) * (price ?? 0);
  const total = selectedType === 'BUY' ? subtotal + fee : subtotal - fee;

  const onSubmit = async (data: FormData) => {
    await createMutation.mutateAsync({
      portfolioId,
      assetId: selectedAsset?.id,
      type: data.type,
      quantity: data.quantity,
      pricePerUnit: data.pricePerUnit,
      totalAmount: subtotal || 0,
      fee: data.fee,
      currency: data.currency,
      notes: data.notes,
      source: 'MANUAL',
      executedAt: data.executedAt,
    });
    onClose();
  };

  const handleSelectAsset = (a: any) => {
    const picked: SelectedAsset = { id: a.id, symbol: a.symbol, name: a.name, assetClass: a.assetClass, exchange: a.exchange };
    setSelectedAsset(picked);
    saveRecentAsset(picked);
    setSearchInput('');
    setSearchQ('');
    setShowDropdown(false);
  };

  const recentAssets = getRecentAssets();

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface-card border border-surface-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-surface-border sticky top-0 bg-surface-card z-10">
          <h2 className="text-lg font-semibold text-white">Add Transaction</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-surface rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          {/* Type — pills for BUY/SELL, dropdown for others */}
          <div>
            <label className="label">Type</label>
            <div className="flex gap-2 flex-wrap">
              {PRIMARY_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setValue('type', t)}
                  className={clsx(
                    'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all border',
                    selectedType === t
                      ? t === 'BUY'
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'bg-red-500 border-red-500 text-white'
                      : 'bg-surface border-surface-border text-slate-400 hover:border-slate-500',
                  )}
                >
                  {t === 'BUY' ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {t}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowMoreTypes((v) => !v)}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all border',
                  !PRIMARY_TYPES.includes(selectedType as any)
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-surface border-surface-border text-slate-400 hover:border-slate-500',
                )}
              >
                {!PRIMARY_TYPES.includes(selectedType as any) ? selectedType : 'More'}
                <ChevronDown className={clsx('w-3.5 h-3.5 transition-transform', showMoreTypes && 'rotate-180')} />
              </button>
            </div>
            {showMoreTypes && (
              <div className="mt-2 flex gap-2 flex-wrap">
                {OTHER_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setValue('type', t as any); setShowMoreTypes(false); }}
                    className={clsx(
                      'px-3 py-1.5 rounded-md text-xs font-medium border transition-all',
                      selectedType === t
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-surface border-surface-border text-slate-400 hover:border-slate-500',
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Asset search */}
          <div>
            <label className="label">Asset</label>
            {selectedAsset ? (
              <div className="flex items-center gap-3 bg-surface border border-surface-border rounded-lg px-3 py-2.5">
                <div className={clsx('w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0', ASSET_CLASS_BADGE[selectedAsset.assetClass ?? 'OTHER'])}>
                  {selectedAsset.symbol[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white text-sm">{selectedAsset.symbol}</span>
                    {selectedAsset.assetClass && (
                      <span className={clsx('badge text-[10px]', ASSET_CLASS_BADGE[selectedAsset.assetClass])}>
                        {selectedAsset.assetClass}
                      </span>
                    )}
                    {selectedAsset.exchange && (
                      <span className="text-[10px] text-slate-500">{selectedAsset.exchange}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate">{selectedAsset.name}</p>
                </div>
                <button type="button" onClick={() => setSelectedAsset(null)} className="text-slate-400 hover:text-white flex-shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative" ref={searchRef}>
                <input
                  value={searchInput}
                  onChange={e => { setSearchInput(e.target.value); setShowDropdown(true); }}
                  onFocus={() => setShowDropdown(true)}
                  className="input"
                  placeholder="Search symbol or name…"
                  autoComplete="off"
                />
                {/* Recent assets — shown when input is empty */}
                {showDropdown && searchInput.length === 0 && recentAssets.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-surface-card border border-surface-border rounded-lg mt-1 z-10 shadow-2xl">
                    <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-3 h-3" /> Recent
                    </p>
                    {recentAssets.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-surface flex items-center gap-3 transition-colors"
                        onClick={() => handleSelectAsset(a)}
                      >
                        <div className={clsx('w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0', ASSET_CLASS_BADGE[a.assetClass ?? 'OTHER'])}>
                          {a.symbol[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold text-white text-sm">{a.symbol}</span>
                          <span className="text-slate-400 text-xs ml-2 truncate">{a.name}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {showDropdown && searchResults.length > 0 && searchInput.length >= 2 && (
                  <div className="absolute top-full left-0 right-0 bg-surface-card border border-surface-border rounded-lg mt-1 z-10 max-h-52 overflow-y-auto shadow-2xl">
                    {(searchResults as any[]).map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        className="w-full text-left px-3 py-2.5 hover:bg-surface flex items-center gap-3 transition-colors"
                        onClick={() => handleSelectAsset(a)}
                      >
                        <div className={clsx('w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0', ASSET_CLASS_BADGE[a.assetClass ?? 'OTHER'])}>
                          {a.symbol[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white text-sm">{a.symbol}</span>
                            <span className={clsx('badge text-[10px]', ASSET_CLASS_BADGE[a.assetClass ?? 'OTHER'])}>
                              {a.assetClass}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-slate-400 text-xs truncate">{a.name}</span>
                            {a.exchange && <span className="text-slate-500 text-[10px] flex-shrink-0">{a.exchange}</span>}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {showDropdown && searchInput.length >= 2 && searchResults.length === 0 && searchQ === searchInput && (
                  <div className="absolute top-full left-0 right-0 bg-surface-card border border-surface-border rounded-lg mt-1 z-10 shadow-2xl">
                    <p className="px-3 py-3 text-sm text-slate-400">No assets found for "{searchInput}"</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Qty + Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Quantity</label>
              <input {...register('quantity')} type="number" step="any" className="input" placeholder="0" />
              {errors.quantity && <p className="text-red-400 text-xs mt-1">{errors.quantity.message}</p>}
            </div>
            <div>
              <label className="label">Price per unit</label>
              <input {...register('pricePerUnit')} type="number" step="any" className="input" placeholder="0.00" />
            </div>
          </div>

          {/* Fee + Currency */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Fee</label>
              <input {...register('fee')} type="number" step="any" className="input" placeholder="0" />
            </div>
            <div>
              <label className="label">Currency</label>
              <select {...register('currency')} className="input">
                <option>USD</option>
                <option>EUR</option>
                <option>ILS</option>
                <option>GBP</option>
              </select>
            </div>
          </div>

          {/* Total breakdown */}
          {subtotal > 0 && (
            <div className="bg-surface rounded-lg px-3 py-2.5 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Subtotal</span>
                <span className="font-mono text-slate-300">${subtotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </div>
              {fee > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Fee</span>
                  <span className="font-mono text-slate-400">+${fee.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
              )}
              {fee > 0 && (
                <div className="flex justify-between border-t border-surface-border pt-1.5 mt-1">
                  <span className="font-medium text-slate-300">Total</span>
                  <span className="font-mono font-semibold text-white">${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
              )}
              {fee === 0 && (
                <div className="flex justify-between">
                  <span className="font-medium text-slate-300">Total</span>
                  <span className="font-mono font-semibold text-white">${subtotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
              )}
            </div>
          )}

          {/* Date */}
          <div>
            <label className="label">Date</label>
            <input {...register('executedAt')} type="date" className="input" />
            {errors.executedAt && <p className="text-red-400 text-xs mt-1">{errors.executedAt.message}</p>}
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notes <span className="text-slate-500">(optional)</span></label>
            <input {...register('notes')} className="input" placeholder="Optional notes…" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
              {isSubmitting ? 'Saving…' : 'Add Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
