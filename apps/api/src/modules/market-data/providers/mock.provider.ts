/**
 * Mock provider – returns realistic static prices with tiny random jitter.
 * Used in development when no API keys are configured.
 */

import { Injectable } from '@nestjs/common';
import { MarketDataProvider, QuoteResult } from '../interfaces/market-data-provider.interface';

const MOCK_PRICES: Record<string, number> = {
  AAPL: 189.5,
  MSFT: 415.0,
  NVDA: 875.0,
  GOOGL: 175.0,
  AMZN: 185.0,
  TSLA: 175.0,
  META: 510.0,
  SPY: 524.0,
  QQQ: 450.0,
  GLD: 222.0,
  'BTC-USD': 67000,
  'ETH-USD': 3500,
  'BNB-USD': 380,
  'SOL-USD': 145,
};

@Injectable()
export class MockMarketDataProvider implements MarketDataProvider {
  readonly providerSlug = 'mock';

  supports(_symbol: string, _assetClass: string): boolean {
    return true; // Fallback for everything
  }

  async fetchQuote(symbol: string): Promise<QuoteResult> {
    const basePrice = MOCK_PRICES[symbol] ?? 100;
    // ±0.5% random jitter to simulate live data
    const jitter = (Math.random() - 0.5) * 0.01;
    const price = basePrice * (1 + jitter);
    const changePercent = (Math.random() - 0.4) * 3; // -1.2% to +1.8% range

    return {
      symbol,
      provider: this.providerSlug,
      price: parseFloat(price.toFixed(4)),
      priceChange: parseFloat((price * changePercent / 100).toFixed(4)),
      changePercent: parseFloat(changePercent.toFixed(4)),
      high24h: parseFloat((price * 1.015).toFixed(4)),
      low24h: parseFloat((price * 0.985).toFixed(4)),
      currency: 'USD',
      fetchedAt: new Date(),
    };
  }

  async fetchQuotes(symbols: Array<{ symbol: string }>): Promise<QuoteResult[]> {
    return Promise.all(symbols.map(({ symbol }) => this.fetchQuote(symbol)));
  }
}
