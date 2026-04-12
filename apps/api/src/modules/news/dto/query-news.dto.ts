import { IsOptional, IsIn, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryNewsDto {
  @IsOptional()
  @IsIn(['FED_CENTRAL_BANKS', 'INFLATION_MACRO', 'EARNINGS', 'GEOPOLITICS', 'CRYPTO', 'MARKET_NEWS', 'REGULATORY'])
  category?: string;

  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH'])
  impact?: string;

  @IsOptional()
  market?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}
