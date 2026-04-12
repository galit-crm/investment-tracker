import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PortfoliosService } from './portfolios.service';

@Controller('portfolios')
@UseGuards(JwtAuthGuard)
export class PortfoliosController {
  constructor(private readonly portfoliosService: PortfoliosService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.portfoliosService.findAll(user.sub);
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.portfoliosService.findOne(user.sub, id);
  }

  @Get(':id/summary')
  getSummary(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.portfoliosService.getSummary(user.sub, id);
  }

  @Get(':id/snapshots')
  getSnapshots(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.portfoliosService.getSnapshots(user.sub, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: JwtPayload, @Body() body: { name: string; description?: string; currency?: string }) {
    return this.portfoliosService.create(user.sub, body);
  }

  @Patch(':id')
  update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() body: { name?: string; description?: string }) {
    return this.portfoliosService.update(user.sub, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.portfoliosService.delete(user.sub, id);
  }
}
