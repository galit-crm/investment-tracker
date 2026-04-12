import { Module } from '@nestjs/common';
import { HoldingsCalculatorService } from './holdings-calculator.service';
import { HoldingsController } from './holdings.controller';

@Module({
  providers: [HoldingsCalculatorService],
  controllers: [HoldingsController],
  exports: [HoldingsCalculatorService],
})
export class HoldingsModule {}
