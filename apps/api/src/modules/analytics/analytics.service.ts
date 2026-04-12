import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { HoldingsCalculatorService, HoldingWithPnl } from '../holdings/holdings-calculator.service';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: HoldingsCalculatorService,
  ) {}

  async getSummary(userId: string) {
    const portfolios = await this.prisma.portfolio.findMany({
      where: { userId },
      select: { id: true },
    });

    const allHoldings: HoldingWithPnl[] = [];
    for (const p of portfolios) {
      const holdings = await this.calculator.getPortfolioHoldingsWithPnl(p.id);
      allHoldings.push(...holdings);
    }

    const totalCost = allHoldings.reduce((s, h) => s + h.totalCost, 0);
    const totalValue = allHoldings.reduce((s, h) => s + (h.currentValue ?? h.totalCost), 0);
    const totalUnrealizedPnl = allHoldings.reduce((s, h) => s + (h.unrealizedPnl ?? 0), 0);
    const totalRealizedPnl = allHoldings.reduce((s, h) => s + h.realizedPnl, 0);
    const dayChange = allHoldings.reduce((s, h) => s + (h.dayChange ?? 0), 0);

    return {
      totalCost,
      totalValue,
      totalUnrealizedPnl,
      totalUnrealizedPnlPercent: totalCost > 0 ? (totalUnrealizedPnl / totalCost) * 100 : 0,
      totalRealizedPnl,
      totalPnl: totalUnrealizedPnl + totalRealizedPnl,
      totalPnlPercent: totalCost > 0 ? ((totalUnrealizedPnl + totalRealizedPnl) / totalCost) * 100 : 0,
      dayChange,
      holdingsCount: allHoldings.length,
    };
  }

  async getRankings(userId: string) {
    const portfolios = await this.prisma.portfolio.findMany({
      where: { userId },
      select: { id: true },
    });

    const allHoldings: HoldingWithPnl[] = [];
    for (const p of portfolios) {
      const holdings = await this.calculator.getPortfolioHoldingsWithPnl(p.id);
      allHoldings.push(...holdings);
    }

    const sorted = {
      byReturnPercent: [...allHoldings].sort(
        (a, b) => (b.totalReturn ?? 0) - (a.totalReturn ?? 0),
      ),
      byPnlAbsolute: [...allHoldings].sort(
        (a, b) => (b.totalPnl ?? 0) - (a.totalPnl ?? 0),
      ),
      byCurrentValue: [...allHoldings].sort(
        (a, b) => (b.currentValue ?? 0) - (a.currentValue ?? 0),
      ),
      byDayChange: [...allHoldings].sort(
        (a, b) => (b.dayChangePercent ?? 0) - (a.dayChangePercent ?? 0),
      ),
    };

    return {
      topWinners: sorted.byReturnPercent.slice(0, 5),
      topLosers: sorted.byReturnPercent.slice(-5).reverse(),
      largestPositions: sorted.byCurrentValue.slice(0, 5),
      bestDay: sorted.byDayChange.slice(0, 5),
      worstDay: sorted.byDayChange.slice(-5).reverse(),
      biggestGains: sorted.byPnlAbsolute.slice(0, 5),
      biggestLosses: sorted.byPnlAbsolute.slice(-5).reverse(),
    };
  }

  async getReconciliation(userId: string) {
    const portfolios = await this.prisma.portfolio.findMany({
      where: { userId },
      select: { id: true },
    });
    const portfolioIds = portfolios.map((p) => p.id);

    const staleThreshold = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours

    const [holdingsCount, transactionsCount, assetsWithoutQuotes, staleQuotes] = await Promise.all([
      this.prisma.holding.count({ where: { portfolioId: { in: portfolioIds } } }),
      this.prisma.transaction.count({ where: { portfolioId: { in: portfolioIds } } }),
      // Assets held but with zero quotes on record
      this.prisma.asset.findMany({
        where: {
          holdings: { some: { portfolioId: { in: portfolioIds } } },
          quotes: { none: {} },
        },
        select: { id: true, symbol: true, name: true, assetClass: true },
      }),
      // Assets held with a quote, but it hasn't been refreshed in >2h
      this.prisma.asset.findMany({
        where: {
          holdings: { some: { portfolioId: { in: portfolioIds } } },
          quotes: { some: { fetchedAt: { lt: staleThreshold } } },
          // Exclude assets that also have a fresh quote
          NOT: { quotes: { some: { fetchedAt: { gte: staleThreshold } } } },
        },
        select: {
          id: true,
          symbol: true,
          name: true,
          assetClass: true,
          quotes: { orderBy: { fetchedAt: 'desc' }, take: 1, select: { fetchedAt: true } },
        },
      }),
    ]);

    return {
      holdingsCount,
      transactionsCount,
      assetsWithoutQuotes,
      staleQuotes: staleQuotes.map((a) => ({
        id: a.id,
        symbol: a.symbol,
        name: a.name,
        assetClass: a.assetClass,
        lastQuoteAt: a.quotes[0]?.fetchedAt?.toISOString() ?? null,
      })),
      checkedAt: new Date().toISOString(),
    };
  }

  async getAllocation(userId: string) {
    const portfolios = await this.prisma.portfolio.findMany({
      where: { userId },
      select: { id: true, name: true },
    });

    const allHoldings: HoldingWithPnl[] = [];
    for (const p of portfolios) {
      const holdings = await this.calculator.getPortfolioHoldingsWithPnl(p.id);
      allHoldings.push(...holdings);
    }

    const totalValue = allHoldings.reduce((s, h) => s + (h.currentValue ?? h.totalCost), 0);

    // By asset class
    const byClass: Record<string, number> = {};
    for (const h of allHoldings) {
      byClass[h.assetClass] = (byClass[h.assetClass] ?? 0) + (h.currentValue ?? h.totalCost);
    }

    // By exchange
    const byExchange: Record<string, number> = {};
    for (const h of allHoldings) {
      const key = h.exchange ?? 'Unknown';
      byExchange[key] = (byExchange[key] ?? 0) + (h.currentValue ?? h.totalCost);
    }

    const toPercent = (map: Record<string, number>) =>
      Object.entries(map).map(([key, value]) => ({
        label: key,
        value,
        percent: totalValue > 0 ? (value / totalValue) * 100 : 0,
      }));

    return {
      totalValue,
      byAssetClass: toPercent(byClass),
      byExchange: toPercent(byExchange),
      realizedPnl: allHoldings.reduce((s, h) => s + h.realizedPnl, 0),
      unrealizedPnl: allHoldings.reduce((s, h) => s + (h.unrealizedPnl ?? 0), 0),
    };
  }
}
