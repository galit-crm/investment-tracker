'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';
import { useState } from 'react';

const schema = z.object({
  displayName: z.string().min(2).max(80),
  baseCurrency: z.enum(['USD', 'EUR', 'ILS', 'GBP']),
  displayTimezone: z.string(),
  autoRefreshMin: z.coerce.number().min(5).max(1440),
  showSmallHoldings: z.boolean(),
});

type FormData = z.infer<typeof schema>;

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const [saved, setSaved] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: user?.displayName ?? '',
      baseCurrency: (user?.settings?.baseCurrency as any) ?? 'USD',
      displayTimezone: user?.settings?.displayTimezone ?? 'UTC',
      autoRefreshMin: 15,
      showSmallHoldings: true,
    },
  });

  const onSubmit = async (data: FormData) => {
    setSaved(false);
    const { displayName, ...settings } = data;

    await Promise.all([
      api.patch('/users/me', { displayName }),
      api.patch('/users/me/settings', settings),
    ]);

    setUser({ ...user!, displayName });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-2xl font-bold text-white">Settings</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-slate-300">Profile</h2>

          <div>
            <label className="label">Display Name</label>
            <input {...register('displayName')} className="input" />
            {errors.displayName && <p className="text-red-400 text-xs mt-1">{errors.displayName.message}</p>}
          </div>

          <div>
            <label className="label">Email</label>
            <input value={user?.email ?? ''} readOnly className="input opacity-60 cursor-not-allowed" />
            <p className="text-xs text-slate-500 mt-1">Email cannot be changed.</p>
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-slate-300">Preferences</h2>

          <div>
            <label className="label">Base Currency</label>
            <select {...register('baseCurrency')} className="input">
              <option value="USD">USD – US Dollar</option>
              <option value="EUR">EUR – Euro</option>
              <option value="ILS">ILS – Israeli Shekel</option>
              <option value="GBP">GBP – British Pound</option>
            </select>
          </div>

          <div>
            <label className="label">Timezone</label>
            <input {...register('displayTimezone')} className="input" placeholder="America/New_York" />
          </div>

          <div>
            <label className="label">Price refresh interval (minutes)</label>
            <input {...register('autoRefreshMin')} type="number" className="input" min={5} max={1440} />
          </div>

          <div className="flex items-center gap-3">
            <input {...register('showSmallHoldings')} type="checkbox" id="showSmall" className="w-4 h-4 rounded accent-brand-500" />
            <label htmlFor="showSmall" className="text-sm text-slate-300">Show small holdings (&lt; $1)</label>
          </div>
        </div>

        {saved && (
          <div className="bg-emerald-950 border border-emerald-800 text-emerald-400 rounded-lg px-4 py-3 text-sm">
            Settings saved successfully.
          </div>
        )}

        <button type="submit" disabled={isSubmitting} className="btn-primary">
          {isSubmitting ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}
