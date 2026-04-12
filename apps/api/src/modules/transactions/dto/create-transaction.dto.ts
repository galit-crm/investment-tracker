import { TransactionType, TransactionSource, Currency } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export class CreateTransactionDto {
  @IsString()
  portfolioId!: string;

  @IsOptional()
  @IsString()
  assetId?: string;

  @IsOptional()
  @IsString()
  brokerAccountId?: string;

  @IsEnum(TransactionType)
  type!: TransactionType;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  quantity?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  pricePerUnit?: number;

  @IsNumber()
  @Min(0)
  totalAmount!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fee?: number;

  @IsEnum(Currency)
  currency!: Currency;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsEnum(TransactionSource)
  source!: TransactionSource;

  @IsOptional()
  @IsString()
  externalId?: string;

  @IsDateString()
  executedAt!: string;
}
