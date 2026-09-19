export interface MarketSnapshot {
  symbol: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  assetType: string;
}

export type Direction = 'long' | 'short' | 'neutral';

export interface ThesisPayload {
  symbols: string[];
  direction: Direction;
  confidence: number;
  rationale: string;
  catalysts: string[];
  risks: string[];
  signals?: Record<string, unknown>;
  generatedAt: string;
}

export interface StressScenario {
  name: string;
  description?: string;
  worstCase: number;
  maxDrawdown: number;
  recoveryMonths?: number;
}

export interface StressPayload {
  symbol: string;
  name: string;
  threat?: number;
  sampleSize?: number | null;
  scenarios: StressScenario[];
  recommendation: string;
}

export type UsMarketSession =
  | 'regular'
  | 'pre-market'
  | 'after-hours'
  | 'closed-overnight'
  | 'closed-weekend';

export interface MarketWindow {
  session: UsMarketSession;
  isRegularSessionOpen: boolean;
  etClock: string;
  nextOpenDescription: string;
  /** Present (non-null) only when the market is closed — the rToken 7×24
   * transmission note. Null while the regular session is open. */
  note: string | null;
}

export interface HistoricalStats {
  symbol: string;
  interval?: string;
  period?: { start: string; end: string };
  returns?: { total?: number; annualized?: number };
  volatilityAnnualized?: number;
  maxDrawdown?: number;
  range?: { high?: number; low?: number };
  sampleSize?: number;
  statement?: string;
}

export interface FindingView {
  category: string;
  title: string;
  statement: string;
  importance?: string | null;
  sentiment?: string | null;
  data?: unknown;
}

export interface ResearchResponse {
  sessionId: string;
  status: string;
  marketData?: MarketSnapshot | null;
  marketWindow?: MarketWindow | null;
  thesis?: ThesisPayload | null;
  stressTests?: StressPayload[] | null;
}

export type ResearchStatus =
  | 'PENDING'
  | 'PLANNING'
  | 'RESEARCHING'
  | 'ANALYZING'
  | 'COMPLETED'
  | 'FAILED';

export type SkillStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface SkillRunView {
  skillName: string;
  status: SkillStatus;
  durationMs: number | null;
  error: string | null;
  summary?: string | null;
}

export interface ResearchLaunch {
  sessionId: string;
  status: ResearchStatus;
}

export interface ResearchSummary {
  sessionId: string;
  question: string;
  symbol: string | null;
  assetType: string | null;
  status: ResearchStatus;
  createdAt: string;
  direction: Direction | null;
  confidence: number | null;
}

export interface ResearchSessionResponse extends ResearchResponse {
  question: string;
  symbol: string | null;
  assetType: string | null;
  skills: SkillRunView[];
  historicalStats?: HistoricalStats[];
  historicalMatches?: unknown[];
  findings?: FindingView[];
  messages?: unknown[];
  report?: string | null;
  decision?: 'accepted' | 'rejected' | null;
}

export interface ReusableChecklistItem {
  check: string;
  why: string;
}

export interface ReviewPatternFlag {
  id: string;
  message: string;
}

export interface RecurringPattern {
  id: string;
  message: string;
  occurrences: number;
  sessionsConsidered: number;
}

export interface ReviewReport {
  sessionId: string;
  generatedAt: string;
  title: string;
  recap: string;
  badPatterns: string[];
  patterns?: ReviewPatternFlag[];
  recurring: RecurringPattern[];
  checklist: ReusableChecklistItem[];
  markdown: string;
  source: 'rules';
  skillsCompleted?: number;
  plannedSkills?: number;
}
