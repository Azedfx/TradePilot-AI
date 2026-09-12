export type SkillCategory =
  | 'news'
  | 'market'
  | 'macro'
  | 'sentiment'
  | 'technical';

export interface SkillResult {
  skill: SkillCategory;
  summary: string;
  data: unknown;
  fetchedAt: string;
  error?: string;
}

export interface ResearchContext {
  symbols: string[];
  timeframe: string;
  language?: string;
  assetType?: 'crypto' | 'us-stock';
  depth?: 'quick' | 'standard' | 'deep';
}
