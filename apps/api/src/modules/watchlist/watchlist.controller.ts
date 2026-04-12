import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { WatchlistService } from './watchlist.service';

@Controller('watchlist')
@UseGuards(JwtAuthGuard)
export class WatchlistController {
  constructor(private readonly watchlistService: WatchlistService) {}

  @Get()
  get(@CurrentUser() user: JwtPayload) {
    return this.watchlistService.get(user.sub);
  }

  @Post(':assetId')
  @HttpCode(HttpStatus.OK)
  addItem(@CurrentUser() user: JwtPayload, @Param('assetId') assetId: string) {
    return this.watchlistService.addItem(user.sub, assetId);
  }

  @Delete(':assetId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeItem(@CurrentUser() user: JwtPayload, @Param('assetId') assetId: string) {
    return this.watchlistService.removeItem(user.sub, assetId);
  }
}
