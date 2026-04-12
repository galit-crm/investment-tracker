import { AssetClass, Currency } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAssetDto {
  @IsString()
  @MaxLength(20)
  symbol!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsEnum(AssetClass)
  assetClass!: AssetClass;

  @IsOptional()
  @IsString()
  exchange?: string;

  @IsEnum(Currency)
  currency!: Currency;

  @IsOptional()
  @IsString()
  coingeckoId?: string;

  @IsOptional()
  @IsString()
  yahooSymbol?: string;

  @IsOptional()
  @IsString()
  isin?: string;
}

export class SearchAssetDto {
  @IsString()
  q!: string;
}
