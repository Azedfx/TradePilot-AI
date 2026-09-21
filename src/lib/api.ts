import type {
  MarketSnapshot,
  ResearchLaunch,
  ResearchSessionResponse,
  ResearchSummary,
  ReviewReport,
} from './types';

export type DeskPreferences = {
  riskAppetite?: 'conservative' | 'balanced' | 'aggressive';
  focus?: 'earnings' | 'macro' | 'technical' | 'rToken' | 'balanced';
  emphasizeSkills?: string[];
};

const PREFS_KEY = 'tradepilot:desk-preferences';

export function loadDeskPreferences(): DeskPreferences {
  if (typeof window === 'undefined') return { riskAppetite: 'balanced', focus: 'balanced' };
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { riskAppetite: 'balanced', focus: 'balanced' };
    return { riskAppetite: 'balanced', focus: 'balanced', ...JSON.parse(raw) };
  } catch {
    return { riskAppetite: 'balanced', focus: 'balanced' };
  }
}

export function saveDeskPreferences(prefs: DeskPreferences): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

/**
 * Kick off a research session against the NestJS backend. The backend
 * spawns the pipeline in the background and returns the session id
 * immediately; the UI polls GET /research/:id for live progress.
 */
export async function startResearch(
  question: string,
  preferences?: DeskPreferences,
): Promise<ResearchLaunch> {
  const prefs = preferences ?? loadDeskPreferences();
  const res = await fetch('/api/research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, preferences: prefs }),
  });

  if (!res.ok) {
    throw new Error(`Research request failed (${res.status})`);
  }

  return (await res.json()) as ResearchLaunch;
}

export async function getResearch(
  sessionId: string,
): Promise<ResearchSessionResponse> {
  const res = await fetch(`/api/research/${sessionId}`);

  if (!res.ok) {
    throw new Error(`Research status failed (${res.status})`);
  }

  return (await res.json()) as ResearchSessionResponse;
}

export async function listResearch(): Promise<ResearchSummary[]> {
  const res = await fetch('/api/research');

  if (!res.ok) {
    throw new Error(`Research list failed (${res.status})`);
  }

  return (await res.json()) as ResearchSummary[];
}

export async function getMarket(
  symbol: string,
): Promise<MarketSnapshot | null> {
  const res = await fetch(`/api/market/${symbol}`);

  if (!res.ok) {
    throw new Error(`Market snapshot failed (${res.status})`);
  }

  return (await res.json()) as MarketSnapshot | null;
}

/**
 * Fetch the self-evolution review report for a completed research session:
 * bad-decision-pattern detection plus a reusable checklist for the next idea.
 */
export async function getReview(sessionId: string): Promise<ReviewReport> {
  const res = await fetch(`/api/review/${sessionId}`);

  if (!res.ok) {
    throw new Error(`Review request failed (${res.status})`);
  }

  return (await res.json()) as ReviewReport;
}

export interface DemoMetrics {
  generatedAt: string;
  track: string;
  theme: string;
  researchSessions: number;
  completedSessions: number;
  failedSessions: number;
  completionRatePct: number;
  humanDecisions: number;
  skillRunsCompleted: number;
  selfEvolutionReviews: number;
  note?: string;
}

/** Hackathon validation metrics for judges (Track 3 form part 3). */
export async function getMetrics(): Promise<DemoMetrics | null> {
  try {
    const res = await fetch('/api/metrics');
    if (!res.ok) return null;
    return (await res.json()) as DemoMetrics;
  } catch {
    return null;
  }
}

/**
 * Persist the trader's final call on a completed thesis
 * (Track 3: AI assists, human decides).
 */
export async function submitDecision(
  sessionId: string,
  decision: 'accepted' | 'rejected',
): Promise<{ sessionId: string; decision: string }> {
  const res = await fetch(`/api/research/${sessionId}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision }),
  });

  if (!res.ok) {
    throw new Error(`Decision request failed (${res.status})`);
  }

  return (await res.json()) as { sessionId: string; decision: string };
}

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));