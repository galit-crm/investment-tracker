/**
 * MarketDataService – orchestrates quote fetching across providers.
 *
 * Provider priority:
 *   CRYPTO  → CoinGecko → Mock (fallback)
 *   STOCKS  → Yahoo Finance (TODO) → Mock (fallback)
 *   ALL     → Mock (always last resort)
 *
 * Features:
 *   - Per-asset provider selection based on asset class
 *   - Fallback chain: if primary throws, tries next provider
 *   - Persists latest quotes to DB
 *   - Scheduled refresh every N minutes (configurable per user)
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Currency } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MarketDataProvider, QuoteResult } from './interfaces/market-data-provider.interface';
import { CoinGeckoProvider } from './providers/coingecko.provider';
import { YahooFinanceProvider } from './providers/yahoo-finance.provider';
import { MockMarketDataProvider } from './providers/mock.provider';
import { MarketDataCacheService } from './cache.service';

@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);
  private readonly providers: MarketDataProvider[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly coingecko: CoinGeckoProvider,
    private readonly yahoo: YahooFinanceProvider,
    private readonly mock: MockMarketDataProvider,
    private readonly cache: MarketDataCacheService,
  ) {
    // Provider order determines priority within fetchWithFallback
    this.providers = [coingecko, yahoo, mock];
  }

  /** Cron: refresh all active asset quotes every 15 minutes */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async refreshAllQuotes() {
    this.logger.log('Scheduled quote refresh started');

    const assets = await this.prisma.asset.findMany({
      where: { isActive: true },
      select: { id: true, symbol: true, assetClass: true, coingeckoId: true, yahooSymbol: true },
    });

    let refreshed = 0;
    let failed = 0;

    for (const asset of assets) {
      try {
        await this.refreshAssetQuote(asset);
        refreshed++;
      } catch (err) {
        this.logger.warn(`Failed to refresh quote for ${asset.symbol}: ${(err as Error).message}`);
        failed++;
      }
    }

    this.logger.log(`Quote refresh done: ${refreshed} refreshed, ${failed} failed`);
  }

  /** Manually trigger refresh for a specific asset */
  async refreshAssetQuote(asset: {
    id: string;
    symbol: string;
    assetClass: string;
    coingeckoId?: string | null;
    yahooSymbol?: string | null;
  }): Promise<QuoteResult> {
    const extra: Record<string, string> = {};
    if (asset.coingeckoId) extra['coingeckoId'] = asset.coingeckoId;
    if (asset.yahooSymbol) extra['yahooSymbol'] = asset.yahooSymbol;

    const quote = await this.fetchWithFallback(asset.symbol, asset.assetClass, extra);

    await this.persistQuote(asset.id, quote);
    this.cache.set(asset.id, quote);
    return quote;
  }

  /** Get latest quote for an asset. Checks memory cache → DB (no live fetch). */
  async getQuote(assetId: string): Promise<QuoteResult | null> {
    // 1. Memory cache (avoids DB round-trip for hot assets)
    const memCached = this.cache.get(assetId);
    if (memCached) return memCached;

    // 2. DB (most recent quote from any provider)
    const cached = await this.prisma.quote.findFirst({
      where: { assetId },
      orderBy: { fetchedAt: 'desc' },
    });

    if (cached) {
      const quote: QuoteResult = {
        symbol: cached.assetId,
        provider: cached.provider,
        price: Number(cached.price),
        changePercent: cached.changePercent ? Number(cached.changePercent) : undefined,
        priceChange: cached.priceChange ? Number(cached.priceChange) : undefined,
        high24h: cached.high24h ? Number(cached.high24h) : undefined,
        low24h: cached.low24h ? Number(cached.low24h) : undefined,
        volume24h: cached.volume24h ? Number(cached.volume24h) : undefined,
        marketCap: cached.marketCap ? Number(cached.marketCap) : undefined,
        currency: cached.currency,
        fetchedAt: cached.fetchedAt,
      };
      this.cache.set(assetId, quote);
      return quote;
    }

    return null;
  }

  /**
   * Fetch historical OHLCV prices for charting.
   * Uses Yahoo Finance for stocks/ETFs, CoinGecko for crypto.
   */
  async fetchHistory(
    assetId: string,
    range: '5d' | '1mo' | '3mo' | '1y' = '1mo',
  ): Promise<Array<{ date: string; price: number; open?: number; high?: number; low?: number; volume?: number }>> {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
      select: { yahooSymbol: true, coingeckoId: true, symbol: true },
    });

    if (!asset) return [];

    if (asset.yahooSymbol) {
      return this.fetchYahooHistory(asset.yahooSymbol, range);
    }
    if (asset.coingeckoId) {
      return this.fetchCoinGeckoHistory(asset.coingeckoId, range);
    }

    return [];
  }

  private async fetchYahooHistory(
    symbol: string,
    range: string,
  ): Promise<Array<{ date: string; price: number; open?: number; high?: number; low?: number; volume?: number }>> {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; investment-tracker/1.0)' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return [];

      const data = (await res.json()) as any;
      const result = data?.chart?.result?.[0];
      if (!result) return [];

      const timestamps: number[] = result.timestamp ?? [];
      const q = result.indicators?.quote?.[0] ?? {};

      return timestamps
        .map((ts, i) => ({
          date: new Date(ts * 1000).toISOString().split('T')[0],
          price: (q.close?.[i] as number) ?? null,
          open: q.open?.[i] as number | undefined,
          high: q.high?.[i] as number | undefined,
          low: q.low?.[i] as number | undefined,
          volume: q.volume?.[i] as number | undefined,
        }))
        .filter((p) => p.price != null) as any;
    } catch {
      return [];
    }
  }

  private async fetchCoinGeckoHistory(
    coingeckoId: string,
    range: string,
  ): Promise<Array<{ date: string; price: number }>> {
    const daysMap: Record<string, number> = { '5d': 5, '1mo': 30, '3mo': 90, '1y': 365 };
    const days = daysMap[range] ?? 30;

    try {
      const url = `https://api.coingecko.com/api/v3/coins/${coingeckoId}/market_chart?vs_currency=usd&days=${days}`;
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return [];

      const data = (await res.json()) as { prices?: [number, number][] };
      const prices = data?.prices ?? [];

      // CoinGecko returns one point per hour for short ranges; downsample to daily
      const daily = new Map<string, number>();
      for (const [ts, price] of prices) {
        const date = new Date(ts).toISOString().split('T')[0];
        daily.set(date, price); // last price of the day wins
      }

      return Array.from(daily.entries()).map(([date, price]) => ({ date, price }));
    } catch {
      return [];
    }
  }

  async refreshCurrencyRates(): Promise<void> {
    // Fetch EUR/USD and ILS/USD from ECB or any free source
    // For now: mock rates
    const rates = [
      { from: Currency.USD, to: Currency.EUR, rate: 0.92 },
      { from: Currency.USD, to: Currency.ILS, rate: 3.72 },
      { from: Currency.EUR, to: Currency.USD, rate: 1.087 },
      { from: Currency.ILS, to: Currency.USD, rate: 0.269 },
    ];

    for (const r of rates) {
      await this.prisma.currencyRate.upsert({
        where: { fromCurrency_toCurrency: { fromCurrency: r.from, toCurrency: r.to } },
        update: { rate: r.rate, fetchedAt: new Date() },
        create: { fromCurrency: r.from, toCurrency: r.to, rate: r.rate },
      });
    }
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private async fetchWithFallback(
    symbol: string,
    assetClass: string,
    extra: Record<string, string>,
  ): Promise<QuoteResult> {
    const eligible = this.providers.filter((p) => p.supports(symbol, assetClass));

    for (const provider of eligible) {
      try {
        return await provider.fetchQuote(symbol, extra);
      } catch (err) {
        this.logger.warn(
          `Provider ${provider.providerSlug} failed for ${symbol}: ${(err as Error).message}`,
        );
      }
    }

    throw new Error(`All providers failed for symbol ${symbol}`);
  }

  private async persistQuote(assetId: string, quote: QuoteResult): Promise<void> {
    const provider = quote.provider;
    // Coerce null → undefined so Prisma skips the field instead of overwriting with null
    const safe = <T>(v: T | null | undefined): T | undefined => v ?? undefined;
    await this.prisma.quote.upsert({
      where: { assetId_provider: { assetId, provider } },
      update: {
        price: quote.price,
        priceChange: safe(quote.priceChange),
        changePercent: safe(quote.changePercent),
        high24h: safe(quote.high24h),
        low24h: safe(quote.low24h),
        volume24h: safe(quote.volume24h),
        marketCap: safe(quote.marketCap),
        fetchedAt: quote.fetchedAt,
      },
      create: {
        assetId,
        provider,
        price: quote.price,
        priceChange: safe(quote.priceChange),
        changePercent: safe(quote.changePercent),
        high24h: safe(quote.high24h),
        low24h: safe(quote.low24h),
        volume24h: safe(quote.volume24h),
        marketCap: safe(quote.marketCap),
        currency: Currency.USD,
        fetchedAt: quote.fetchedAt,
      },
    });
  }
}
