import { Module } from '@nestjs/common';
import { MarketDataService } from './market-data.service';
import { MarketDataController } from './market-data.controller';
import { CoinGeckoProvider } from './providers/coingecko.provider';
import { YahooFinanceProvider } from './providers/yahoo-finance.provider';
import { MockMarketDataProvider } from './providers/mock.provider';
import { MarketDataCacheService } from './cache.service';

@Module({
  providers: [
    MarketDataService,
    MarketDataCacheService,
    CoinGeckoProvider,
    YahooFinanceProvider,
    MockMarketDataProvider,
  ],
  controllers: [MarketDataController],
  exports: [MarketDataService],
})
export class MarketDataModule {}
