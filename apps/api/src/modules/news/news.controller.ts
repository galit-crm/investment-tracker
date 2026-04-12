import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { NewsService } from './news.service';
import { QueryNewsDto } from './dto/query-news.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get()
  async getFeed(@Query() query: QueryNewsDto) {
    return this.newsService.getFeed(query);
  }

  @Get('featured')
  async getFeatured() {
    return this.newsService.getFeatured();
  }

  @Get('dashboard')
  async getDashboard() {
    return this.newsService.getDashboardSummary();
  }

  @Get('asset/:symbol')
  async getAssetNews(@Param('symbol') symbol: string) {
    return this.newsService.getAssetNews(symbol);
  }
}
