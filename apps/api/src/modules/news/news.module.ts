import { Module } from '@nestjs/common';
import { NewsService } from './news.service';
import { NewsController } from './news.controller';
import { MockNewsProvider } from './providers/mock-news.provider';
import { CryptoCompareNewsProvider } from './providers/cryptocompare-news.provider';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [NewsService, MockNewsProvider, CryptoCompareNewsProvider],
  controllers: [NewsController],
  exports: [NewsService],
})
export class NewsModule {}
