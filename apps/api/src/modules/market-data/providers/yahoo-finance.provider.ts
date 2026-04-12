/**
 * Yahoo Finance provider – stocks, ETFs, commodities, forex, bonds.
 * Uses the free Yahoo Finance v7 quote API (no key required).
 * Falls back gracefully if the API is unavailable.
 */

import { Injectable, Logger } from '@nestjs/common';
import { MarketDataProvider, QuoteResult } from '../interfaces/market-data-provider.interface';

const SUPPORTED_CLASSES = new Set(['STOCK', 'ETF', 'COMMODITY', 'BOND', 'FOREX']);

@Injectable()
export class YahooFinanceProvider implements MarketDataProvider {
  private readonly logger = new Logger(YahooFinanceProvider.name);
  readonly providerSlug = 'yahoo';

  private readonly baseUrl = 'https://query1.finance.yahoo.com/v7/finance/quote';

  supports(_symbol: string, assetClass: string): boolean {
    return SUPPORTED_CLASSES.has(assetClass);
  }

  async fetchQuote(symbol: string, extra?: Record<string, string>): Promise<QuoteResult> {
    const yahooSymbol = extra?.['yahooSymbol'] ?? symbol;

    const url = `${this.baseUrl}?symbols=${encodeURIComponent(yahooSymbol)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; investment-tracker/1.0)',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      throw new Error(`Yahoo Finance request failed: ${res.status} ${res.statusText}`);
    }

    const body = (await res.json()) as {
      quoteResponse?: {
        result?: Array<Record<string, number | string>>;
        error?: unknown;
      };
    };

    const result = body?.quoteResponse?.result?.[0];
    if (!result) {
      throw new Error(`No data returned from Yahoo Finance for symbol ${yahooSymbol}`);
    }

    const price = result['regularMarketPrice'] as number;
    if (!price) {
      throw new Error(`Yahoo Finance returned zero price for ${yahooSymbol}`);
    }

    return {
      symbol,
      provider: this.providerSlug,
      price,
      priceChange: result['regularMarketChange'] as number | undefined,
      changePercent: result['regularMarketChangePercent'] as number | undefined,
      high24h: result['regularMarketDayHigh'] as number | undefined,
      low24h: result['regularMarketDayLow'] as number | undefined,
      volume24h: result['regularMarketVolume'] as number | undefined,
      marketCap: result['marketCap'] as number | undefined,
      currency: (result['currency'] as string | undefined) ?? 'USD',
      fetchedAt: new Date(),
    };
  }

  async fetchQuotes(
    symbols: Array<{ symbol: string; extra?: Record<string, string> }>,
  ): Promise<QuoteResult[]> {
    const yahooSymbols = symbols
      .map((s) => s.extra?.['yahooSymbol'] ?? s.symbol)
      .join(',');

    const url = `${this.baseUrl}?symbols=${encodeURIComponent(yahooSymbols)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; investment-tracker/1.0)',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      throw new Error(`Yahoo Finance batch request failed: ${res.status} ${res.statusText}`);
    }

    const body = (await res.json()) as {
      quoteResponse?: { result?: Array<Record<string, number | string>> };
    };

    const results = body?.quoteResponse?.result ?? [];

    // Map results back to original symbols by position
    return symbols.map((s, i) => {
      const r = results[i] ?? {};
      const price = (r['regularMarketPrice'] as number) ?? 0;
      return {
        symbol: s.symbol,
        provider: this.providerSlug,
        price,
        priceChange: r['regularMarketChange'] as number | undefined,
        changePercent: r['regularMarketChangePercent'] as number | undefined,
        high24h: r['regularMarketDayHigh'] as number | undefined,
        low24h: r['regularMarketDayLow'] as number | undefined,
        volume24h: r['regularMarketVolume'] as number | undefined,
        marketCap: r['marketCap'] as number | undefined,
        currency: (r['currency'] as string | undefined) ?? 'USD',
        fetchedAt: new Date(),
      };
    });
  }
}
