import { Module } from '@nestjs/common';
import { ResearchController } from './research.controller';
import { ResearchService } from './research.service';
import { ResearchOrchestrator } from './research.orchestrator';
import { SkillsModule } from '../skills/skills.module';
import { AnalysisModule } from '../analysis/analysis.module';
import { ReportsModule } from '../reports/reports.module';
import { MarketDataModule } from '../market-data/market-data.module';
import { ReviewModule } from '../review/review.module';

@Module({
  imports: [
    SkillsModule,
    AnalysisModule,
    ReportsModule,
    MarketDataModule,
    ReviewModule,
  ],
  controllers: [ResearchController],
  providers: [ResearchService, ResearchOrchestrator],
})
export class ResearchModule {}
