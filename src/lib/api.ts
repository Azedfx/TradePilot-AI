import type {
  MarketSnapshot,
  ResearchLaunch,
  ResearchSessionResponse,
  ResearchSummary,
} from './types';

/**
 * Kick off a research session against the NestJS backend. The backend
 * spawns the pipeline in the background and returns the session id
 * immediately; the UI polls GET /research/:id for live progress.
 */
export async function startResearch(
  question: string,
): Promise<ResearchLaunch> {
  const res = await fetch('/api/research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
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

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));