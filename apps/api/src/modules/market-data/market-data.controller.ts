import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MarketDataService } from './market-data.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

@Controller('market-data')
@UseGuards(JwtAuthGuard)
export class MarketDataController {
  constructor(
    private readonly marketData: MarketDataService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('quote/:assetId')
  async getQuote(@Param('assetId') assetId: string) {
    const quote = await this.marketData.getQuote(assetId);
    if (!quote) throw new NotFoundException('No quote available');
    return quote;
  }

  @Post('refresh/:assetId')
  async refreshQuote(@Param('assetId') assetId: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
      select: { id: true, symbol: true, assetClass: true, coingeckoId: true, yahooSymbol: true },
    });
    if (!asset) throw new NotFoundException('Asset not found');
    return this.marketData.refreshAssetQuote(asset);
  }

  @Post('refresh-all')
  async refreshAll() {
    await this.marketData.refreshAllQuotes();
    return { message: 'Refresh complete', refreshedAt: new Date().toISOString() };
  }

  @Get('history/:assetId')
  getHistory(
    @Param('assetId') assetId: string,
    @Query('range') range?: '5d' | '1mo' | '3mo' | '1y',
  ) {
    return this.marketData.fetchHistory(assetId, range ?? '1mo');
  }

  @Get('rates')
  getRates() {
    return this.prisma.currencyRate.findMany();
  }
}
