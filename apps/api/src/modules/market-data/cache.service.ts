/**
 * In-memory TTL cache for market data quotes.
 * Prevents hammering external APIs when the same asset is requested multiple times
 * within the refresh interval.
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QuoteResult } from './interfaces/market-data-provider.interface';

interface CacheEntry {
  quote: QuoteResult;
  expiresAt: number;
}

@Injectable()
export class MarketDataCacheService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly ttlMs: number;

  constructor(private readonly config: ConfigService) {
    // Default TTL: 5 minutes. Configurable via MARKET_DATA_CACHE_TTL_SECONDS env.
    const ttlSeconds = this.config.get<number>('marketData.cacheTtlSeconds') ?? 300;
    this.ttlMs = ttlSeconds * 1000;
  }

  get(assetId: string): QuoteResult | null {
    const entry = this.cache.get(assetId);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(assetId);
      return null;
    }
    return entry.quote;
  }

  set(assetId: string, quote: QuoteResult): void {
    this.cache.set(assetId, { quote, expiresAt: Date.now() + this.ttlMs });
  }

  invalidate(assetId: string): void {
    this.cache.delete(assetId);
  }

  clear(): void {
    this.cache.clear();
  }
}
