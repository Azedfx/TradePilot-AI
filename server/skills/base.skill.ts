import { Injectable } from '@nestjs/common';
import { ResearchContext, SkillResult } from './skill.types';

export interface ResearchSkill {
  readonly name: string;
  run(context: ResearchContext): Promise<SkillResult>;
}

@Injectable()
export abstract class BaseSkill implements ResearchSkill {
  abstract readonly name: string;

  abstract run(context: ResearchContext): Promise<SkillResult>;

  protected buildResult(
    skill: ResearchContext['symbols'] extends never ? never : SkillResult['skill'],
    summary: string,
    data: unknown,
  ): SkillResult {
    return {
      skill,
      summary,
      data,
      fetchedAt: new Date().toISOString(),
    };
  }
}
