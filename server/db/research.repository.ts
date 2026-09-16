import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import {
  Prisma,
  ResearchStatus,
  SkillRunStatus,
  ThesisBias,
} from '../generated/prisma/client';
import {
  Finding as PrismaFinding,
  ResearchSession,
  SkillRun,
  Thesis,
} from '../generated/prisma/client';

export type SessionWithRelations = Prisma.ResearchSessionGetPayload<{
  include: {
    plan: true;
    skillRuns: true;
    findings: true;
    messages: true;
    historicalMatches: true;
    thesis: { include: { stressTests: true } };
  };
}>;

export interface CreateSessionInput {
  question: string;
  symbol?: string;
  assetType?: string;
  timeframe?: string;
}

export interface CreateSkillRunInput {
  sessionId: string;
  skillName: string;
  input?: unknown;
}

export function toThesisBias(value: string | ThesisBias): ThesisBias {
  const normalized = String(value).toLowerCase();
  if (normalized.includes('bull') || normalized === 'long') return ThesisBias.BULLISH;
  if (normalized.includes('bear') || normalized === 'short') return ThesisBias.BEARISH;
  return ThesisBias.NEUTRAL;
}

/** Retry transient Neon pooler flakiness (P1001) on a write path. */
function withPoolRetry<T>(fn: () => Promise<T>): Promise<T> {
  const attempts = 3;
  const run = async (attempt: number): Promise<T> => {
    try {
      return await fn();
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === 'P1001' && attempt < attempts) {
        await new Promise((r) => setTimeout(r, 800 * attempt));
        return run(attempt + 1);
      }
      throw error;
    }
  };
  return run(1);
}

@Injectable()
export class ResearchRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(input: CreateSessionInput): Promise<ResearchSession> {
    return withPoolRetry(() =>
      this.prisma.researchSession.create({
        data: {
          question: input.question,
          symbol: input.symbol,
          assetType: input.assetType ?? 'us-stock',
          timeframe: input.timeframe,
          status: ResearchStatus.PENDING,
        },
      }),
    );
  }

  async listSessions(limit = 20): Promise<
    Prisma.ResearchSessionGetPayload<{ include: { thesis: true } }>[]
  > {
    return this.prisma.researchSession.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { thesis: true },
    });
  }

  async findSession(
    id: string,
  ): Promise<SessionWithRelations | null> {
    return this.prisma.researchSession.findUnique({
      where: { id },
      include: {
        plan: true,
        skillRuns: true,
        findings: true,
        messages: true,
        historicalMatches: true,
        thesis: { include: { stressTests: true } },
      },
    });
  }

  async updateSessionStatus(
    id: string,
    status: ResearchStatus,
  ): Promise<ResearchSession> {
    return withPoolRetry(() =>
      this.prisma.researchSession.update({
        where: { id },
        data: {
          status,
          completedAt:
            status === ResearchStatus.COMPLETED ? new Date() : undefined,
        },
      }),
    );
  }

  async createPlan(sessionId: string, objective: string, plan: unknown) {
    return withPoolRetry(() =>
      this.prisma.researchPlan.create({
        data: { sessionId, objective, plan: plan as object },
      }),
    );
  }

  async beginSkillRun(input: CreateSkillRunInput): Promise<SkillRun> {
    return withPoolRetry(() =>
      this.prisma.skillRun.create({
        data: {
          sessionId: input.sessionId,
          skillName: input.skillName,
          input: input.input as object | undefined,
          status: SkillRunStatus.RUNNING,
          startedAt: new Date(),
        },
      }),
    );
  }

  async completeSkillRun(
    id: string,
    output: unknown,
    durationMs: number,
  ): Promise<SkillRun> {
    return withPoolRetry(() =>
      this.prisma.skillRun.update({
        where: { id },
        data: {
          output: output as object,
          status: SkillRunStatus.COMPLETED,
          completedAt: new Date(),
          durationMs,
        },
      }),
    );
  }

  async failSkillRun(id: string, error: string): Promise<SkillRun> {
    return withPoolRetry(() =>
      this.prisma.skillRun.update({
        where: { id },
        data: {
          error,
          status: SkillRunStatus.FAILED,
          completedAt: new Date(),
        },
      }),
    );
  }

  async saveFinding(data: {
    sessionId: string;
    skillRunId?: string;
    category: string;
    title: string;
    statement: string;
    importance?: string;
    sentiment?: string;
    data?: unknown;
  }): Promise<PrismaFinding> {
    return withPoolRetry(() =>
      this.prisma.finding.create({
        data: {
          sessionId: data.sessionId,
          skillRunId: data.skillRunId,
          category: data.category,
          title: data.title,
          statement: data.statement,
          importance: data.importance,
          sentiment: data.sentiment,
          data: data.data as object | undefined,
        },
      }),
    );
  }

  async saveSource(data: {
    sessionId: string;
    skillRunId?: string;
    title?: string;
    url?: string;
    sourceType?: string;
    publisher?: string;
    metadata?: unknown;
  }) {
    return this.prisma.source.create({
      data: {
        sessionId: data.sessionId,
        skillRunId: data.skillRunId,
        title: data.title,
        url: data.url,
        sourceType: data.sourceType,
        publisher: data.publisher,
        metadata: data.metadata as object | undefined,
      },
    });
  }

  async addHistoricalMatch(data: {
    sessionId: string;
    historicalEventId: string;
    similarityScore: number;
    similarityExplanation?: string;
  }) {
    return withPoolRetry(() => this.prisma.historicalMatch.create({ data }));
  }

  async saveThesis(data: {
    sessionId: string;
    symbol: string;
    bias: ThesisBias;
    confidence: number;
    summary: string;
    bullCase?: unknown[];
    bearCase?: unknown[];
    catalysts?: unknown[];
    risks?: unknown[];
    invalidationConditions?: unknown[];
    historicalSummary?: unknown;
    conclusion?: string;
  }): Promise<Thesis> {
    return withPoolRetry(() =>
      this.prisma.thesis.create({
        data: {
          sessionId: data.sessionId,
          symbol: data.symbol,
          bias: toThesisBias(data.bias),
          confidence: data.confidence,
          summary: data.summary,
          bullCase: data.bullCase as object | undefined,
          bearCase: data.bearCase as object | undefined,
          catalysts: data.catalysts as object | undefined,
          risks: data.risks as object | undefined,
          invalidationConditions: data.invalidationConditions as
            | object
            | undefined,
          historicalSummary: data.historicalSummary as object | undefined,
          conclusion: data.conclusion,
        },
      }),
    );
  }

  async saveStressTest(data: {
    sessionId: string;
    thesisId?: string;
    name: string;
    scenarioType: string;
    assumptions: unknown;
    historicalSampleSize?: number;
    medianReturn1d?: number;
    medianReturn5d?: number;
    medianReturn20d?: number;
    positiveProbability?: number;
    worstCase?: number;
    bestCase?: number;
    aiAnalysis?: string;
  }) {
    return withPoolRetry(() =>
      this.prisma.stressTest.create({
        data: {
          sessionId: data.sessionId,
          thesisId: data.thesisId,
          name: data.name,
          scenarioType: data.scenarioType,
          assumptions: data.assumptions as object,
          historicalSampleSize: data.historicalSampleSize,
          medianReturn1d: data.medianReturn1d,
          medianReturn5d: data.medianReturn5d,
          medianReturn20d: data.medianReturn20d,
          positiveProbability: data.positiveProbability,
          worstCase: data.worstCase,
          bestCase: data.bestCase,
          aiAnalysis: data.aiAnalysis,
        },
      }),
    );
  }

  /**
   * Recent "review" category findings from other sessions, used to detect
   * recurring bad-decision patterns across a trader's research history
   * (self-evolution: has this pattern shown up before, not just this run?).
   */
  async findRecentReviewFindings(
    excludeSessionId: string,
    limit = 20,
  ): Promise<PrismaFinding[]> {
    return this.prisma.finding.findMany({
      where: { category: 'review', sessionId: { not: excludeSessionId } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async addMessage(data: {
    sessionId: string;
    role: string;
    content: string;
    toolName?: string;
    metadata?: unknown;
  }) {
    return withPoolRetry(() =>
      this.prisma.researchMessage.create({
        data: {
          sessionId: data.sessionId,
          role: data.role,
          content: data.content,
          toolName: data.toolName,
          metadata: data.metadata as object | undefined,
        },
      }),
    );
  }
}
