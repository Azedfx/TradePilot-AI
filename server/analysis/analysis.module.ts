import { Module } from '@nestjs/common';
import { ThesisService } from './thesis.service';
import { HistoricalService } from './historical.service';
import { StressTestService } from './stress-test.service';
import { SimilarScenariosService } from './similar-scenarios.service';
import { MarketDataModule } from '../market-data/market-data.module';

@Module({
  imports: [MarketDataModule],
  providers: [
    ThesisService,
    HistoricalService,
    StressTestService,
    SimilarScenariosService,
  ],
  exports: [
    ThesisService,
    HistoricalService,
    StressTestService,
    SimilarScenariosService,
  ],
})
export class AnalysisModule {}
