import { Module } from '@nestjs/common';
import { NewsSkill } from './news.skill';
import { MarketSkill } from './market.skill';
import { MacroSkill } from './macro.skill';
import { SentimentSkill } from './sentiment.skill';
import { TechnicalSkill } from './technical.skill';
import { FundamentalsSkill } from './fundamentals.skill';
import { SkillsService } from './skills.service';
import { MarketDataModule } from '../market-data/market-data.module';

@Module({
  imports: [MarketDataModule],
  providers: [
    NewsSkill,
    MarketSkill,
    MacroSkill,
    SentimentSkill,
    TechnicalSkill,
    FundamentalsSkill,
    SkillsService,
  ],
  exports: [
    SkillsService,
    NewsSkill,
    MarketSkill,
    MacroSkill,
    SentimentSkill,
    TechnicalSkill,
    FundamentalsSkill,
  ],
})
export class SkillsModule {}
