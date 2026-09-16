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
  maxDrawdown: number;
  recoveryMonths: number;
}

export interface StressPayload {
  symbol: string;
  threat: number;
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
  historicalMatches?: unknown[];
  messages?: unknown[];
}

export interface ReusableChecklistItem {
  check: string;
  why: string;
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
  recurring: RecurringPattern[];
  checklist: ReusableChecklistItem[];
  markdown: string;
  source: 'rules';
}