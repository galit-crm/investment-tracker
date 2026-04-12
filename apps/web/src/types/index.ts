export type AssetClass = 'STOCK' | 'CRYPTO' | 'ETF' | 'COMMODITY' | 'BOND' | 'REAL_ESTATE' | 'FOREX' | 'INDEX' | 'OTHER';
export type Currency = 'USD' | 'EUR' | 'ILS' | 'GBP' | 'BTC' | 'ETH';
export type TransactionType = 'BUY' | 'SELL' | 'DEPOSIT' | 'WITHDRAWAL' | 'FEE' | 'DIVIDEND' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'AIRDROP' | 'REWARD' | 'INTEREST' | 'SPLIT';

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  exchange: string | null;
  currency: Currency;
  logoUrl: string | null;
}

export interface HoldingWithPnl {
  holdingId: string;
  assetId: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  exchange: string | null;
  quantity: number;
  averageBuyPrice: number;
  totalCost: number;
  currentPrice: number | null;
  currentValue: number | null;
  unrealizedPnl: number | null;
  unrealizedPnlPercent: number | null;
  realizedPnl: number;
  totalPnl: number | null;
  totalReturn: number | null;
  dayChange: number | null;
  dayChangePercent: number | null;
  lastUpdatedAt: string | null;
  dataSource: string | null;
}

export interface PortfolioSummary {
  portfolioId: string;
  totalCost: number;
  totalValue: number;
  totalUnrealizedPnl: number;
  totalUnrealizedPnlPercent: number;
  totalRealizedPnl: number;
  totalPnl: number;
  dayChange: number;
  holdingsCount: number;
  allocation: Array<{ label: string; assetClass: string; value: number; percent: number }>;
}

export interface Transaction {
  id: string;
  portfolioId: string;
  assetId: string | null;
  type: TransactionType;
  quantity: number | null;
  pricePerUnit: number | null;
  totalAmount: number;
  fee: number;
  currency: Currency;
  notes: string | null;
  executedAt: string;
  asset?: { id: string; symbol: string; name: string; assetClass: AssetClass } | null;
}

export interface Portfolio {
  id: string;
  name: string;
  description: string | null;
  currency: Currency;
  isDefault: boolean;
  createdAt: string;
  _count: { holdings: number; transactions: number };
}

export interface AnalyticsSummary {
  totalCost: number;
  totalValue: number;
  totalUnrealizedPnl: number;
  totalUnrealizedPnlPercent: number;
  totalRealizedPnl: number;
  totalPnl: number;
  totalPnlPercent: number;
  dayChange: number;
  holdingsCount: number;
}
