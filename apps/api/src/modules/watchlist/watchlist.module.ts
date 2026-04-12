import { Module } from '@nestjs/common';
import { WatchlistService } from './watchlist.service';
import { WatchlistController } from './watchlist.controller';

@Module({
  providers: [WatchlistService],
  controllers: [WatchlistController],
})
export class WatchlistModule {}
