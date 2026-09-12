import { Injectable } from '@nestjs/common';
import { NewsSkill } from './news.skill';
import { MarketSkill } from './market.skill';
import { MacroSkill } from './macro.skill';
import { SentimentSkill } from './sentiment.skill';
import { TechnicalSkill } from './technical.skill';
import { ResearchSkill } from './base.skill';
import { ResearchContext, SkillResult } from './skill.types';

/**
 * Aggregates all research skills and dispatches them for a given context.
 * Individual behaviors are delegated to the injected skill instances.
 */
@Injectable()
export class SkillsService {
  constructor(
    private readonly newsSkill: NewsSkill,
    private readonly marketSkill: MarketSkill,
    private readonly macroSkill: MacroSkill,
    private readonly sentimentSkill: SentimentSkill,
    private readonly technicalSkill: TechnicalSkill,
  ) {}

  get all(): ResearchSkill[] {
    return [
      this.newsSkill,
      this.marketSkill,
      this.macroSkill,
      this.sentimentSkill,
      this.technicalSkill,
    ];
  }

  async runAll(context: ResearchContext): Promise<SkillResult[]> {
    return Promise.all(this.all.map((skill) => skill.run(context)));
  }

  async run(
    context: ResearchContext,
    names: string[],
  ): Promise<SkillResult[]> {
    const selected = this.all.filter((skill) => names.includes(skill.name));
    return Promise.all(selected.map((skill) => skill.run(context)));
  }
}
