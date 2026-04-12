import { IsEnum, IsOptional, IsString, MaxLength, IsBoolean, IsInt, Min, Max } from 'class-validator';
import { Currency } from '@prisma/client';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;
}

export class UpdateSettingsDto {
  @IsOptional()
  @IsEnum(Currency)
  baseCurrency?: Currency;

  @IsOptional()
  @IsString()
  displayTimezone?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  autoRefreshMin?: number;

  @IsOptional()
  @IsBoolean()
  showSmallHoldings?: boolean;
}
