/**
 * Import Service – handles CSV transaction imports.
 *
 * Flow:
 *   1. POST /import/csv/preview  → parse CSV, return rows + validation errors
 *   2. POST /import/csv/execute  → commit validated rows to DB
 *
 * Expected CSV columns (case-insensitive):
 *   date, symbol, type, quantity, price, fee, currency, notes
 */

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as Papa from 'papaparse';
import { TransactionSource, TransactionType, Currency } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { HoldingsCalculatorService } from '../holdings/holdings-calculator.service';

interface CsvRow {
  date: string;
  symbol: string;
  type: string;
  quantity: string;
  price: string;
  fee?: string;
  currency?: string;
  notes?: string;
}

export interface PreviewRow {
  rowIndex: number;
  date: string;
  symbol: string;
  type: string;
  quantity: number;
  pricePerUnit: number;
  fee: number;
  currency: string;
  notes?: string;
  errors: string[];
  valid: boolean;
}

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: HoldingsCalculatorService,
  ) {}

  async previewCsv(fileBuffer: Buffer): Promise<{ rows: PreviewRow[]; summary: object }> {
    const csv = fileBuffer.toString('utf8');
    const { data, errors: parseErrors } = Papa.parse<CsvRow>(csv, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
    });

    if (parseErrors.length) {
      throw new BadRequestException(`CSV parse error: ${parseErrors[0]?.message}`);
    }

    const rows: PreviewRow[] = data.map((row, i) => this.validateRow(row, i + 2));

    const validCount = rows.filter((r) => r.valid).length;

    return {
      rows,
      summary: {
        total: rows.length,
        valid: validCount,
        invalid: rows.length - validCount,
      },
    };
  }

  async executeCsv(
    userId: string,
    portfolioId: string,
    rows: PreviewRow[],
  ): Promise<{ imported: number; skipped: number }> {
    // Verify portfolio ownership
    const portfolio = await this.prisma.portfolio.findFirst({
      where: { id: portfolioId, userId },
    });
    if (!portfolio) throw new BadRequestException('Portfolio not found or access denied');

    const validRows = rows.filter((r) => r.valid);
    const affectedAssets = new Set<string>();

    let imported = 0;
    let skipped = 0;

    for (const row of validRows) {
      let asset = await this.prisma.asset.findFirst({
        where: { symbol: row.symbol },
      });

      if (!asset) {
        asset = await this.prisma.asset.create({
          data: {
            symbol: row.symbol,
            name: row.symbol,
            assetClass: 'OTHER',
            currency: (row.currency as Currency) ?? Currency.USD,
          },
        });
      }

      const type = this.mapTransactionType(row.type);
      if (!type) {
        skipped++;
        continue;
      }

      await this.prisma.transaction.create({
        data: {
          portfolioId,
          assetId: asset.id,
          type,
          quantity: row.quantity,
          pricePerUnit: row.pricePerUnit,
          totalAmount: row.quantity * row.pricePerUnit,
          fee: row.fee,
          currency: (row.currency as Currency) ?? Currency.USD,
          notes: row.notes,
          source: TransactionSource.IMPORTED_CSV,
          executedAt: new Date(row.date),
        },
      });

      affectedAssets.add(asset.id);
      imported++;
    }

    // Recalculate all affected holdings
    for (const assetId of affectedAssets) {
      await this.calculator.recalculateHolding(portfolioId, assetId);
    }

    return { imported, skipped };
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private validateRow(row: CsvRow, rowIndex: number): PreviewRow {
    const errors: string[] = [];

    if (!row.date) errors.push('Missing date');
    if (!row.symbol) errors.push('Missing symbol');
    if (!row.type) errors.push('Missing type');

    const quantity = parseFloat(row.quantity);
    if (isNaN(quantity) || quantity <= 0) errors.push('Invalid quantity');

    const pricePerUnit = parseFloat(row.price);
    if (isNaN(pricePerUnit) || pricePerUnit < 0) errors.push('Invalid price');

    const fee = parseFloat(row.fee ?? '0');

    const validTypes = Object.values(TransactionType) as string[];
    if (row.type && !validTypes.includes(row.type.toUpperCase())) {
      errors.push(`Unknown type: ${row.type}. Valid: ${validTypes.join(', ')}`);
    }

    if (row.date && isNaN(Date.parse(row.date))) errors.push('Invalid date format');

    return {
      rowIndex,
      date: row.date,
      symbol: row.symbol?.toUpperCase(),
      type: row.type?.toUpperCase(),
      quantity: isNaN(quantity) ? 0 : quantity,
      pricePerUnit: isNaN(pricePerUnit) ? 0 : pricePerUnit,
      fee: isNaN(fee) ? 0 : fee,
      currency: (row.currency ?? 'USD').toUpperCase(),
      notes: row.notes,
      errors,
      valid: errors.length === 0,
    };
  }

  private mapTransactionType(type: string): TransactionType | null {
    const map: Record<string, TransactionType> = {
      BUY: TransactionType.BUY,
      SELL: TransactionType.SELL,
      DEPOSIT: TransactionType.DEPOSIT,
      WITHDRAWAL: TransactionType.WITHDRAWAL,
      FEE: TransactionType.FEE,
      DIVIDEND: TransactionType.DIVIDEND,
      TRANSFER_IN: TransactionType.TRANSFER_IN,
      TRANSFER_OUT: TransactionType.TRANSFER_OUT,
      AIRDROP: TransactionType.AIRDROP,
      REWARD: TransactionType.REWARD,
      INTEREST: TransactionType.INTEREST,
      SPLIT: TransactionType.SPLIT,
    };
    return map[type?.toUpperCase()] ?? null;
  }
}
