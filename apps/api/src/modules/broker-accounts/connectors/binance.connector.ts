/**
 * Binance connector – crypto exchange integration.
 *
 * Uses Binance REST API v3.
 * Required credentials: { apiKey, apiSecret }
 *
 * Note: HMAC-SHA256 signing implemented for authenticated endpoints.
 */

import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  BalanceResult,
  ExchangeConnector,
  ImportedTransaction,
} from './exchange-connector.interface';

@Injectable()
export class BinanceConnector implements ExchangeConnector {
  readonly brokerSlug = 'binance';
  private readonly logger = new Logger(BinanceConnector.name);
  private readonly baseUrl = 'https://api.binance.com';

  async validateCredentials(credentials: Record<string, string>): Promise<void> {
    const { apiKey, apiSecret } = credentials;
    if (!apiKey || !apiSecret) throw new Error('API key and secret required');

    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = this.sign(queryString, apiSecret);

    const res = await fetch(
      `${this.baseUrl}/api/v3/account?${queryString}&signature=${signature}`,
      { headers: { 'X-MBX-APIKEY': apiKey } },
    );

    if (!res.ok) throw new Error(`Invalid Binance credentials: ${res.statusText}`);
  }

  async fetchBalances(credentials: Record<string, string>): Promise<BalanceResult[]> {
    const { apiKey, apiSecret } = credentials;
    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = this.sign(queryString, apiSecret);

    const res = await fetch(
      `${this.baseUrl}/api/v3/account?${queryString}&signature=${signature}`,
      { headers: { 'X-MBX-APIKEY': apiKey } },
    );

    if (!res.ok) throw new Error(`Binance fetchBalances failed: ${res.statusText}`);

    const data = (await res.json()) as { balances: Array<{ asset: string; free: string; locked: string }> };

    return data.balances
      .map((b) => ({
        symbol: b.asset,
        quantity: parseFloat(b.free) + parseFloat(b.locked),
        currency: 'USD',
      }))
      .filter((b) => b.quantity > 0);
  }

  async fetchTransactions(
    credentials: Record<string, string>,
    _since?: Date,
  ): Promise<ImportedTransaction[]> {
    // In production: iterate over all trading pairs and fetch trade history
    // For now: returns empty to avoid excessive API calls
    this.logger.log('Binance fetchTransactions called – pagination required per symbol');
    return [];
  }

  private sign(queryString: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(queryString).digest('hex');
  }
}
