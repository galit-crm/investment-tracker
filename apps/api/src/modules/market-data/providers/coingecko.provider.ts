/**
 * CoinGecko provider – crypto prices.
 * Free tier: 30 calls/min. Pro tier supported via API key.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MarketDataProvider, QuoteResult } from '../interfaces/market-data-provider.interface';

@Injectable()
export class CoinGeckoProvider implements MarketDataProvider {
  private readonly logger = new Logger(CoinGeckoProvider.name);
  readonly providerSlug = 'coingecko';

  private readonly baseUrl = 'https://api.coingecko.com/api/v3';

  constructor(private readonly config: ConfigService) {}

  supports(_symbol: string, assetClass: string): boolean {
    return assetClass === 'CRYPTO';
  }

  async fetchQuote(symbol: string, extra?: Record<string, string>): Promise<QuoteResult> {
    const coingeckoId = extra?.['coingeckoId'] ?? symbol.toLowerCase();
    const apiKey = this.config.get<string>('marketData.coingeckoKey');
    const headers: Record<string, string> = apiKey
      ? { 'x-cg-pro-api-key': apiKey }
      : {};

    const url = `${this.baseUrl}/simple/price?ids=${coingeckoId}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`;

    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`CoinGecko request failed: ${res.statusText}`);

    const data = (await res.json()) as Record<string, Record<string, number>>;
    const coin = data[coingeckoId];
    if (!coin) throw new Error(`No data for ${coingeckoId}`);

    return {
      symbol,
      provider: this.providerSlug,
      price: coin['usd'],
      changePercent: coin['usd_24h_change'],
      volume24h: coin['usd_24h_vol'],
      marketCap: coin['usd_market_cap'],
      currency: 'USD',
      fetchedAt: new Date(),
    };
  }

  async fetchQuotes(symbols: Array<{ symbol: string; extra?: Record<string, string> }>): Promise<QuoteResult[]> {
    const ids = symbols.map(s => s.extra?.['coingeckoId'] ?? s.symbol.toLowerCase()).join(',');
    const apiKey = this.config.get<string>('marketData.coingeckoKey');
    const headers: Record<string, string> = apiKey ? { 'x-cg-pro-api-key': apiKey } : {};

    const url = `${this.baseUrl}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`;

    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`CoinGecko batch request failed: ${res.statusText}`);

    const data = (await res.json()) as Record<string, Record<string, number>>;

    return symbols.flatMap((s) => {
      const id = s.extra?.['coingeckoId'] ?? s.symbol.toLowerCase();
      const coin = data[id];
      if (!coin || !coin['usd']) {
        this.logger.warn(`CoinGecko returned no price for ${s.symbol} (id: ${id}) — skipping`);
        return [];
      }
      return [{
        symbol: s.symbol,
        provider: this.providerSlug,
        price: coin['usd'],
        changePercent: coin['usd_24h_change'],
        volume24h: coin['usd_24h_vol'],
        marketCap: coin['usd_market_cap'],
        currency: 'USD',
        fetchedAt: new Date(),
      }];
    });
  }
}
