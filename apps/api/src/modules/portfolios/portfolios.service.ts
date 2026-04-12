import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { HoldingsCalculatorService } from '../holdings/holdings-calculator.service';

@Injectable()
export class PortfoliosService {
  private readonly logger = new Logger(PortfoliosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: HoldingsCalculatorService,
  ) {}

  async findAll(userId: string) {
    return this.prisma.portfolio.findMany({
      where: { userId },
      include: {
        _count: { select: { holdings: true, transactions: true } },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async findOne(userId: string, id: string) {
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id },
      include: { _count: { select: { holdings: true, transactions: true } } },
    });

    if (!portfolio) throw new NotFoundException('Portfolio not found');
    if (portfolio.userId !== userId) throw new ForbiddenException();

    return portfolio;
  }

  async getSummary(userId: string, portfolioId: string) {
    await this.findOne(userId, portfolioId); // validates ownership

    const holdings = await this.calculator.getPortfolioHoldingsWithPnl(portfolioId);

    const totalCost = holdings.reduce((s, h) => s + h.totalCost, 0);
    const totalValue = holdings.reduce((s, h) => s + (h.currentValue ?? h.totalCost), 0);
    const totalUnrealizedPnl = holdings.reduce((s, h) => s + (h.unrealizedPnl ?? 0), 0);
    const totalRealizedPnl = holdings.reduce((s, h) => s + h.realizedPnl, 0);
    const dayChange = holdings.reduce((s, h) => s + (h.dayChange ?? 0), 0);

    // Allocation by asset class
    const allocationMap: Record<string, number> = {};
    for (const h of holdings) {
      const val = h.currentValue ?? h.totalCost;
      allocationMap[h.assetClass] = (allocationMap[h.assetClass] ?? 0) + val;
    }

    return {
      portfolioId,
      totalCost,
      totalValue,
      totalUnrealizedPnl,
      totalUnrealizedPnlPercent: totalCost > 0 ? (totalUnrealizedPnl / totalCost) * 100 : 0,
      totalRealizedPnl,
      totalPnl: totalUnrealizedPnl + totalRealizedPnl,
      dayChange,
      holdingsCount: holdings.length,
      allocation: Object.entries(allocationMap).map(([assetClass, value]) => ({
        label: assetClass,
        assetClass,
        value,
        percent: totalValue > 0 ? (value / totalValue) * 100 : 0,
      })),
    };
  }

  async create(userId: string, data: { name: string; description?: string; currency?: string }) {
    return this.prisma.portfolio.create({
      data: {
        userId,
        name: data.name,
        description: data.description,
        currency: (data.currency as any) ?? 'USD',
      },
    });
  }

  async update(userId: string, id: string, data: { name?: string; description?: string }) {
    await this.findOne(userId, id);
    return this.prisma.portfolio.update({ where: { id }, data });
  }

  async delete(userId: string, id: string) {
    const portfolio = await this.findOne(userId, id);
    if (portfolio.isDefault) throw new ForbiddenException('Cannot delete default portfolio');
    await this.prisma.portfolio.delete({ where: { id } });
  }

  async getSnapshots(userId: string, portfolioId: string) {
    await this.findOne(userId, portfolioId);
    return this.prisma.portfolioSnapshot.findMany({
      where: { portfolioId },
      orderBy: { snapshotDate: 'asc' },
    });
  }

  /**
   * Create or update today's snapshot for a portfolio.
   * Called manually after transactions, or by the daily cron job.
   */
  async upsertTodaySnapshot(portfolioId: string): Promise<void> {
    try {
      const portfolio = await this.prisma.portfolio.findUnique({
        where: { id: portfolioId },
        select: { currency: true },
      });
      if (!portfolio) return;

      const holdings = await this.calculator.getPortfolioHoldingsWithPnl(portfolioId);

      const totalValue = holdings.reduce((s, h) => s + (h.currentValue ?? h.totalCost), 0);
      const totalCost = holdings.reduce((s, h) => s + h.totalCost, 0);
      const totalUnrealizedPnl = holdings.reduce((s, h) => s + (h.unrealizedPnl ?? 0), 0);
      const totalRealizedPnl = holdings.reduce((s, h) => s + h.realizedPnl, 0);
      const totalPnl = totalUnrealizedPnl + totalRealizedPnl;

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      await this.prisma.portfolioSnapshot.upsert({
        where: { portfolioId_snapshotDate: { portfolioId, snapshotDate: today } },
        update: { totalValue, totalCost, totalPnl },
        create: { portfolioId, snapshotDate: today, totalValue, totalCost, totalPnl, currency: portfolio.currency },
      });
    } catch (err) {
      // Log but don't throw — snapshot failure must not break the caller
      this.logger.warn(`Failed to upsert snapshot for portfolio ${portfolioId}: ${(err as Error).message}`);
    }
  }

  /** Cron: create daily snapshots for all portfolios at midnight UTC */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async snapshotAllPortfolios(): Promise<void> {
    this.logger.log('Daily snapshot job started');

    const portfolios = await this.prisma.portfolio.findMany({
      select: { id: true },
    });

    let ok = 0;
    let failed = 0;

    for (const p of portfolios) {
      try {
        await this.upsertTodaySnapshot(p.id);
        ok++;
      } catch {
        failed++;
      }
    }

    this.logger.log(`Daily snapshot done: ${ok} ok, ${failed} failed`);
  }
}
