import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { HoldingWithPnl, PortfolioSummary, Transaction, Portfolio, AnalyticsSummary } from '@/types';

// ─── Portfolios ────────────────────────────────────────────────────────────

export function usePortfolios() {
  return useQuery<Portfolio[]>({
    queryKey: ['portfolios'],
    queryFn: async () => {
      const res = await api.get('/portfolios');
      return res.data.data;
    },
  });
}

export function usePortfolioSummary(portfolioId: string | undefined) {
  return useQuery<PortfolioSummary>({
    queryKey: ['portfolio-summary', portfolioId],
    queryFn: async () => {
      const res = await api.get(`/portfolios/${portfolioId}/summary`);
      return res.data.data;
    },
    enabled: !!portfolioId,
    refetchInterval: 60_000, // refresh every 60s
  });
}

// ─── Holdings ─────────────────────────────────────────────────────────────

export function useHoldings(portfolioId: string | undefined) {
  return useQuery<HoldingWithPnl[]>({
    queryKey: ['holdings', portfolioId],
    queryFn: async () => {
      const res = await api.get(`/portfolios/${portfolioId}/holdings`);
      return res.data.data;
    },
    enabled: !!portfolioId,
    refetchInterval: 60_000,
  });
}

// ─── Transactions ─────────────────────────────────────────────────────────

export function useTransactions(portfolioId?: string, page = 1, limit = 200) {
  return useQuery<{ data: Transaction[]; total: number; page: number; totalPages: number }>({
    queryKey: ['transactions', portfolioId, page],
    queryFn: async () => {
      const res = await api.get('/transactions', {
        params: { ...(portfolioId ? { portfolioId } : {}), page, limit },
      });
      return res.data.data;
    },
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: object) => {
      const res = await api.post('/transactions', data);
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['holdings'] });
      qc.invalidateQueries({ queryKey: ['portfolio-summary'] });
    },
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/transactions/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['holdings'] });
      qc.invalidateQueries({ queryKey: ['portfolio-summary'] });
    },
  });
}

// ─── Analytics ────────────────────────────────────────────────────────────

export function useAnalyticsSummary() {
  return useQuery<AnalyticsSummary>({
    queryKey: ['analytics-summary'],
    queryFn: async () => {
      const res = await api.get('/analytics/summary');
      return res.data.data;
    },
    refetchInterval: 60_000,
  });
}

export function useRankings() {
  return useQuery({
    queryKey: ['rankings'],
    queryFn: async () => {
      const res = await api.get('/analytics/rankings');
      return res.data.data;
    },
    refetchInterval: 60_000,
  });
}

export function useAllocation() {
  return useQuery({
    queryKey: ['allocation'],
    queryFn: async () => {
      const res = await api.get('/analytics/allocation');
      return res.data.data;
    },
    refetchInterval: 60_000,
  });
}

// ─── Watchlist ────────────────────────────────────────────────────────────

export function useWatchlist() {
  return useQuery({
    queryKey: ['watchlist'],
    queryFn: async () => {
      const res = await api.get('/watchlist');
      return res.data.data;
    },
  });
}

export function useAddToWatchlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (assetId: string) => {
      const res = await api.post(`/watchlist/${assetId}`);
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watchlist'] }),
  });
}

export function useRemoveFromWatchlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (assetId: string) => {
      await api.delete(`/watchlist/${assetId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watchlist'] }),
  });
}

// ─── Market Data ──────────────────────────────────────────────────────────

export function useRefreshAllQuotes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<{ refreshedAt: string }> => {
      const res = await api.post('/market-data/refresh-all');
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['holdings'] });
      qc.invalidateQueries({ queryKey: ['portfolio-summary'] });
      qc.invalidateQueries({ queryKey: ['analytics-summary'] });
    },
  });
}

// ─── Asset history (for detail page charts) ───────────────────────────────

export function useAssetHistory(assetId: string | undefined, range: '5d' | '1mo' | '3mo' | '1y' = '1mo') {
  return useQuery({
    queryKey: ['asset-history', assetId, range],
    queryFn: async () => {
      const res = await api.get(`/market-data/history/${assetId}`, { params: { range } });
      return res.data.data as Array<{ date: string; price: number; open?: number; high?: number; low?: number; volume?: number }>;
    },
    enabled: !!assetId,
    staleTime: 5 * 60_000,
  });
}

export function useAssetDetail(assetId: string | undefined) {
  return useQuery({
    queryKey: ['asset-detail', assetId],
    queryFn: async () => {
      const res = await api.get(`/assets/${assetId}`);
      return res.data.data;
    },
    enabled: !!assetId,
  });
}

// ─── News ─────────────────────────────────────────────────────────────────

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  imageUrl?: string;
  category: string;
  impactLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  affectedMarkets: string[];
  affectedAssets: string[];
  tags: string[];
  publishedAt: string;
}

export interface NewsFeed {
  data: NewsArticle[];
  total: number;
  page: number;
  totalPages: number;
}

export function useNewsFeed(params?: { category?: string; impact?: string; market?: string; page?: number; limit?: number }) {
  return useQuery<NewsFeed>({
    queryKey: ['news-feed', params],
    queryFn: async () => {
      const res = await api.get('/news', { params });
      return res.data.data;
    },
    staleTime: 5 * 60_000,
  });
}

export function useNewsFeatured() {
  return useQuery<NewsArticle[]>({
    queryKey: ['news-featured'],
    queryFn: async () => {
      const res = await api.get('/news/featured');
      return res.data.data;
    },
    staleTime: 5 * 60_000,
  });
}

export function useNewsDashboard() {
  return useQuery<{ highImpact: NewsArticle[]; recent: NewsArticle[]; lastFetchedAt: string | null }>({
    queryKey: ['news-dashboard'],
    queryFn: async () => {
      const res = await api.get('/news/dashboard');
      return res.data.data;
    },
    staleTime: 5 * 60_000,
    select: (data) => ({
      highImpact: data?.highImpact ?? [],
      recent: data?.recent ?? [],
      lastFetchedAt: data?.lastFetchedAt ?? null,
    }),
  });
}

export function useAssetNews(symbol: string | undefined) {
  return useQuery<NewsArticle[]>({
    queryKey: ['news-asset', symbol],
    queryFn: async () => {
      const res = await api.get(`/news/asset/${symbol}`);
      return res.data.data;
    },
    enabled: !!symbol,
    staleTime: 5 * 60_000,
  });
}

// ─── Assets ───────────────────────────────────────────────────────────────

// ─── Reconciliation ───────────────────────────────────────────────────────────

export interface ReconciliationStatus {
  holdingsCount: number;
  transactionsCount: number;
  assetsWithoutQuotes: Array<{ id: string; symbol: string; name: string; assetClass: string }>;
  staleQuotes: Array<{ id: string; symbol: string; name: string; assetClass: string; lastQuoteAt: string | null }>;
  checkedAt: string;
}

export function useReconciliation() {
  return useQuery<ReconciliationStatus>({
    queryKey: ['reconciliation'],
    queryFn: async () => {
      const res = await api.get('/analytics/reconciliation');
      return res.data.data;
    },
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });
}

export function useAssetSearch(q: string) {
  return useQuery({
    queryKey: ['asset-search', q],
    queryFn: async () => {
      const res = await api.get('/assets/search', { params: { q } });
      return res.data.data;
    },
    enabled: q.length >= 2,
  });
}
