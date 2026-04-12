import { Module } from '@nestjs/common';
import { ImportService } from './import.service';
import { ImportController } from './import.controller';
import { HoldingsModule } from '../holdings/holdings.module';

@Module({
  imports: [HoldingsModule],
  providers: [ImportService],
  controllers: [ImportController],
})
export class ImportModule {}
