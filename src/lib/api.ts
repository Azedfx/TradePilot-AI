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
  /** Lessons ticked in a prior self-evolution review, carried into this run. */
  carryForward?: string[];
};

const PREFS_KEY = 'tradepilot:desk-preferences';
/** Shared with SelfReview.tsx — acknowledged next-idea checklist items. */
export const CHECKLIST_STORAGE_KEY = 'tradepilot:next-idea-checklist';
/** Fired whenever the carry-forward checklist changes, so the Hero can sync. */
export const CARRY_FORWARD_EVENT = 'tradepilot:carry-updated';

/** Read the checklist items the trader ticked to carry into their next run. */
export function loadCarryForwardLessons(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CHECKLIST_STORAGE_KEY);
    if (!raw) return [];
    const map = JSON.parse(raw) as Record<string, boolean>;
    if (!map || typeof map !== 'object') return [];
    return Object.entries(map)
      .filter(([, v]) => Boolean(v))
      .map(([k]) => k);
  } catch {
    return [];
  }
}

/** Remove a single carried lesson (or all when no key given) and notify. */
export function clearCarryForwardLesson(check?: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (!check) {
      localStorage.removeItem(CHECKLIST_STORAGE_KEY);
    } else {
      const raw = localStorage.getItem(CHECKLIST_STORAGE_KEY);
      const map = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
      delete map[check];
      localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(map));
    }
    window.dispatchEvent(new Event(CARRY_FORWARD_EVENT));
  } catch {
    // ignore quota / private mode
  }
}

export function loadDeskPreferences(): DeskPreferences {
  const base: DeskPreferences = { riskAppetite: 'balanced', focus: 'balanced' };
  if (typeof window === 'undefined') return base;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    const stored = raw ? (JSON.parse(raw) as DeskPreferences) : {};
    const carryForward = loadCarryForwardLessons();
    return {
      ...base,
      ...stored,
      ...(carryForward.length ? { carryForward } : {}),
    };
  } catch {
    return base;
  }
}

export function saveDeskPreferences(prefs: DeskPreferences): void {
  if (typeof window === 'undefined') return;
  // Never persist carryForward here — it is derived from the checklist store.
  const { carryForward: _omit, ...rest } = prefs;
  void _omit;
  localStorage.setItem(PREFS_KEY, JSON.stringify(rest));
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