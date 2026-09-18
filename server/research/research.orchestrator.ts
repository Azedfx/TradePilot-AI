import { Injectable, Logger } from '@nestjs/common';
import { ResearchStatus, ThesisBias } from '../generated/prisma/client';
import { ResearchRepository } from '../db/research.repository';
import { SkillsService } from '../skills/skills.service';
import { ResearchContext, SkillResult } from '../skills/skill.types';
import { ThesisService } from '../analysis/thesis.service';
import { HistoricalService, HistoricalStats } from '../analysis/historical.service';
import { StressTestService } from '../analysis/stress-test.service';
import { ReportService } from '../reports/report.service';
import { LlmService } from '../llm/llm.service';
import { MarketDataService, MarketSnapshot } from '../market-data/market-data.service';
import { detectAssetType, detectSymbols } from './symbol-detector';

export interface ResearchRequest {
  question: string;
  symbol?: string;
  symbols?: string[];
  timeframe?: string;
  assetType?: 'crypto' | 'us-stock';
}

export interface ResearchLaunch {
  sessionId: string;
  status: ResearchStatus;
}

/**
 * Research orchestrator - runs the full research pipeline for a single
 * session:
 *   1. persist session + plan
 *   2. run each skill and persist skill runs (live status via GET)
 *   3. normalise findings/sources
 *   4. build thesis, run historical + stress tests, persist
 *   5. generate report
 *   6. mark session completed
 *
 * The pipeline runs in the background so the HTTP call returns as soon as
 * the session is created; clients poll GET /research/:id for live progress.
 */
@Injectable()
export class ResearchOrchestrator {
  private readonly logger = new Logger(ResearchOrchestrator.name);

  constructor(
    private readonly repo: ResearchRepository,
    private readonly skills: SkillsService,
    private readonly thesisService: ThesisService,
    private readonly historicalService: HistoricalService,
    private readonly stressTestService: StressTestService,
    private readonly reportService: ReportService,
    private readonly llm: LlmService,
    private readonly marketData: MarketDataService,
  ) {}

  async start(request: ResearchRequest): Promise<ResearchLaunch> {
    const autonomousSymbols = detectSymbols(request.question);
    const symbols: string[] =
      request.symbols ?? (request.symbol ? [request.symbol] : autonomousSymbols);
    const assetType = request.assetType ?? detectAssetType(request.question, symbols[0]);

    const session = await this.repo.createSession({
      question: request.question,
      symbol: symbols[0],
      timeframe: request.timeframe,
      assetType,
    });

    await this.repo.addMessage({
      sessionId: session.id,
      role: 'user',
      content: request.question,
    });

    await this.updateStatus(session.id, ResearchStatus.PLANNING);

    const context: ResearchContext = {
      symbols,
      timeframe: request.timeframe ?? '1d',
      assetType,
    };

    void this.process(session.id, context).catch((error) => {
      this.logger.error(`Research session ${session.id} failed: ${error}`, error);
      void this.repo.updateSessionStatus(session.id, ResearchStatus.FAILED);
    });

    return { sessionId: session.id, status: ResearchStatus.PLANNING };
  }

  private async process(sessionId: string, context: ResearchContext) {
    const plan = await this.plan(sessionId, context);
    await this.repo.createPlan(sessionId, plan.objective, plan);

    await this.updateStatus(sessionId, ResearchStatus.RESEARCHING);

    // 1. Run all skills
    const skillResults = await this.runSkills(sessionId, context);

    // 2. Persist findings from skill output
    await this.persistFindings(sessionId, skillResults);

    await this.updateStatus(sessionId, ResearchStatus.ANALYZING);

    // 3. Thesis + historical + stress tests
    const symbols = context.symbols;
    const thesis = await this.thesisService.build(skillResults, symbols);
    const stressTests = await this.stressTestService.run(thesis, symbols);

    // 3b. Historical distribution (returns, volatility, max drawdown) from
    // real candles — the retrieval-side of decision stress testing. Safe to
    // degrade: research continues without it if market-data is flaky.
    let historical: unknown[] = [];
    try {
      historical = await Promise.all(
        symbols.map((symbol) =>
          this.historicalService.compute(symbol, context.timeframe, 200),
        ),
      );

      for (const entry of historical as HistoricalStats[]) {
        await this.repo.saveFinding({
          sessionId,
          category: 'historical',
          title: `Historical distribution for ${entry.symbol}`,
          statement: `${entry.sampleSize} candles from ${new Date(
            entry.period.start,
          ).toISOString().slice(0, 10)} to ${new Date(
            entry.period.end,
          ).toISOString().slice(0, 10)}: ${
            entry.returns.total !== undefined
              ? `${(entry.returns.total * 100).toFixed(1)}% total return, `
              : ''
          }${(entry.volatilityAnnualized * 100).toFixed(1)}% annualized volatility, ${
            (entry.maxDrawdown * 100).toFixed(1)
          }% historical max drawdown.`,
          importance: 'medium',
          sentiment: 'neutral',
          data: entry,
        });
      }
    } catch (error) {
      this.logger.warn(`Historical stats unavailable: ${String(error)}`);
    }

    try {
      const persistedThesis = await this.repo.saveThesis({
        sessionId,
        symbol: symbols[0] ?? 'UNKNOWN',
        bias: (thesis.direction as ThesisBias) ?? ThesisBias.NEUTRAL,
        confidence: thesis.confidence,
        summary: thesis.rationale,
        catalysts: thesis.catalysts,
        risks: thesis.risks,
        conclusion: thesis.rationale,
      });

      for (const st of stressTests) {
        for (const scenario of st.scenarios) {
          await this.repo.saveStressTest({
            sessionId,
            thesisId: persistedThesis.id,
            name: scenario.name,
            scenarioType: 'bear',
            assumptions: {
              recoveryMonths: scenario.recoveryMonths,
              threat: st.threat,
              symbol: st.symbol,
            },
            historicalSampleSize: undefined,
            worstCase: scenario.maxDrawdown,
            aiAnalysis: st.recommendation,
          });
        }
      }

      const report = await this.reportService.generate({
        sessionId,
        context,
        findings: [],
        skillResults,
        thesis: {
          symbols,
          direction: thesis.direction,
          confidence: thesis.confidence,
          rationale: thesis.rationale,
          catalysts: thesis.catalysts,
          risks: thesis.risks,
          signals: thesis.signals,
          generatedAt: new Date().toISOString(),
        },
        stressTests,
        historical,
      });

      await this.repo.addMessage({
        sessionId,
        role: 'assistant',
        content: report.markdown,
        toolName: 'report',
        metadata: { category: 'research-report', model: this.llm.provider },
      });
    } catch (error) {
      this.logger.error(`Analysis/persistence failed: ${error}`, error);
      await this.updateStatus(sessionId, ResearchStatus.FAILED);
      return;
    }

    await this.repo.addMessage({
      sessionId,
      role: 'assistant',
      content: 'Research complete. Report generated.',
    });

    await this.updateStatus(sessionId, ResearchStatus.COMPLETED);
  }

  private async plan(
    sessionId: string,
    context: ResearchContext,
  ): Promise<{ objective: string; skills: string[]; questions: string[] }> {
    const objective = `Research ${context.symbols.join(', ')} on the ${
      context.timeframe
    } timeframe.`;
    const skills = this.skills.all.map((s) => s.name);
    const questions = [
      'What are the current catalysts and narratives?',
      'What is the technical structure and trend?',
      'What is sentiment and derivatives positioning?',
      'What does the macro backdrop imply for risk?',
    ];
    await this.repo.addMessage({
      sessionId,
      role: 'assistant',
      content: `Investigating ${context.symbols.join(', ')} using ${skills.join(', ')}.`,
    });
    return { objective, skills, questions };
  }

  private async runSkills(sessionId: string, context: ResearchContext) {
    const results: SkillResult[] = [];

    // Begin a skill_run record for every skill up front, then execute in
    // parallel so total research latency is bounded by the slowest skill.
    const runs = await Promise.all(
      this.skills.all.map((skill) =>
        this.repo.beginSkillRun({
          sessionId,
          skillName: skill.name,
          input: context,
        }),
      ),
    );

    const executions = runs.map(async (run, i) => {
      const skill = this.skills.all[i];
      const started = Date.now();
      try {
        const result = await skill.run(context);
        await this.repo.completeSkillRun(run.id, result, Date.now() - started);
        results.push(result);
      } catch (error) {
        await this.repo.failSkillRun(run.id, String(error));
      }
    });

    await Promise.all(executions);
    return results;
  }

  private async persistFindings(
    sessionId: string,
    results: { skill: string; summary: string; data: unknown }[],
  ) {
    for (const result of results) {
      await this.repo.saveFinding({
        sessionId,
        category: result.skill,
        title: `Summary from ${result.skill} skill`,
        statement: result.summary,
        importance: 'medium',
        sentiment: 'neutral',
        data: result.data,
      });
    }
  }

  private async updateStatus(id: string, status: ResearchStatus) {
    await this.repo.updateSessionStatus(id, status);
  }
}
