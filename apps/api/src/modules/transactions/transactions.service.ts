import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TransactionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { HoldingsCalculatorService } from '../holdings/holdings-calculator.service';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: HoldingsCalculatorService,
  ) {}

  async findAll(userId: string, portfolioId?: string, assetId?: string, page = 1, limit = 100) {
    // Security: only portfolios owned by this user
    const portfolioFilter = await this.getUserPortfolioFilter(userId, portfolioId);
    const skip = (page - 1) * Math.min(limit, 500);
    const take = Math.min(limit, 500);

    const [data, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { portfolioId: { in: portfolioFilter }, ...(assetId ? { assetId } : {}) },
        include: {
          asset: { select: { id: true, symbol: true, name: true, assetClass: true } },
          portfolio: { select: { id: true, name: true } },
          brokerAccount: { select: { id: true, name: true } },
        },
        orderBy: { executedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.transaction.count({
        where: { portfolioId: { in: portfolioFilter }, ...(assetId ? { assetId } : {}) },
      }),
    ]);

    return { data, total, page, limit: take, totalPages: Math.ceil(total / take) };
  }

  async findOne(userId: string, id: string) {
    const tx = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        asset: true,
        portfolio: { select: { id: true, userId: true, name: true } },
        brokerAccount: true,
      },
    });

    if (!tx) throw new NotFoundException('Transaction not found');
    if (tx.portfolio.userId !== userId) throw new ForbiddenException();

    return tx;
  }

  async create(userId: string, dto: CreateTransactionDto) {
    // Verify portfolio ownership
    await this.assertPortfolioOwner(userId, dto.portfolioId);

    const tx = await this.prisma.transaction.create({
      data: {
        portfolioId: dto.portfolioId,
        assetId: dto.assetId,
        brokerAccountId: dto.brokerAccountId,
        type: dto.type,
        quantity: dto.quantity,
        pricePerUnit: dto.pricePerUnit,
        totalAmount: dto.totalAmount,
        fee: dto.fee ?? 0,
        currency: dto.currency,
        notes: dto.notes,
        source: dto.source,
        externalId: dto.externalId,
        executedAt: new Date(dto.executedAt),
      },
      include: { asset: true },
    });

    // Recalculate holding after transaction
    if (dto.assetId && this.isPositionTransaction(dto.type)) {
      await this.calculator.recalculateHolding(dto.portfolioId, dto.assetId);
    }

    return tx;
  }

  async delete(userId: string, id: string) {
    const tx = await this.findOne(userId, id);

    await this.prisma.transaction.delete({ where: { id } });

    // Recalculate after deletion
    if (tx.assetId) {
      await this.calculator.recalculateHolding(tx.portfolioId, tx.assetId);
    }
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private isPositionTransaction(type: TransactionType): boolean {
    return ([
      TransactionType.BUY,
      TransactionType.SELL,
      TransactionType.AIRDROP,
      TransactionType.REWARD,
      TransactionType.DIVIDEND,
      TransactionType.TRANSFER_IN,
      TransactionType.TRANSFER_OUT,
    ] as TransactionType[]).includes(type);
  }

  private async getUserPortfolioFilter(userId: string, portfolioId?: string): Promise<string[]> {
    const portfolios = await this.prisma.portfolio.findMany({
      where: { userId, ...(portfolioId ? { id: portfolioId } : {}) },
      select: { id: true },
    });
    return portfolios.map((p) => p.id);
  }

  private async assertPortfolioOwner(userId: string, portfolioId: string) {
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
      select: { userId: true },
    });
    if (!portfolio) throw new NotFoundException('Portfolio not found');
    if (portfolio.userId !== userId) throw new ForbiddenException();
  }
}
