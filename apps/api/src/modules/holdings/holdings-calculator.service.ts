/**
 * Holdings Calculator Service
 *
 * Implements cost-basis accounting using the FIFO (First-In, First-Out) method.
 *
 * Key terms:
 *   - Average Buy Price:   Total cost of current position ÷ total quantity held
 *   - Total Cost:          Sum of (qty × price + fee) for all BUY-like transactions,
 *                          minus cost-basis removed by SELL transactions
 *   - Unrealized P&L:     (Current Market Price - Avg Buy Price) × Quantity Held
 *   - Realized P&L:       Sum of (sell price - cost basis price) × qty sold,
 *                          minus fees on those sells
 *   - Net Invested:        Cash actually deployed (buys) minus cash returned (sells)
 *   - Total Return:        (Unrealized P&L + Realized P&L) ÷ Total Cost × 100
 */

import { Injectable, Logger } from '@nestjs/common';
import { TransactionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

interface CostLot {
  quantity: number;
  pricePerUnit: number;
  fee: number;
}

export interface HoldingCalculation {
  quantity: number;
  averageBuyPrice: number;
  totalCost: number;
  realizedPnl: number;
}

export interface HoldingWithPnl {
  holdingId: string;
  assetId: string;
  symbol: string;
  name: string;
  assetClass: string;
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
  totalReturn: number | null;  // %
  dayChange: number | null;
  dayChangePercent: number | null;
  lastUpdatedAt: string | null;  // ISO string for JSON serialization
  dataSource: string | null;
}

@Injectable()
export class HoldingsCalculatorService {
  private readonly logger = new Logger(HoldingsCalculatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recalculates and persists a holding from all transactions.
   * Called after every create/delete transaction operation.
   */
  async recalculateHolding(portfolioId: string, assetId: string): Promise<void> {
    const calc = await this.calculateFromTransactions(portfolioId, assetId);

    if (calc.quantity <= 0) {
      // Position fully closed – remove holding
      await this.prisma.holding.deleteMany({ where: { portfolioId, assetId } });
      return;
    }

    await this.prisma.holding.upsert({
      where: { portfolioId_assetId: { portfolioId, assetId } },
      update: {
        quantity: calc.quantity,
        averageBuyPrice: calc.averageBuyPrice,
        totalCost: calc.totalCost,
        realizedPnl: calc.realizedPnl,
        lastCalculatedAt: new Date(),
      },
      create: {
        portfolioId,
        assetId,
        quantity: calc.quantity,
        averageBuyPrice: calc.averageBuyPrice,
        totalCost: calc.totalCost,
        realizedPnl: calc.realizedPnl,
      },
    });
  }

  /**
   * Returns all holdings for a portfolio enriched with live P&L data.
   */
  async getPortfolioHoldingsWithPnl(portfolioId: string): Promise<HoldingWithPnl[]> {
    const holdings = await this.prisma.holding.findMany({
      where: { portfolioId },
      include: {
        asset: {
          include: {
            quotes: { orderBy: { fetchedAt: 'desc' }, take: 1 },
          },
        },
      },
    });

    return holdings.map((h) => this.enrichWithPnl(h));
  }

  /**
   * Returns a single holding enriched with P&L.
   */
  async getHoldingWithPnl(holdingId: string, userId: string): Promise<HoldingWithPnl | null> {
    const holding = await this.prisma.holding.findFirst({
      where: { id: holdingId, portfolio: { userId } },
      include: {
        asset: { include: { quotes: { orderBy: { fetchedAt: 'desc' }, take: 1 } } },
      },
    });

    if (!holding) return null;
    return this.enrichWithPnl(holding);
  }

  // ─── Core Calculation ───────────────────────────────────────────────────────

  private async calculateFromTransactions(
    portfolioId: string,
    assetId: string,
  ): Promise<HoldingCalculation> {
    const transactions = await this.prisma.transaction.findMany({
      where: { portfolioId, assetId },
      orderBy: { executedAt: 'asc' },
    });

    // FIFO lots queue
    const lots: CostLot[] = [];
    let realizedPnl = 0;

    for (const tx of transactions) {
      const qty = Number(tx.quantity ?? 0);
      const price = Number(tx.pricePerUnit ?? 0);
      const fee = Number(tx.fee ?? 0);

      switch (tx.type) {
        case TransactionType.BUY:
        case TransactionType.AIRDROP:
        case TransactionType.REWARD:
        case TransactionType.TRANSFER_IN:
          // Add lot to queue; fee increases cost basis
          lots.push({ quantity: qty, pricePerUnit: price, fee });
          break;

        case TransactionType.SELL:
        case TransactionType.TRANSFER_OUT: {
          // Remove FIFO lots and calculate realized P&L
          let remaining = qty;
          while (remaining > 0 && lots.length > 0) {
            const lot = lots[0];
            const consumed = Math.min(remaining, lot.quantity);
            const costBasisPerUnit = lot.pricePerUnit + lot.fee / lot.quantity;
            const saleProceeds = price * consumed;
            const saleCost = costBasisPerUnit * consumed;
            const saleFeeShare = (consumed / qty) * fee;

            realizedPnl += saleProceeds - saleCost - saleFeeShare;

            lot.quantity -= consumed;
            remaining -= consumed;

            if (lot.quantity <= 1e-12) lots.shift();
          }
          break;
        }

        default:
          break;
      }
    }

    // Remaining open lots = current position
    const quantity = lots.reduce((sum, lot) => sum + lot.quantity, 0);

    if (quantity <= 0) {
      return { quantity: 0, averageBuyPrice: 0, totalCost: 0, realizedPnl };
    }

    // Total cost = sum of (unit price × qty + fee) for remaining lots
    const totalCost = lots.reduce(
      (sum, lot) => sum + lot.quantity * lot.pricePerUnit + lot.fee,
      0,
    );

    const averageBuyPrice = totalCost / quantity;

    return { quantity, averageBuyPrice, totalCost, realizedPnl };
  }

  // ─── Enrich with live price ─────────────────────────────────────────────────

  private enrichWithPnl(holding: any): HoldingWithPnl {
    const quote = holding.asset.quotes?.[0] ?? null;
    const quantity = Number(holding.quantity);
    const averageBuyPrice = Number(holding.averageBuyPrice);
    const totalCost = Number(holding.totalCost);
    const realizedPnl = Number(holding.realizedPnl);

    let currentPrice: number | null = null;
    let currentValue: number | null = null;
    let unrealizedPnl: number | null = null;
    let unrealizedPnlPercent: number | null = null;
    let totalPnl: number | null = null;
    let totalReturn: number | null = null;
    let dayChange: number | null = null;
    let dayChangePercent: number | null = null;

    if (quote) {
      currentPrice = Number(quote.price);
      currentValue = currentPrice * quantity;
      unrealizedPnl = currentValue - totalCost;
      unrealizedPnlPercent =
        totalCost > 0 ? (unrealizedPnl / totalCost) * 100 : 0;
      totalPnl = unrealizedPnl + realizedPnl;
      totalReturn = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
      dayChange = quote.priceChange ? Number(quote.priceChange) * quantity : null;
      dayChangePercent = quote.changePercent ? Number(quote.changePercent) : null;
    }

    return {
      holdingId: holding.id,
      assetId: holding.assetId,
      symbol: holding.asset.symbol,
      name: holding.asset.name,
      assetClass: holding.asset.assetClass,
      exchange: holding.asset.exchange,
      quantity,
      averageBuyPrice,
      totalCost,
      currentPrice,
      currentValue,
      unrealizedPnl,
      unrealizedPnlPercent,
      realizedPnl,
      totalPnl,
      totalReturn,
      dayChange,
      dayChangePercent,
      lastUpdatedAt: quote?.fetchedAt?.toISOString() ?? null,
      dataSource: quote?.provider ?? null,
    };
  }
}
