import { Injectable, NotFoundException } from '@nestjs/common';
import { ResearchRepository } from '../db/research.repository';
import {
  ResearchOrchestrator,
  ResearchLaunch,
  ResearchRequest,
} from './research.orchestrator';
import { MarketDataService } from '../market-data/market-data.service';
import { ResearchStatus } from '../generated/prisma/client';

export interface SkillRunView {
  skillName: string;
  status: string;
  durationMs: number | null;
  error: string | null;
  summary?: string | null;
}

export interface FindingView {
  category: string;
  title: string;
  statement: string;
  importance?: string | null;
  sentiment?: string | null;
  data?: unknown;
}

export interface HistoricalStatsView {
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

export interface StressScenarioView {
  name: string;
  worstCase: number;
  maxDrawdown: number;
  recoveryMonths?: number;
}

export interface StressTestView {
  symbol: string;
  name: string;
  threat?: number;
  sampleSize?: number | null;
  scenarios: StressScenarioView[];
  recommendation: string;
}

export interface ResearchSessionResponse {
  sessionId: string;
  question: string;
  status: ResearchStatus;
  symbol?: string | null;
  assetType?: string | null;
  skills: SkillRunView[];
  marketData?: unknown;
  marketWindow?: unknown;
  thesis?: unknown;
  stressTests?: StressTestView[];
  historicalStats?: HistoricalStatsView[];
  historicalMatches?: unknown[];
  findings?: FindingView[];
  messages?: unknown[];
  report?: string | null;
  decision?: 'accepted' | 'rejected' | null;
}

@Injectable()
export class ResearchService {
  constructor(
    private readonly orchestrator: ResearchOrchestrator,
    private readonly repo: ResearchRepository,
    private readonly marketData: MarketDataService,
  ) {}

  async start(request: ResearchRequest): Promise<ResearchLaunch> {
    return this.orchestrator.start(request);
  }

  async list() {
    const sessions = await this.repo.listSessions(20);
    return sessions.map((s) => ({
      sessionId: s.id,
      question: s.question,
      symbol: s.symbol,
      assetType: s.assetType,
      status: s.status,
      createdAt: s.createdAt.toISOString(),
      direction: s.thesis ? toDirection(s.thesis.bias) : null,
      confidence: s.thesis?.confidence ?? null,
    }));
  }

  async status(sessionId: string): Promise<ResearchSessionResponse> {
    const session = await this.repo.findSession(sessionId);
    if (!session) {
      throw new NotFoundException(`Research session ${sessionId} not found`);
    }

    let marketData: unknown;
    if (session.symbol && session.status !== ResearchStatus.FAILED) {
      const fallback =
        session.assetType === 'crypto' ? 'BTC' : 'SPY';
      marketData = await this.marketData
        .getMarketSnapshot(
          session.symbol === 'UNKNOWN' ? fallback : session.symbol,
        )
        .catch(() => null);
    }

    const macroFinding = (session.findings ?? []).find(
      (f) => f.category === 'macro',
    );
    const marketWindow =
      (macroFinding?.data as { usMarketWindow?: unknown } | null)
        ?.usMarketWindow ?? null;

    // Historical distribution is persisted as findings (category=historical),
    // not as HistoricalMatch rows — surface them for the UI card.
    const historicalStats: HistoricalStatsView[] = (session.findings ?? [])
      .filter((f) => f.category === 'historical')
      .map((f) => {
        const data = (f.data ?? {}) as unknown as HistoricalStatsView;
        return {
          ...data,
          statement: f.statement,
          symbol: data.symbol ?? session.symbol ?? 'UNKNOWN',
        };
      });

    const skillSummaries = new Map<string, string>();
    for (const f of session.findings ?? []) {
      if (['news', 'market', 'macro', 'sentiment', 'technical'].includes(f.category)) {
        skillSummaries.set(f.category, f.statement);
      }
    }

    const reportMsg = (session.messages ?? []).find(
      (m) =>
        m.role === 'assistant' &&
        (m.toolName === 'report' ||
          (m.metadata as { category?: string } | null)?.category ===
            'research-report'),
    );

    const decisionMsg = (session.messages ?? []).find(
      (m) =>
        m.role === 'user' &&
        (m.metadata as { category?: string } | null)?.category === 'decision',
    );
    const decisionMeta = decisionMsg?.metadata as
      | { decision?: 'accepted' | 'rejected' }
      | null
      | undefined;

    const findings: FindingView[] = (session.findings ?? [])
      .filter((f) => f.category !== 'review')
      .map((f) => ({
        category: f.category,
        title: f.title,
        statement: f.statement,
        importance: f.importance,
        sentiment: f.sentiment,
        data: f.data,
      }));

    return {
      sessionId: session.id,
      question: session.question,
      status: session.status,
      symbol: session.symbol,
      assetType: session.assetType,
      skills: (session.skillRuns ?? []).map((run) => ({
        skillName: run.skillName,
        status: run.status,
        durationMs: run.durationMs,
        error: run.error,
        summary: skillSummaries.get(run.skillName) ?? null,
      })),
      marketData,
      marketWindow,
      thesis: session.thesis
        ? {
            symbols: [session.symbol ?? 'UNKNOWN'],
            direction: toDirection(session.thesis.bias),
            confidence: session.thesis.confidence,
            rationale: session.thesis.summary,
            catalysts: session.thesis.catalysts ?? [],
            risks: session.thesis.risks ?? [],
            generatedAt: session.thesis.createdAt.toISOString(),
          }
        : null,
      historicalStats,
      historicalMatches: (session.historicalMatches ?? []).map((m) => {
        const ev = (m as { historicalEvent?: {
          symbol?: string;
          eventType?: string;
          eventDate?: Date;
          return1dPct?: number | null;
          return5dPct?: number | null;
          return20dPct?: number | null;
          volatility20d?: number | null;
        } }).historicalEvent;
        return {
          id: m.id,
          similarityScore: m.similarityScore,
          similarityExplanation: m.similarityExplanation,
          eventType: ev?.eventType ?? null,
          eventDate: ev?.eventDate?.toISOString?.() ?? null,
          symbol: ev?.symbol ?? session.symbol,
          return1dPct: ev?.return1dPct ?? null,
          return5dPct: ev?.return5dPct ?? null,
          return20dPct: ev?.return20dPct ?? null,
          volatility20d: ev?.volatility20d ?? null,
        };
      }),
      findings,
      stressTests: (session.thesis?.stressTests ?? []).map((st) => {
        const assumptions = (st.assumptions ?? {}) as {
          recoveryMonths?: number;
          threat?: number;
          description?: string;
        };
        const worst = st.worstCase ?? 0;
        return {
          symbol: session.symbol ?? 'UNKNOWN',
          name: st.name,
          threat: assumptions.threat,
          sampleSize: st.historicalSampleSize,
          scenarios: [
            {
              name: st.name,
              description: assumptions.description,
              worstCase: worst,
              maxDrawdown: worst,
              recoveryMonths: assumptions.recoveryMonths,
            },
          ],
          recommendation: st.aiAnalysis ?? '',
        };
      }),
      messages: session.messages ?? [],
      report: reportMsg?.content
        ? reportMsg.content.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
        : null,
      decision: decisionMeta?.decision ?? null,
    };
  }

  /** Persist the trader's final call (Track 3: AI assists, human decides). */
  async decide(
    sessionId: string,
    decision: 'accepted' | 'rejected',
  ): Promise<{ sessionId: string; decision: string }> {
    const session = await this.repo.findSession(sessionId);
    if (!session) {
      throw new NotFoundException(`Research session ${sessionId} not found`);
    }

    await this.repo.addMessage({
      sessionId,
      role: 'user',
      content:
        decision === 'accepted'
          ? 'Trader ACCEPTED this thesis as the working research conclusion.'
          : 'Trader REJECTED this thesis — will not act on it.',
      toolName: 'decision',
      metadata: { category: 'decision', decision },
    });

    await this.repo.saveFinding({
      sessionId,
      category: 'decision',
      title: decision === 'accepted' ? 'Thesis accepted' : 'Thesis rejected',
      statement:
        decision === 'accepted'
          ? 'Human trader accepted the AI thesis as actionable insight.'
          : 'Human trader rejected the AI thesis — final decision overrides the model.',
      importance: 'high',
      sentiment: decision === 'accepted' ? 'positive' : 'negative',
      data: { decision },
    });

    return { sessionId, decision };
  }
}

function toDirection(bias: string): 'long' | 'short' | 'neutral' {
  if (bias === 'BULLISH') return 'long';
  if (bias === 'BEARISH') return 'short';
  return 'neutral';
}
