import { Controller, Get, Param } from '@nestjs/common';
import { MarketDataService } from './market-data.service';

@Controller('market')
export class MarketDataController {
  constructor(private readonly marketData: MarketDataService) {}

  @Get(':symbol')
  snapshot(@Param('symbol') symbol: string) {
    return this.marketData.getMarketSnapshot(symbol);
  }
}