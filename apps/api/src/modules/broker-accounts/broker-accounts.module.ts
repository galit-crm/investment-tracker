import { Module } from '@nestjs/common';
import { BrokerAccountsService } from './broker-accounts.service';
import { BrokerAccountsController } from './broker-accounts.controller';
import { BinanceConnector } from './connectors/binance.connector';
import { MockBrokerConnector } from './connectors/mock-broker.connector';
import { HoldingsModule } from '../holdings/holdings.module';

@Module({
  imports: [HoldingsModule],
  providers: [BrokerAccountsService, BinanceConnector, MockBrokerConnector],
  controllers: [BrokerAccountsController],
})
export class BrokerAccountsModule {}
