/**
 * Unit tests for HoldingsCalculatorService.
 * Tests FIFO cost-basis calculation, P&L enrichment.
 *
 * Run: pnpm --filter api test
 */

import { Test, TestingModule } from '@nestjs/testing';
import { HoldingsCalculatorService } from '../holdings-calculator.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { TransactionType, TransactionSource, Currency } from '@prisma/client';

// ─── Prisma mock ──────────────────────────────────────────────────────────────

const mockTx = (overrides: Partial<{
  type: TransactionType;
  quantity: number;
  pricePerUnit: number;
  fee: number;
  executedAt: Date;
}>) => ({
  id: Math.random().toString(),
  portfolioId: 'p1',
  assetId: 'a1',
  brokerAccountId: null,
  type: TransactionType.BUY,
  quantity: overrides.quantity ?? 10,
  pricePerUnit: overrides.pricePerUnit ?? 100,
  fee: overrides.fee ?? 0,
  totalAmount: (overrides.quantity ?? 10) * (overrides.pricePerUnit ?? 100),
  currency: Currency.USD,
  notes: null,
  source: TransactionSource.MANUAL,
  externalId: null,
  executedAt: overrides.executedAt ?? new Date('2024-01-01'),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createPrismaMock = (transactions: ReturnType<typeof mockTx>[]) => ({
  transaction: {
    findMany: jest.fn().mockResolvedValue(transactions),
  },
  holding: {
    upsert: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue(null),
  },
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('HoldingsCalculatorService – FIFO calculations', () => {
  let service: HoldingsCalculatorService;
  let prismaMock: ReturnType<typeof createPrismaMock>;

  const createService = async (txs: ReturnType<typeof mockTx>[]) => {
    prismaMock = createPrismaMock(txs);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HoldingsCalculatorService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get<HoldingsCalculatorService>(HoldingsCalculatorService);
  };

  // ─── recalculateHolding ───────────────────────────────────────────────────

  describe('recalculateHolding', () => {
    it('calculates correct qty, avg price and total cost for a single BUY', async () => {
      await createService([mockTx({ type: TransactionType.BUY, quantity: 10, pricePerUnit: 150, fee: 0 })]);

      await service.recalculateHolding('p1', 'a1');

      expect(prismaMock.holding.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            quantity: 10,
            averageBuyPrice: 150,
            totalCost: 1500,
            realizedPnl: 0,
          }),
        }),
      );
    });

    it('calculates correct avg price across two BUYs at different prices', async () => {
      await createService([
        mockTx({ type: TransactionType.BUY, quantity: 10, pricePerUnit: 100, fee: 0 }),
        mockTx({ type: TransactionType.BUY, quantity: 10, pricePerUnit: 200, fee: 0 }),
      ]);

      await service.recalculateHolding('p1', 'a1');

      expect(prismaMock.holding.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            quantity: 20,
            averageBuyPrice: 150,  // (10×100 + 10×200) / 20
            totalCost: 3000,
          }),
        }),
      );
    });

    it('calculates realized P&L correctly for a SELL after two BUYs (FIFO)', async () => {
      // BUY 10 @ 100, then BUY 10 @ 200, then SELL 10 @ 300
      // FIFO: sells the first 10 @ cost 100, proceeds 300 → realized = (300-100)*10 = 2000
      await createService([
        mockTx({ type: TransactionType.BUY, quantity: 10, pricePerUnit: 100, fee: 0, executedAt: new Date('2024-01-01') }),
        mockTx({ type: TransactionType.BUY, quantity: 10, pricePerUnit: 200, fee: 0, executedAt: new Date('2024-01-02') }),
        mockTx({ type: TransactionType.SELL, quantity: 10, pricePerUnit: 300, fee: 0, executedAt: new Date('2024-01-03') }),
      ]);

      await service.recalculateHolding('p1', 'a1');

      const call = (prismaMock.holding.upsert as jest.Mock).mock.calls[0][0];
      expect(call.update.quantity).toBe(10);
      expect(call.update.realizedPnl).toBeCloseTo(2000, 2);
      // Remaining lot: 10 shares @ 200 each = totalCost 2000
      expect(call.update.totalCost).toBeCloseTo(2000, 2);
      expect(call.update.averageBuyPrice).toBeCloseTo(200, 2);
    });

    it('deletes holding when fully sold', async () => {
      await createService([
        mockTx({ type: TransactionType.BUY, quantity: 5, pricePerUnit: 100, fee: 0 }),
        mockTx({ type: TransactionType.SELL, quantity: 5, pricePerUnit: 200, fee: 0 }),
      ]);

      await service.recalculateHolding('p1', 'a1');

      expect(prismaMock.holding.deleteMany).toHaveBeenCalledWith({ where: { portfolioId: 'p1', assetId: 'a1' } });
      expect(prismaMock.holding.upsert).not.toHaveBeenCalled();
    });

    it('includes fee in cost basis', async () => {
      // BUY 10 @ 100 with $10 fee → cost per unit = (100 + 10/10) = 101, total cost = 1010
      await createService([
        mockTx({ type: TransactionType.BUY, quantity: 10, pricePerUnit: 100, fee: 10 }),
      ]);

      await service.recalculateHolding('p1', 'a1');

      const call = (prismaMock.holding.upsert as jest.Mock).mock.calls[0][0];
      expect(call.update.totalCost).toBeCloseTo(1010, 2);
      expect(call.update.averageBuyPrice).toBeCloseTo(101, 2);
    });

    it('handles AIRDROP as cost-basis-zero acquisition', async () => {
      await createService([
        mockTx({ type: TransactionType.AIRDROP, quantity: 5, pricePerUnit: 0, fee: 0 }),
      ]);

      await service.recalculateHolding('p1', 'a1');

      const call = (prismaMock.holding.upsert as jest.Mock).mock.calls[0][0];
      expect(call.update.quantity).toBe(5);
      expect(call.update.totalCost).toBe(0);
    });

    it('handles REWARD and TRANSFER_IN the same as BUY (add to position)', async () => {
      await createService([
        mockTx({ type: TransactionType.REWARD,      quantity: 3, pricePerUnit: 50, fee: 0 }),
        mockTx({ type: TransactionType.TRANSFER_IN, quantity: 2, pricePerUnit: 60, fee: 0 }),
      ]);

      await service.recalculateHolding('p1', 'a1');

      const call = (prismaMock.holding.upsert as jest.Mock).mock.calls[0][0];
      expect(call.update.quantity).toBe(5);
      // totalCost = 3*50 + 2*60 = 150 + 120 = 270
      expect(call.update.totalCost).toBeCloseTo(270, 2);
    });

    it('handles partial sell that spans two lots (FIFO)', async () => {
      // BUY 5 @ 100, BUY 5 @ 200, SELL 8 @ 300
      // FIFO: sell all 5 from lot1 (cost 100ea) + 3 from lot2 (cost 200ea)
      // realized = (300-100)*5 + (300-200)*3 = 1000 + 300 = 1300
      // remaining: 2 shares from lot2 @ 200 each → totalCost = 400
      await createService([
        mockTx({ type: TransactionType.BUY,  quantity: 5, pricePerUnit: 100, fee: 0, executedAt: new Date('2024-01-01') }),
        mockTx({ type: TransactionType.BUY,  quantity: 5, pricePerUnit: 200, fee: 0, executedAt: new Date('2024-01-02') }),
        mockTx({ type: TransactionType.SELL, quantity: 8, pricePerUnit: 300, fee: 0, executedAt: new Date('2024-01-03') }),
      ]);

      await service.recalculateHolding('p1', 'a1');

      const call = (prismaMock.holding.upsert as jest.Mock).mock.calls[0][0];
      expect(call.update.quantity).toBeCloseTo(2, 5);
      expect(call.update.realizedPnl).toBeCloseTo(1300, 2);
      expect(call.update.totalCost).toBeCloseTo(400, 2);
      expect(call.update.averageBuyPrice).toBeCloseTo(200, 2);
    });

    it('sell fee reduces realized P&L proportionally', async () => {
      // BUY 10 @ 100 (no fee), SELL 10 @ 200 with $20 fee
      // realized = (200-100)*10 - 20 = 980
      await createService([
        mockTx({ type: TransactionType.BUY,  quantity: 10, pricePerUnit: 100, fee: 0,  executedAt: new Date('2024-01-01') }),
        mockTx({ type: TransactionType.SELL, quantity: 10, pricePerUnit: 200, fee: 20, executedAt: new Date('2024-01-02') }),
      ]);

      await service.recalculateHolding('p1', 'a1');

      // Position is fully closed → deleteMany called
      expect(prismaMock.holding.deleteMany).toHaveBeenCalled();
      expect(prismaMock.holding.upsert).not.toHaveBeenCalled();
    });

    it('handles oversell gracefully — closes position without crash', async () => {
      // BUY 5, SELL 10 (more than owned). Should not throw.
      await createService([
        mockTx({ type: TransactionType.BUY,  quantity: 5,  pricePerUnit: 100, fee: 0, executedAt: new Date('2024-01-01') }),
        mockTx({ type: TransactionType.SELL, quantity: 10, pricePerUnit: 200, fee: 0, executedAt: new Date('2024-01-02') }),
      ]);

      await expect(service.recalculateHolding('p1', 'a1')).resolves.not.toThrow();
      // Position should be treated as closed (qty ≤ 0)
      expect(prismaMock.holding.deleteMany).toHaveBeenCalled();
    });

    it('buy fee is included in cost basis and reduces realized P&L on sell', async () => {
      // BUY 10 @ 100 with $10 fee → cost basis = 1010 (101/share)
      // SELL 10 @ 150 with $0 fee → realized = 1500 - 1010 = 490
      await createService([
        mockTx({ type: TransactionType.BUY,  quantity: 10, pricePerUnit: 100, fee: 10, executedAt: new Date('2024-01-01') }),
        mockTx({ type: TransactionType.SELL, quantity: 10, pricePerUnit: 150, fee: 0,  executedAt: new Date('2024-01-02') }),
      ]);

      await service.recalculateHolding('p1', 'a1');

      // Position closed
      expect(prismaMock.holding.deleteMany).toHaveBeenCalled();
    });
  });

  // ─── enrichWithPnl ────────────────────────────────────────────────────────

  describe('enrichWithPnl (via getPortfolioHoldingsWithPnl)', () => {
    const holdingRecord = {
      id: 'h1',
      portfolioId: 'p1',
      assetId: 'a1',
      quantity: '10',       // Prisma returns Decimal as string in mocks
      averageBuyPrice: '100',
      totalCost: '1000',
      realizedPnl: '200',
      brokerAccountId: null,
      lastCalculatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      asset: {
        id: 'a1',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        assetClass: 'STOCK',
        exchange: 'NASDAQ',
        quotes: [{ price: '150', priceChange: '2', changePercent: '1.5', fetchedAt: new Date('2024-03-01'), provider: 'mock' }],
      },
    };

    it('computes unrealized P&L correctly', async () => {
      prismaMock = createPrismaMock([]);
      prismaMock.holding.findMany = jest.fn().mockResolvedValue([holdingRecord]);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          HoldingsCalculatorService,
          { provide: PrismaService, useValue: prismaMock },
        ],
      }).compile();

      service = module.get<HoldingsCalculatorService>(HoldingsCalculatorService);
      const results = await service.getPortfolioHoldingsWithPnl('p1');

      expect(results).toHaveLength(1);
      const h = results[0];
      expect(h.currentPrice).toBe(150);
      expect(h.currentValue).toBe(1500);         // 10 × 150
      expect(h.unrealizedPnl).toBe(500);         // 1500 - 1000
      expect(h.unrealizedPnlPercent).toBeCloseTo(50, 1);  // 500/1000 * 100
      expect(h.realizedPnl).toBe(200);
      expect(h.totalPnl).toBe(700);              // 500 + 200
      expect(h.totalReturn).toBeCloseTo(70, 1);  // 700/1000 * 100
    });

    it('returns null P&L fields when no quote available', async () => {
      const noQuoteHolding = { ...holdingRecord, asset: { ...holdingRecord.asset, quotes: [] } };
      prismaMock = createPrismaMock([]);
      prismaMock.holding.findMany = jest.fn().mockResolvedValue([noQuoteHolding]);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          HoldingsCalculatorService,
          { provide: PrismaService, useValue: prismaMock },
        ],
      }).compile();

      service = module.get<HoldingsCalculatorService>(HoldingsCalculatorService);
      const results = await service.getPortfolioHoldingsWithPnl('p1');

      expect(results[0].currentPrice).toBeNull();
      expect(results[0].unrealizedPnl).toBeNull();
      expect(results[0].totalPnl).toBeNull();
    });

    it('returns lastUpdatedAt as ISO string', async () => {
      prismaMock = createPrismaMock([]);
      prismaMock.holding.findMany = jest.fn().mockResolvedValue([holdingRecord]);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          HoldingsCalculatorService,
          { provide: PrismaService, useValue: prismaMock },
        ],
      }).compile();

      service = module.get<HoldingsCalculatorService>(HoldingsCalculatorService);
      const results = await service.getPortfolioHoldingsWithPnl('p1');

      expect(typeof results[0].lastUpdatedAt).toBe('string');
      expect(() => new Date(results[0].lastUpdatedAt!)).not.toThrow();
    });

    it('dayChange is null when priceChange is null on quote', async () => {
      const noChangeHolding = {
        ...holdingRecord,
        asset: {
          ...holdingRecord.asset,
          quotes: [{ price: '150', priceChange: null, changePercent: null, fetchedAt: new Date(), provider: 'mock' }],
        },
      };
      prismaMock = createPrismaMock([]);
      prismaMock.holding.findMany = jest.fn().mockResolvedValue([noChangeHolding]);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          HoldingsCalculatorService,
          { provide: PrismaService, useValue: prismaMock },
        ],
      }).compile();

      service = module.get<HoldingsCalculatorService>(HoldingsCalculatorService);
      const results = await service.getPortfolioHoldingsWithPnl('p1');

      expect(results[0].dayChange).toBeNull();
      expect(results[0].dayChangePercent).toBeNull();
      // currentPrice should still be valid
      expect(results[0].currentPrice).toBe(150);
    });

    it('totalReturn is zero when totalCost is zero (AIRDROP position)', async () => {
      const airdropHolding = {
        ...holdingRecord,
        totalCost: '0',
        averageBuyPrice: '0',
        realizedPnl: '0',
      };
      prismaMock = createPrismaMock([]);
      prismaMock.holding.findMany = jest.fn().mockResolvedValue([airdropHolding]);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          HoldingsCalculatorService,
          { provide: PrismaService, useValue: prismaMock },
        ],
      }).compile();

      service = module.get<HoldingsCalculatorService>(HoldingsCalculatorService);
      const results = await service.getPortfolioHoldingsWithPnl('p1');

      // Should not divide by zero
      expect(results[0].totalReturn).toBe(0);
      expect(results[0].unrealizedPnlPercent).toBe(0);
    });
  });
});
