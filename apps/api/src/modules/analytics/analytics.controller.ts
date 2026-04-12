import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  summary(@CurrentUser() user: JwtPayload) {
    return this.analyticsService.getSummary(user.sub);
  }

  @Get('rankings')
  rankings(@CurrentUser() user: JwtPayload) {
    return this.analyticsService.getRankings(user.sub);
  }

  @Get('allocation')
  allocation(@CurrentUser() user: JwtPayload) {
    return this.analyticsService.getAllocation(user.sub);
  }

  @Get('reconciliation')
  reconciliation(@CurrentUser() user: JwtPayload) {
    return this.analyticsService.getReconciliation(user.sub);
  }
}
