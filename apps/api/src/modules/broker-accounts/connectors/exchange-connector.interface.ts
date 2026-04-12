/**
 * ExchangeConnector – interface for all broker/exchange integrations.
 *
 * To add a new broker (e.g., Interactive Brokers, eToro):
 *   1. Create a class implementing this interface
 *   2. Register it in BrokerAccountsModule
 *   3. Map its slug in BrokerAccountsService.getConnector()
 */

export interface BalanceResult {
  symbol: string;
  quantity: number;
  currency: string;
}

export interface ImportedTransaction {
  externalId: string;
  type: string;             // 'BUY' | 'SELL' | etc.
  symbol: string;
  quantity?: number;
  pricePerUnit?: number;
  totalAmount: number;
  fee?: number;
  currency: string;
  executedAt: Date;
  notes?: string;
}

export interface ExchangeConnector {
  readonly brokerSlug: string;

  /** Validate API credentials. Throws if invalid. */
  validateCredentials(credentials: Record<string, string>): Promise<void>;

  /** Fetch current balances */
  fetchBalances(credentials: Record<string, string>): Promise<BalanceResult[]>;

  /** Fetch transaction history since a given date */
  fetchTransactions(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<ImportedTransaction[]>;
}
