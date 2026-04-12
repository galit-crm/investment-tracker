import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { MockNewsProvider } from './providers/mock-news.provider';
import { CryptoCompareNewsProvider } from './providers/cryptocompare-news.provider';
import { NewsArticleInput } from './providers/news-provider.interface';
import { QueryNewsDto } from './dto/query-news.dto';

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mockProvider: MockNewsProvider,
    private readonly cryptoCompare: CryptoCompareNewsProvider,
  ) {}

  // ─── Ingestion ──────────────────────────────────────────────────────────────

  async ingestFromProvider(articles: NewsArticleInput[]): Promise<number> {
    let upserted = 0;
    for (const article of articles) {
      try {
        await this.prisma.newsArticle.upsert({
          where: { url: article.url },
          create: {
            title: article.title,
            summary: article.summary,
            url: article.url,
            source: article.source,
            imageUrl: article.imageUrl,
            category: article.category as any,
            impactLevel: article.impactLevel as any,
            affectedMarkets: article.affectedMarkets,
            affectedAssets: article.affectedAssets,
            tags: article.tags,
            publishedAt: article.publishedAt,
          },
          update: {
            title: article.title,
            summary: article.summary,
            impactLevel: article.impactLevel as any,
            affectedMarkets: article.affectedMarkets,
            affectedAssets: article.affectedAssets,
            fetchedAt: new Date(),
          },
        });
        upserted++;
      } catch (err) {
        this.logger.warn(`Failed to upsert article "${article.title}": ${(err as Error).message}`);
      }
    }
    return upserted;
  }

  async seedFromMock(): Promise<number> {
    const articles = await this.mockProvider.fetchArticles();
    return this.ingestFromProvider(articles);
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async scheduledRefresh(): Promise<void> {
    this.logger.log('Running scheduled news refresh…');
    try {
      const articles = await this.cryptoCompare.fetchArticles();
      const count = await this.ingestFromProvider(articles);
      this.logger.log(`CryptoCompare news: ingested ${count} articles`);
    } catch (err) {
      this.logger.warn(`CryptoCompare news fetch failed, keeping existing data. Error: ${(err as Error).message}`);
    }
  }

  // ─── Queries ────────────────────────────────────────────────────────────────

  async getFeed(query: QueryNewsDto) {
    const { category, impact, market, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (category) where.category = category;
    if (impact) where.impactLevel = impact;
    if (market) where.affectedMarkets = { has: market };

    const [data, total] = await Promise.all([
      this.prisma.newsArticle.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.newsArticle.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getFeatured() {
    return this.prisma.newsArticle.findMany({
      where: { impactLevel: 'HIGH' },
      orderBy: { publishedAt: 'desc' },
      take: 6,
    });
  }

  async getDashboardSummary() {
    const [highImpact, recent] = await Promise.all([
      this.prisma.newsArticle.findMany({
        where: { impactLevel: 'HIGH' },
        orderBy: { publishedAt: 'desc' },
        take: 4,
      }),
      this.prisma.newsArticle.findMany({
        orderBy: { publishedAt: 'desc' },
        take: 5,
      }),
    ]);
    const lastFetchedAt = recent[0]?.fetchedAt?.toISOString() ?? null;
    return { highImpact, recent, lastFetchedAt };
  }

  async getAssetNews(symbol: string) {
    return this.prisma.newsArticle.findMany({
      where: { affectedAssets: { has: symbol.toUpperCase() } },
      orderBy: { publishedAt: 'desc' },
      take: 8,
    });
  }
}
