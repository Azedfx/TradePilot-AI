import { Injectable, Logger } from '@nestjs/common';
import { Thesis } from '../analysis/thesis.service';
import { StressResult } from '../analysis/stress-test.service';
import { Finding } from '../db/db.types';
import { ResearchContext, SkillResult } from '../skills/skill.types';
import { LlmService } from '../llm/llm.service';

export interface Report {
  id: string;
  sessionId: string;
  title: string;
  markdown: string;
  summary: string;
  generatedAt: string;
}

/**
 * Report service - assembles the final human-readable research report
 * from a session's thesis, stress tests and evidence. Uses the LLM to
 * write a polished narrative and composes it into markdown.
 */
@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);
  constructor(private readonly llm: LlmService) {}

  async generate(params: {
    sessionId: string;
    context: ResearchContext;
    findings: Finding[];
    skillResults?: SkillResult[];
    historical?: unknown[];
    thesis: Thesis;
    stressTests: StressResult[];
  }): Promise<Report> {
    const { sessionId, context, thesis, stressTests } = params;

    const fallback = this.composeNarrative(context, thesis, stressTests, params.historical);
    let narrative = fallback;
    if (this.llm.provider !== 'placeholder') {
      try {
        narrative = await this.llm.complete([
          {
            role: 'system',
            content:
              'You are a research analyst writing for a human trader’s decision desk. ' +
              'Produce a concise, balanced markdown report for the requested asset. ' +
              'Do NOT include an H1 title heading (the caller writes the title). ' +
              'Use ONLY the provided data; never invent prices, indicators, ' +
              'percentages, or facts. End with an explicit actionable verdict that ' +
              'references the position-sizing and stop recommendation from the stress tests.\n\n' +
              'MANDATORY analysis sections (write each only if the data supports it; ' +
              'otherwise state plainly that the input is missing):\n' +
              '1. "Expectation gap": if any guidance, revenue, EPS, or guidance figure ' +
              'appears alongside a consensus or whisper number, compare them explicitly — ' +
              'e.g. "Q4 guidance $X vs consensus $Y → gap Z%". Name the direction of the ' +
              'surprise (beat / miss) and what the market has or has not priced.\n' +
              '2. "Transmission chain": if any rate, inflation, macro, or geopolitical ' +
              'signal exists, spell the exact chain from catalyst to the asset, e.g. ' +
              '"Fed cut → lower discount rate → higher equity multiples" or "inflation ' +
              'tick → real-yield rise → risk-asset reprice". If the link is unclear, say ' +
              '"transmission uncertain — missing X". Do not invent a chain without evidence.',
          },
          {
            role: 'user',
            content: this.buildPrompt(
              context,
              thesis,
              stressTests,
              params.skillResults,
              params.historical,
            ),
          },
        ]);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`LLM narrative failed, using composed fallback: ${message}`);
        narrative = fallback;
      }
    }

    const markdown = this.composeMarkdown(
      context,
      thesis,
      stressTests,
      narrative,
    );

    return {
      id: crypto.randomUUID(),
      sessionId,
      title: `Research report: ${context.symbols.join(', ')}`,
      markdown,
      summary: thesis.rationale,
      generatedAt: new Date().toISOString(),
    };
  }

  private buildPrompt(
    context: ResearchContext,
    thesis: Thesis,
    stressTests: StressResult[],
    skillResults?: SkillResult[],
    historical?: unknown[],
  ): string {
    const evidence = (skillResults ?? []).map((r) => ({
      skill: r.skill,
      fetchedAt: r.fetchedAt,
      summary: r.summary,
      data: JSON.stringify(r.data).slice(0, 800),
    }));

    const lines = [
      `Research target(s): ${context.symbols.join(', ')} (${context.assetType ?? 'us-stock'}, ${context.timeframe} timeframe).`,
      `Thesis direction: ${thesis.direction}.`,
      `Thesis confidence: ${Math.round(thesis.confidence * 100)}%.`,
      `Thesis rationale: ${thesis.rationale}`,
      ``,
      `Stress tests (bear-case, worst-case drawdown):`,
      JSON.stringify(stressTests),
    ];

    if (historical && historical.length) {
      lines.push(
        ``,
        `Historical distribution computed from real candles:`,
        JSON.stringify(historical),
      );
    }

    if (evidence.length) {
      lines.push(``, `Live skill evidence gathered by the research job:`, JSON.stringify(evidence, null, 1));
    }

    return lines.join('\n');
  }

  private composeNarrative(
    context: ResearchContext,
    thesis: Thesis,
    stressTests: StressResult[],
    historical?: unknown[],
  ): string {
    const conviction = thesis.direction === 'neutral' ? 'balanced' : thesis.direction;
    const stress = stressTests.length
      ? stressTests
          .map(
            (s) =>
              `${s.symbol}: worst-case ${
                s.scenarios.length
                  ? `${(Math.max(...s.scenarios.map((x) => x.maxDrawdown)) * 100).toFixed(1)}% `
                  : ''
              }drawdown, ${s.threat >= 0.5 ? 'elevated' : 'moderate'} threat.`,
          )
          .join(' ')
      : 'No quantified downside scenarios were produced for this run.';

    const histLine = (historical ?? [])
      .map((h) => {
        const s = h as {
          symbol?: string;
          returns?: { total?: number; annualized?: number };
          volatilityAnnualized?: number;
          maxDrawdown?: number;
          sampleSize?: number;
        };
        if (!s.symbol) return '';
        return `${s.symbol}: ${s.sampleSize ?? 0} candles, ${s.returns?.total !== undefined ? `${(s.returns.total * 100).toFixed(1)}%` : 'n/a'} total return, ${s.volatilityAnnualized !== undefined ? `${(s.volatilityAnnualized * 100).toFixed(1)}%` : 'n/a'} annualized vol, ${s.maxDrawdown !== undefined ? `${(s.maxDrawdown * 100).toFixed(1)}%` : 'n/a'} historical max drawdown.`;
      })
      .filter(Boolean)
      .join(' ');

    return (
      `Analysis across ${context.symbols.join(', ')} resolves to a ${conviction} bias ` +
      `with ${Math.round(thesis.confidence * 100)}% confidence. ` +
      `${thesis.rationale} ${stress} ` +
      (histLine ? `Historical distribution from live candles: ${histLine}` : '')
    );
  }

  private composeMarkdown(
    context: ResearchContext,
    thesis: Thesis,
    stressTests: StressResult[],
    narrative: string,
  ): string {
    const lines: string[] = [];
    lines.push(`# ${context.symbols.join(', ')} - Research Report`);
    lines.push('');
    lines.push(`**Bias:** ${thesis.direction} | **Confidence:** ${Math.round(
      thesis.confidence * 100,
    )}%`);
    lines.push('');
    lines.push(narrative.replace(/^#\s+.+(?:\r?\n)*/, '').trim());
    lines.push('');
    lines.push('## Catalysts');
    thesis.catalysts.forEach((c) => lines.push(`- ${c}`));
    lines.push('');
    lines.push('## Risks');
    thesis.risks.forEach((r) => lines.push(`- ${r}`));
    if (stressTests.length) {
      lines.push('');
      lines.push('## Stress Tests');
      stressTests.forEach((s) => {
        lines.push(`- **${s.symbol}**: ${s.recommendation}`);
      });
    }
    lines.push('');
    lines.push(`_Generated ${new Date().toISOString()}_`);
    return lines.join('\n');
  }
}
