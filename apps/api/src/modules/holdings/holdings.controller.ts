import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { HoldingsCalculatorService } from './holdings-calculator.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

@Controller()
@UseGuards(JwtAuthGuard)
export class HoldingsController {
  constructor(
    private readonly calculator: HoldingsCalculatorService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('portfolios/:portfolioId/holdings')
  async getPortfolioHoldings(
    @CurrentUser() user: JwtPayload,
    @Param('portfolioId') portfolioId: string,
  ) {
    await this.assertPortfolioOwner(user.sub, portfolioId);
    return this.calculator.getPortfolioHoldingsWithPnl(portfolioId);
  }

  @Get('holdings/:id')
  async getHolding(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const holding = await this.calculator.getHoldingWithPnl(id, user.sub);
    if (!holding) throw new NotFoundException('Holding not found');
    return holding;
  }

  private async assertPortfolioOwner(userId: string, portfolioId: string) {
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
      select: { userId: true },
    });
    if (!portfolio) throw new NotFoundException('Portfolio not found');
    if (portfolio.userId !== userId) throw new ForbiddenException();
  }
}
