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
}

export interface ResearchSessionResponse {
  sessionId: string;
  question: string;
  status: ResearchStatus;
  symbol?: string | null;
  assetType?: string | null;
  skills: SkillRunView[];
  marketData?: unknown;
  thesis?: unknown;
  stressTests?: unknown[];
  historicalMatches?: unknown[];
  messages?: unknown[];
  report?: unknown;
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
    if (
      session.symbol &&
      session.status !== ResearchStatus.FAILED
    ) {
      marketData = await this.marketData
        .getMarketSnapshot(session.symbol === 'UNKNOWN' ? 'BTC' : session.symbol)
        .catch(() => null);
    }

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
      })),
      marketData,
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
      historicalMatches: session.historicalMatches ?? [],
      stressTests: (session.thesis?.stressTests ?? []).map((st) => ({
        symbol: session.symbol ?? 'UNKNOWN',
        name: st.name,
        sampleSize: st.historicalSampleSize,
        scenarios: [
          {
            name: st.name,
            worstCase: st.worstCase ?? 0,
          },
        ],
        recommendation: st.aiAnalysis ?? '',
      })),
      messages: session.messages ?? [],
    };
  }
}

function toDirection(bias: string): 'long' | 'short' | 'neutral' {
  if (bias === 'BULLISH') return 'long';
  if (bias === 'BEARISH') return 'short';
  return 'neutral';
}