import { Module } from '@nestjs/common';
import { MarketDataService } from './market-data.service';
import { McpClientService } from './mcp-client.service';
import { UsStockMcpClientService } from './us-stock-mcp.service';
import { MarketDataController } from './market-data.controller';

@Module({
  controllers: [MarketDataController],
  providers: [MarketDataService, McpClientService, UsStockMcpClientService],
  exports: [MarketDataService, McpClientService, UsStockMcpClientService],
})
export class MarketDataModule {}
