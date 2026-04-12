import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { configuration } from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PortfoliosModule } from './modules/portfolios/portfolios.module';
import { AssetsModule } from './modules/assets/assets.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { HoldingsModule } from './modules/holdings/holdings.module';
import { MarketDataModule } from './modules/market-data/market-data.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { BrokerAccountsModule } from './modules/broker-accounts/broker-accounts.module';
import { ImportModule } from './modules/import/import.module';
import { HealthModule } from './health/health.module';
import { WatchlistModule } from './modules/watchlist/watchlist.module';
import { NewsModule } from './modules/news/news.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    PortfoliosModule,
    AssetsModule,
    TransactionsModule,
    HoldingsModule,
    MarketDataModule,
    AnalyticsModule,
    BrokerAccountsModule,
    ImportModule,
    HealthModule,
    WatchlistModule,
    NewsModule,
  ],
})
export class AppModule {}
