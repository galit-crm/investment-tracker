'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import { ExternalLink, AlertTriangle, TrendingUp, Info, Newspaper, Zap } from 'lucide-react';
import { useNewsFeatured, useNewsFeed, type NewsArticle } from '@/hooks/useApi';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: '', label: 'All' },
  { value: 'FED_CENTRAL_BANKS', label: 'Central Banks' },
  { value: 'INFLATION_MACRO', label: 'Macro' },
  { value: 'EARNINGS', label: 'Earnings' },
  { value: 'GEOPOLITICS', label: 'Geopolitics' },
  { value: 'CRYPTO', label: 'Crypto' },
  { value: 'MARKET_NEWS', label: 'Markets' },
  { value: 'REGULATORY', label: 'Regulatory' },
] as const;

const IMPACTS = [
  { value: '', label: 'All Impact' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
] as const;

const IMPACT_CONFIG = {
  HIGH:   { label: 'HIGH',   icon: AlertTriangle, style: 'text-red-400 bg-red-950/50 border-red-900/50',   dot: 'bg-red-400' },
  MEDIUM: { label: 'MEDIUM', icon: TrendingUp,    style: 'text-amber-400 bg-amber-950/50 border-amber-900/50', dot: 'bg-amber-400' },
  LOW:    { label: 'LOW',    icon: Info,           style: 'text-slate-400 bg-slate-800/50 border-slate-700/50',  dot: 'bg-slate-500' },
} as const;

const CATEGORY_LABELS: Record<string, string> = {
  FED_CENTRAL_BANKS: 'Central Banks',
  INFLATION_MACRO: 'Macro',
  EARNINGS: 'Earnings',
  GEOPOLITICS: 'Geopolitics',
  CRYPTO: 'Crypto',
  MARKET_NEWS: 'Markets',
  REGULATORY: 'Regulatory',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Components ───────────────────────────────────────────────────────────────

function ImpactBadge({ level }: { level: 'LOW' | 'MEDIUM' | 'HIGH' }) {
  const cfg = IMPACT_CONFIG[level];
  const Icon = cfg.icon;
  return (
    <span className={clsx('inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border', cfg.style)}>
      <Icon className="w-2.5 h-2.5" />
      {cfg.label}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-800/60 px-2 py-0.5 rounded-full">
      {CATEGORY_LABELS[category] ?? category}
    </span>
  );
}

function NewsCard({ article, featured = false }: { article: NewsArticle; featured?: boolean }) {
  const cfg = IMPACT_CONFIG[article.impactLevel];

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className={clsx(
        'card group flex gap-4 hover:border-slate-600 transition-all duration-200',
        featured && 'border-l-2 border-l-brand-600',
      )}
    >
      {/* Left accent bar */}
      <div className={clsx('flex-shrink-0 w-1 rounded-full self-stretch', cfg.dot)} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <CategoryBadge category={article.category} />
          <ImpactBadge level={article.impactLevel} />
          {featured && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-brand-400">
              <Zap className="w-2.5 h-2.5" /> Featured
            </span>
          )}
        </div>

        <h3 className={clsx(
          'font-semibold text-white group-hover:text-brand-300 transition-colors leading-snug',
          featured ? 'text-base' : 'text-sm',
        )}>
          {article.title}
        </h3>

        <p className="text-xs text-slate-400 mt-1.5 leading-relaxed line-clamp-2">
          {article.summary}
        </p>

        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <span className="text-xs font-medium text-slate-500">{article.source}</span>
          <span className="text-slate-700">·</span>
          <span className="text-xs text-slate-500">{timeAgo(article.publishedAt)}</span>
          {article.affectedAssets.length > 0 && (
            <>
              <span className="text-slate-700">·</span>
              <div className="flex gap-1 flex-wrap">
                {article.affectedAssets.slice(0, 4).map((sym) => (
                  <span key={sym} className="text-[10px] font-mono font-semibold text-brand-400 bg-brand-950/30 px-1.5 py-0.5 rounded">
                    {sym}
                  </span>
                ))}
                {article.affectedAssets.length > 4 && (
                  <span className="text-[10px] text-slate-500">+{article.affectedAssets.length - 4}</span>
                )}
              </div>
            </>
          )}
          <ExternalLink className="w-3 h-3 text-slate-600 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    </a>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewsPage() {
  const [category, setCategory] = useState('');
  const [impact, setImpact] = useState('');
  const [page, setPage] = useState(1);

  const { data: featured = [], isLoading: featuredLoading } = useNewsFeatured();
  const { data: feed, isLoading: feedLoading } = useNewsFeed({
    ...(category ? { category } : {}),
    ...(impact ? { impact } : {}),
    page,
    limit: 15,
  });

  const showFeatured = !category && !impact && page === 1;

  const handleFilter = (type: 'category' | 'impact', value: string) => {
    if (type === 'category') setCategory(value);
    if (type === 'impact') setImpact(value);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-600/20 border border-brand-600/30 flex items-center justify-center">
            <Newspaper className="w-4 h-4 text-brand-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Market Intelligence</h1>
            <p className="text-slate-400 text-sm">News and macro events affecting your portfolio</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex gap-1 bg-surface-card rounded-lg p-1 border border-surface-border">
          {CATEGORIES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => handleFilter('category', value)}
              className={clsx(
                'px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                category === value
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-surface',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex gap-1 bg-surface-card rounded-lg p-1 border border-surface-border">
          {IMPACTS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => handleFilter('impact', value)}
              className={clsx(
                'px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                impact === value
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-surface',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Featured section */}
      {showFeatured && featured.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            High Impact Events
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {featuredLoading
              ? [...Array(4)].map((_, i) => <div key={i} className="card animate-pulse h-32" />)
              : featured.map((article) => (
                  <NewsCard key={article.id} article={article} featured />
                ))}
          </div>
        </div>
      )}

      {/* Feed */}
      <div>
        {showFeatured && (
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            All News
          </p>
        )}
        {feedLoading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => <div key={i} className="card animate-pulse h-28" />)}
          </div>
        ) : feed?.data.length === 0 ? (
          <div className="card text-center py-16">
            <Newspaper className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No articles match the selected filters.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {feed?.data.map((article) => (
              <NewsCard key={article.id} article={article} />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {feed && feed.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-ghost disabled:opacity-40 text-sm"
          >
            ← Previous
          </button>
          <span className="text-sm text-slate-400">
            Page {feed.page} of {feed.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(feed.totalPages, p + 1))}
            disabled={page === feed.totalPages}
            className="btn-ghost disabled:opacity-40 text-sm"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
