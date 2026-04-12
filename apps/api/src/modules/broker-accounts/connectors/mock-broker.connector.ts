/**
 * Mock broker connector – simulates a stock broker for development/testing.
 * Returns realistic fake data so the full sync flow can be exercised.
 */

import { Injectable } from '@nestjs/common';
import {
  BalanceResult,
  ExchangeConnector,
  ImportedTransaction,
} from './exchange-connector.interface';

@Injectable()
export class MockBrokerConnector implements ExchangeConnector {
  readonly brokerSlug = 'mock_broker';

  async validateCredentials(_credentials: Record<string, string>): Promise<void> {
    // Always valid in mock
  }

  async fetchBalances(_credentials: Record<string, string>): Promise<BalanceResult[]> {
    return [
      { symbol: 'AAPL', quantity: 15, currency: 'USD' },
      { symbol: 'MSFT', quantity: 8, currency: 'USD' },
      { symbol: 'SPY', quantity: 5, currency: 'USD' },
    ];
  }

  async fetchTransactions(
    _credentials: Record<string, string>,
    since?: Date,
  ): Promise<ImportedTransaction[]> {
    const all: ImportedTransaction[] = [
      {
        externalId: 'mock-tx-1',
        type: 'BUY',
        symbol: 'AAPL',
        quantity: 10,
        pricePerUnit: 150,
        totalAmount: 1500,
        fee: 0,
        currency: 'USD',
        executedAt: new Date('2023-01-15'),
      },
      {
        externalId: 'mock-tx-2',
        type: 'BUY',
        symbol: 'MSFT',
        quantity: 8,
        pricePerUnit: 280,
        totalAmount: 2240,
        fee: 0,
        currency: 'USD',
        executedAt: new Date('2023-02-20'),
      },
    ];

    return since ? all.filter((tx) => tx.executedAt >= since) : all;
  }
}
