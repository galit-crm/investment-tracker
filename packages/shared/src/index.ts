// Shared constants and types between api and web

export const ASSET_CLASSES = ['STOCK', 'CRYPTO', 'ETF', 'COMMODITY', 'BOND', 'REAL_ESTATE', 'FOREX', 'INDEX', 'OTHER'] as const;
export const CURRENCIES = ['USD', 'EUR', 'ILS', 'GBP'] as const;
export const TRANSACTION_TYPES = ['BUY', 'SELL', 'DEPOSIT', 'WITHDRAWAL', 'FEE', 'DIVIDEND', 'TRANSFER_IN', 'TRANSFER_OUT', 'AIRDROP', 'REWARD', 'INTEREST', 'SPLIT'] as const;
export const BROKER_SLUGS = ['binance', 'mock_broker'] as const;
