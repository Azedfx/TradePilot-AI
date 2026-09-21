export type SkillCategory =
  | 'news'
  | 'market'
  | 'macro'
  | 'sentiment'
  | 'technical'
  | 'fundamentals';

export interface SkillResult {
  skill: SkillCategory;
  summary: string;
  data: unknown;
  fetchedAt: string;
  error?: string;
}

export interface DeskPreferences {
  /** Risk appetite shapes thesis confidence / stress sizing language. */
  riskAppetite?: 'conservative' | 'balanced' | 'aggressive';
  /** Preferred primary focus for the research plan. */
  focus?: 'earnings' | 'macro' | 'technical' | 'rToken' | 'balanced';
  /** Soft skill weights — skills listed first are emphasized in the plan. */
  emphasizeSkills?: SkillCategory[];
}

export interface ResearchContext {
  symbols: string[];
  timeframe: string;
  language?: string;
  assetType?: 'crypto' | 'us-stock';
  depth?: 'quick' | 'standard' | 'deep';
  /** Personalized desk prefs from the trader (Track 3 personalization). */
  preferences?: DeskPreferences;
  question?: string;
}
