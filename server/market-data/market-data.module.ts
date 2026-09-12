import { Module } from '@nestjs/common';
import { MarketDataService } from './market-data.service';
import { McpClientService } from './mcp-client.service';
import { MarketDataController } from './market-data.controller';

@Module({
  controllers: [MarketDataController],
  providers: [MarketDataService, McpClientService],
  exports: [MarketDataService, McpClientService],
})
export class MarketDataModule {}