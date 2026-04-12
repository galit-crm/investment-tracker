import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const WATCHLIST_INCLUDE = {
  items: {
    include: {
      asset: {
        include: {
          quotes: { orderBy: { fetchedAt: 'desc' as const }, take: 1 },
        },
      },
    },
    orderBy: { addedAt: 'desc' as const },
  },
};

@Injectable()
export class WatchlistService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string) {
    const watchlist = await this.prisma.watchlist.findUnique({
      where: { userId },
      include: WATCHLIST_INCLUDE,
    });

    if (!watchlist) {
      return this.prisma.watchlist.create({
        data: { userId },
        include: WATCHLIST_INCLUDE,
      });
    }

    return watchlist;
  }

  async addItem(userId: string, assetId: string) {
    const watchlist = await this.getOrCreate(userId);
    await this.prisma.watchlistItem.upsert({
      where: { watchlistId_assetId: { watchlistId: watchlist.id, assetId } },
      update: {},
      create: { watchlistId: watchlist.id, assetId },
    });
    return this.get(userId);
  }

  async removeItem(userId: string, assetId: string) {
    const watchlist = await this.getOrCreate(userId);
    await this.prisma.watchlistItem.deleteMany({
      where: { watchlistId: watchlist.id, assetId },
    });
  }

  private async getOrCreate(userId: string) {
    return this.prisma.watchlist.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }
}
