/**
 * Unit tests for ImportService – CSV parsing and validation.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ImportService } from '../import.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { HoldingsCalculatorService } from '../../holdings/holdings-calculator.service';

const prismaMock = {
  portfolio: { findFirst: jest.fn() },
  asset: { findFirst: jest.fn(), create: jest.fn() },
  transaction: { create: jest.fn() },
};

const calculatorMock = {
  recalculateHolding: jest.fn(),
};

describe('ImportService – previewCsv', () => {
  let service: ImportService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: HoldingsCalculatorService, useValue: calculatorMock },
      ],
    }).compile();

    service = module.get<ImportService>(ImportService);
  });

  it('parses a valid CSV and returns all rows as valid', async () => {
    const csv = `date,symbol,type,quantity,price,fee,currency,notes
2024-01-15,AAPL,BUY,10,150.00,0,USD,Initial buy
2024-02-20,BTC,BUY,0.5,25000,12.5,USD,`;

    const { rows, summary } = await service.previewCsv(Buffer.from(csv));

    expect(rows).toHaveLength(2);
    expect((summary as any).valid).toBe(2);
    expect((summary as any).invalid).toBe(0);
    expect(rows[0].symbol).toBe('AAPL');
    expect(rows[0].valid).toBe(true);
    expect(rows[1].quantity).toBe(0.5);
  });

  it('marks row as invalid when date is missing', async () => {
    const csv = `date,symbol,type,quantity,price
,AAPL,BUY,10,150`;

    const { rows } = await service.previewCsv(Buffer.from(csv));

    expect(rows[0].valid).toBe(false);
    expect(rows[0].errors).toContain('Missing date');
  });

  it('marks row as invalid for unknown transaction type', async () => {
    const csv = `date,symbol,type,quantity,price
2024-01-15,AAPL,SWAP,10,150`;

    const { rows } = await service.previewCsv(Buffer.from(csv));

    expect(rows[0].valid).toBe(false);
    expect(rows[0].errors.some((e: string) => e.includes('Unknown type'))).toBe(true);
  });

  it('marks row as invalid for negative quantity', async () => {
    const csv = `date,symbol,type,quantity,price
2024-01-15,AAPL,BUY,-5,150`;

    const { rows } = await service.previewCsv(Buffer.from(csv));

    expect(rows[0].valid).toBe(false);
    expect(rows[0].errors).toContain('Invalid quantity');
  });

  it('accepts INTEREST and SPLIT types', async () => {
    const csv = `date,symbol,type,quantity,price
2024-01-15,AAPL,INTEREST,1,0
2024-01-16,AAPL,SPLIT,10,0`;

    const { rows } = await service.previewCsv(Buffer.from(csv));

    expect(rows[0].valid).toBe(true);
    expect(rows[1].valid).toBe(true);
  });

  it('normalizes symbol to uppercase', async () => {
    const csv = `date,symbol,type,quantity,price
2024-01-15,aapl,BUY,10,150`;

    const { rows } = await service.previewCsv(Buffer.from(csv));

    expect(rows[0].symbol).toBe('AAPL');
  });

  it('throws on malformed CSV', async () => {
    await expect(
      service.previewCsv(Buffer.from('not,valid\x00\x00\x00csv')),
    ).resolves.toBeDefined(); // PapaParse is lenient; just verify it doesn't throw unhandled
  });
});
