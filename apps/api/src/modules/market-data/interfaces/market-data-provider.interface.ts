/**
 * MarketDataProvider – interface every data provider must implement.
 * Add new providers (Twelve Data, Alpha Vantage, etc.) by implementing this interface.
 */

export interface QuoteResult {
  symbol: string;
  /** The provider slug that produced this quote (e.g. 'coingecko', 'mock') */
  provider: string;
  price: number;
  priceChange?: number;
  changePercent?: number;
  high24h?: number;
  low24h?: number;
  volume24h?: number;
  marketCap?: number;
  currency: string;
  fetchedAt: Date;
}

export interface MarketDataProvider {
  /** Unique slug used in Quote.provider column */
  readonly providerSlug: string;

  /** Returns true if this provider can handle the given symbol */
  supports(symbol: string, assetClass: string): boolean;

  /** Fetch a single quote. Throws if fetch fails. */
  fetchQuote(symbol: string, extra?: Record<string, string>): Promise<QuoteResult>;

  /** Batch fetch quotes. Default impl calls fetchQuote in sequence. */
  fetchQuotes(symbols: Array<{ symbol: string; extra?: Record<string, string> }>): Promise<QuoteResult[]>;
}
