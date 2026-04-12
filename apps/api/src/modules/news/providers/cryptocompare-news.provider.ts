/**
 * CryptoCompare News provider.
 * Free tier: no API key required (up to 250k calls/month).
 * Optional key via NEWS_CRYPTOCOMPARE_API_KEY env var for higher limits.
 * Covers: crypto, market, regulation, technology categories.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NewsProvider, NewsArticleInput } from './news-provider.interface';

// Maps CryptoCompare category strings → our NewsCategory enum values
const CATEGORY_MAP: Array<[RegExp, string]> = [
  [/regulat|sec|legal|law|government|ban/i, 'REGULATORY'],
  [/market|trading|price|bull|bear|pump|dump/i, 'MARKET_NEWS'],
  [/earn|revenue|profit|quarter|ipo/i, 'EARNINGS'],
  [/fed|central.bank|rate|fomc|inflation|cpi/i, 'FED_CENTRAL_BANKS'],
  [/geopolit|war|sanction|conflict/i, 'GEOPOLITICS'],
];

// Asset symbols to detect in tags/categories
const KNOWN_SYMBOLS = new Set([
  'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'MATIC',
  'AVAX', 'DOT', 'LINK', 'UNI', 'LTC', 'ATOM', 'ARB', 'OP', 'TON',
]);

interface CryptoCompareArticle {
  id: string;
  published_on: number;
  imageurl?: string;
  title: string;
  url: string;
  source: string;
  body?: string;
  tags?: string;
  categories?: string;
  source_info?: { name?: string };
}

@Injectable()
export class CryptoCompareNewsProvider implements NewsProvider {
  private readonly logger = new Logger(CryptoCompareNewsProvider.name);
  readonly providerSlug = 'cryptocompare';

  private readonly baseUrl = 'https://min-api.cryptocompare.com/data/v2/news';

  constructor(private readonly config: ConfigService) {}

  async fetchArticles(): Promise<NewsArticleInput[]> {
    const apiKey = this.config.get<string>('news.cryptoCompareKey') ?? '';
    const params = new URLSearchParams({ lang: 'EN', sortOrder: 'latest', limit: '50' });
    if (apiKey) params.set('api_key', apiKey);

    const url = `${this.baseUrl}/?${params.toString()}`;

    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      throw new Error(`CryptoCompare news request failed: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as { Type?: number; Data?: CryptoCompareArticle[] };

    if (data.Type !== 100 || !Array.isArray(data.Data)) {
      throw new Error('CryptoCompare returned unexpected response shape');
    }

    return data.Data
      .map((a) => this.mapArticle(a))
      .filter((a): a is NewsArticleInput => a !== null);
  }

  private mapArticle(a: CryptoCompareArticle): NewsArticleInput | null {
    if (!a.url || !a.title) return null;

    const rawCategories = a.categories ?? '';
    const categories = rawCategories
      .split('|')
      .map((c) => c.trim())
      .filter(Boolean);

    return {
      title: a.title,
      summary: this.truncate(a.body ?? '', 280),
      url: a.url,
      source: a.source_info?.name ?? a.source ?? 'CryptoCompare',
      imageUrl: a.imageurl || undefined,
      category: this.mapCategory(categories),
      impactLevel: this.mapImpact(a.title, categories),
      affectedMarkets: ['CRYPTO'],
      affectedAssets: this.extractSymbols(a.tags ?? '', rawCategories),
      tags: categories.map((c) => c.toLowerCase()).slice(0, 8),
      publishedAt: new Date(a.published_on * 1000),
    };
  }

  private mapCategory(categories: string[]): string {
    const combined = categories.join(' ');
    for (const [pattern, cat] of CATEGORY_MAP) {
      if (pattern.test(combined)) return cat;
    }
    return 'CRYPTO';
  }

  private mapImpact(title: string, categories: string[]): string {
    const t = title.toLowerCase();
    const highTerms = ['all-time high', 'ath', 'crash', 'hack', 'exploit', 'billion', 'ban', 'etf approved', 'etf rejected'];
    const medTerms = ['surge', 'rally', 'drop', 'etf', 'regulation', 'sec', 'upgrade', 'launch'];
    if (highTerms.some((term) => t.includes(term))) return 'HIGH';
    if (medTerms.some((term) => t.includes(term))) return 'MEDIUM';
    return 'LOW';
  }

  private extractSymbols(tags: string, categories: string): string[] {
    return `${tags}|${categories}`
      .toUpperCase()
      .split('|')
      .map((s) => s.trim())
      .filter((s) => KNOWN_SYMBOLS.has(s))
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .slice(0, 6);
  }

  private truncate(text: string, maxLen: number): string {
    const clean = text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (clean.length <= maxLen) return clean;
    return clean.slice(0, maxLen).replace(/\s\S*$/, '') + '…';
  }
}
