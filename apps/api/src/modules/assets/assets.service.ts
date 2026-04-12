import { Injectable, NotFoundException } from '@nestjs/common';
import { AssetClass } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAssetDto } from './dto/create-asset.dto';

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(assetClass?: AssetClass) {
    return this.prisma.asset.findMany({
      where: { isActive: true, ...(assetClass ? { assetClass } : {}) },
      include: {
        quotes: { orderBy: { fetchedAt: 'desc' }, take: 1 },
      },
      orderBy: { symbol: 'asc' },
    });
  }

  async search(q: string) {
    return this.prisma.asset.findMany({
      where: {
        isActive: true,
        OR: [
          { symbol: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: { quotes: { take: 1, orderBy: { fetchedAt: 'desc' } } },
      take: 20,
    });
  }

  async findOne(id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: {
        quotes: { orderBy: { fetchedAt: 'desc' }, take: 5 },
      },
    });

    if (!asset) throw new NotFoundException('Asset not found');
    return asset;
  }

  async create(dto: CreateAssetDto) {
    return this.prisma.asset.create({ data: dto });
  }

  async update(id: string, dto: Partial<CreateAssetDto>) {
    return this.prisma.asset.update({ where: { id }, data: dto });
  }
}
