import { Injectable } from '@nestjs/common';
import { Thesis } from '../analysis/thesis.service';
import { StressResult } from '../analysis/stress-test.service';
import { Finding } from '../db/db.types';
import { ResearchContext } from '../skills/skill.types';
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
  constructor(private readonly llm: LlmService) {}

  async generate(params: {
    sessionId: string;
    context: ResearchContext;
    findings: Finding[];
    thesis: Thesis;
    stressTests: StressResult[];
  }): Promise<Report> {
    const { sessionId, context, thesis, stressTests } = params;

    const narrative =
      this.llm.provider === 'placeholder'
        ? this.composeNarrative(context, thesis, stressTests)
        : await this.llm.complete([
            {
              role: 'system',
              content:
                'You write concise, balanced crypto research reports in markdown.',
            },
            {
              role: 'user',
              content: `Write a research report for ${context.symbols.join(
                ', ',
              )}. Bias: ${thesis.direction}. Confidence: ${Math.round(
                thesis.confidence * 100,
              )}%. Stress tests: ${JSON.stringify(stressTests)}.`,
            },
          ]);

    const markdown = this.composeMarkdown(context, thesis, stressTests, narrative);

    return {
      id: crypto.randomUUID(),
      sessionId,
      title: `Research report: ${context.symbols.join(', ')}`,
      markdown,
      summary: thesis.rationale,
      generatedAt: new Date().toISOString(),
    };
  }

  private composeNarrative(
    context: ResearchContext,
    thesis: Thesis,
    stressTests: StressResult[],
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

    return (
      `Analysis across ${context.symbols.join(', ')} resolves to a ${conviction} bias ` +
      `with ${Math.round(thesis.confidence * 100)}% confidence. ` +
      `${thesis.rationale} ${stress} `
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
    lines.push(narrative);
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
