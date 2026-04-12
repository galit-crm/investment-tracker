import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { BrokerAccountsService } from './broker-accounts.service';

@Controller('broker-accounts')
@UseGuards(JwtAuthGuard)
export class BrokerAccountsController {
  constructor(private readonly brokerAccountsService: BrokerAccountsService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.brokerAccountsService.findAll(user.sub);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: JwtPayload,
    @Body() body: { name: string; brokerSlug: string; brokerType: string; credentials?: Record<string, string> },
  ) {
    return this.brokerAccountsService.create(user.sub, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.brokerAccountsService.delete(user.sub, id);
  }

  @Post(':id/sync')
  sync(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.brokerAccountsService.sync(user.sub, id);
  }

  @Get(':id/sync-jobs')
  getSyncJobs(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.brokerAccountsService.getSyncJobs(user.sub, id);
  }
}
