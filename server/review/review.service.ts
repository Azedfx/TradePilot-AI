import { Injectable, NotFoundException } from '@nestjs/common';
import { ResearchRepository } from '../db/research.repository';
import { ThesisBias } from '../generated/prisma/client';

export interface ReviewSection {
  heading: string;
  body: string;
}

export interface ReusableChecklistItem {
  check: string;
  why: string;
}

/** A flagged bad-decision pattern. `id` is stable across sessions so
 * recurrence can be tracked; `message` is the human-readable explanation. */
export interface PatternFlag {
  id: string;
  message: string;
}

/** A pattern flagged in this session that has also shown up in past ones —
 * the literal "self-evolution" signal: is the trader repeating a mistake? */
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
  /** Structured flags with stable ids (used for cross-session recurrence). */
  patterns: PatternFlag[];
  recurring: RecurringPattern[];
  checklist: ReusableChecklistItem[];
  markdown: string;
  source: 'rules';
  skillsCompleted: number;
  plannedSkills: number;
}

interface NormalizedThesis {
  direction: string;
  confidence: number;
  rationale: string;
  stopLossPct?: number;
  stressTests: Array<{ maxDrawdown: number; name?: string }>;
}

@Injectable()
export class ReviewService {
  constructor(private readonly repo: ResearchRepository) {}

  async review(sessionId: string): Promise<ReviewReport> {
    const session = await this.repo.findSession(sessionId);
    if (!session) throw new NotFoundException(`No research session ${sessionId}`);

    const thesis = this.normalizeThesis(session.thesis);
    const findings = (session.findings ?? []).map((f) => ({
      category: f.category,
      title: f.title,
      statement: f.statement,
      data: f.data,
    }));

    const skills = (session.skillRuns ?? []).filter(
      (s) => s.status === 'COMPLETED',
    );

    const planJson = session.plan?.plan as {
      objective?: string;
      skills?: string[];
      questions?: string[];
    } | null;
    const plannedSkills = Array.isArray(planJson?.skills)
      ? planJson.skills.length
      : 0;

    const recap = this.composeRecap(thesis);
    const patterns = this.detectPatterns(
      thesis,
      findings,
      skills.length,
      plannedSkills,
    );
    const recurring = await this.findRecurring(sessionId, patterns);
    const checklist = this.buildChecklist(patterns);

    const markdown = this.composeMarkdown(
      recap,
      patterns,
      checklist,
      plannedSkills,
      skills.length,
      recurring,
    );

    await this.repo.saveFinding({
      sessionId,
      category: 'review',
      title: 'Self-evolution review report',
      statement: `Review flagged ${patterns.length} adverse decision pattern(s) (${recurring.length} recurring from past sessions) and emitted ${checklist.length} reusable checklist item(s); planned skill coverage ${skills.length}/${plannedSkills}.`,
      data: { patterns, checklist, plannedSkills, skillsCompleted: skills.length },
    });

    return {
      sessionId,
      generatedAt: new Date().toISOString(),
      title: `Self-evolution review — ${thesis?.direction ?? 'mixed'} thesis`,
      recap,
      badPatterns: patterns.map((p) => p.message),
      patterns,
      recurring,
      checklist,
      markdown,
      source: 'rules',
      skillsCompleted: skills.length,
      plannedSkills,
    };
  }

  /**
   * Map Prisma thesis + stress-test rows into the shape the pattern
   * detectors expect. The DB stores bias/summary/worstCase (fractions);
   * detectors want direction/rationale/maxDrawdown (percent).
   */
  private normalizeThesis(
    thesis: {
      bias: ThesisBias;
      confidence: number;
      summary: string;
      stressTests?: Array<{
        name: string;
        worstCase: number | null;
        aiAnalysis: string | null;
      }>;
    } | null,
  ): NormalizedThesis | null {
    if (!thesis) return null;

    const stressTests = (thesis.stressTests ?? []).map((st) => ({
      name: st.name,
      // worstCase is a signed fraction (e.g. -0.18); expose as positive %
      maxDrawdown: Math.abs(st.worstCase ?? 0) * 100,
    }));

    const recommendation =
      thesis.stressTests?.find((st) => st.aiAnalysis)?.aiAnalysis ?? '';
    const stopMatch = /stop at\s+([\d.]+)\s*%/i.exec(recommendation);
    const stopLossPct = stopMatch ? Number(stopMatch[1]) : undefined;

    return {
      direction: this.biasToDirection(thesis.bias),
      confidence: thesis.confidence,
      rationale: thesis.summary,
      stopLossPct: Number.isFinite(stopLossPct) ? stopLossPct : undefined,
      stressTests,
    };
  }

  private biasToDirection(bias: ThesisBias): string {
    if (bias === ThesisBias.BULLISH) return 'long';
    if (bias === ThesisBias.BEARISH) return 'short';
    return 'neutral';
  }

  /**
   * Cross-session self-evolution check: of the patterns flagged in *this*
   * run, which ones also showed up in the trader's recent past reviews?
   */
  private async findRecurring(
    sessionId: string,
    patterns: PatternFlag[],
  ): Promise<RecurringPattern[]> {
    if (!patterns.length) return [];

    const past = await this.repo.findRecentReviewFindings(sessionId, 20);
    const sessionsConsidered = past.length;
    if (sessionsConsidered === 0) return [];

    const occurrences = new Map<string, number>();
    for (const finding of past) {
      const data = finding.data as { patterns?: Array<{ id?: string }> } | null;
      const idsInSession = new Set(
        (data?.patterns ?? []).map((p) => p?.id).filter((id): id is string => Boolean(id)),
      );
      for (const id of idsInSession) {
        occurrences.set(id, (occurrences.get(id) ?? 0) + 1);
      }
    }

    return patterns
      .map((p) => ({
        id: p.id,
        message: p.message,
        occurrences: occurrences.get(p.id) ?? 0,
        sessionsConsidered,
      }))
      .filter((r) => r.occurrences > 0);
  }

  async checklist(sessionId: string): Promise<ReusableChecklistItem[]> {
    const report = await this.review(sessionId);
    return report.checklist;
  }

  private detectPatterns(
    thesis: NormalizedThesis | null,
    findings: Array<{ category?: string; title?: string; statement?: string; data?: unknown }>,
    skillsCompleted: number,
    plannedSkills: number,
  ): PatternFlag[] {
    const patterns: PatternFlag[] = [];
    const stress = thesis?.stressTests ?? [];
    const worstDrawdown = stress.reduce((m, s) => Math.max(m, s.maxDrawdown ?? 0), 0);
    const rationale = thesis?.rationale ?? '';
    const macroHungry = /rate|inflation|fed|geopolit|macro|dxy|yield/i.test(rationale);
    const macroFinding = findings.find((f) => f.category === 'macro');
    const hasMacroEvidence = Boolean(
      macroFinding?.statement &&
        !/could not be refreshed|unavailable|no fresh headlines/i.test(macroFinding.statement),
    );

    if (
      thesis &&
      thesis.stopLossPct != null &&
      worstDrawdown > 0 &&
      thesis.stopLossPct < worstDrawdown
    ) {
      patterns.push({
        id: 'stop-tighter-than-drawdown',
        message: `Suggested stop ${thesis.stopLossPct.toFixed(1)}% is TIGHTER than the worst-case stress drawdown ${worstDrawdown.toFixed(1)}% — the stop gets shaken out before the downside resolves.`,
      });
    }

    if (macroHungry && !hasMacroEvidence) {
      patterns.push({
        id: 'macro-no-evidence',
        message:
          '7×24 weekend transmission hole: this thesis leans on a macro catalyst (rates/inflation/Fed/geopolitics/DXY) but rToken keeps pricing the US stock on-chain through the weekend while the underlying exchange is closed (Fri 4pm ET -> Mon open). A Saturday macro event transmits directly into the on-chain price with NO arb or halt window. State the weekend leg of the transmission chain (which on-chain feed carries it) or the thesis premise is unverified across 7×24 hours.',
      });
    }
    if (
      macroHungry &&
      hasMacroEvidence &&
      !/7x24|7×24|weekend|on-chain feed|closed/i.test(macroFinding?.statement ?? '')
    ) {
      patterns.push({
        id: 'macro-no-weekend-transmission',
        message:
          'Macro evidence exists for this tokenized US equity (rToken) but does not establish that the catalyst transmits through the 7×24 on-chain window (exchange closed Fri 4pm ET -> Mon open). A weekend-dated macro event would move the on-chain quote with no arb leg; verify the transmission chain covers calendar-, not just market-, hours.',
      });
    }

    if (plannedSkills > 0 && skillsCompleted < plannedSkills) {
      patterns.push({
        id: 'skills-coverage-gap',
        message: `Only ${skillsCompleted}/${plannedSkills} planned skills completed — coverage gap may skew the thesis.`,
      });
    }

    if (thesis && thesis.confidence >= 0.8 && skillsCompleted < 4) {
      patterns.push({
        id: 'high-confidence-thin-coverage',
        message: `Confidence is ${(thesis.confidence * 100).toFixed(0)}% but only ${skillsCompleted} skills completed — high conviction on thin coverage is a recurring bad-decision pattern.`,
      });
    }

    return patterns;
  }

  private buildChecklist(patterns: PatternFlag[]): ReusableChecklistItem[] {
    const list: ReusableChecklistItem[] = [];
    list.push({
      check: 'Is there a quantified expectation gap (guidance vs consensus vs whisper)?',
      why: 'The surprise is the gap, not the headline. Name the beat/miss specifically.',
    });
    list.push({
      check: 'Does the transmission chain link the catalyst to the asset, and hold across the 7×24 rToken window (weekend macro event while the US exchange is closed)?',
      why: 'Rate → flows → asset, or state "unclear". Do not imply one from vibes.',
    });
    if (patterns.some((p) => p.id === 'stop-tighter-than-drawdown'))
      list.push({
        check: 'Is the stop wider than the worst-case stress drawdown?',
        why: 'A stop inside the worst scenario gets shaken out prematurely.',
      });
    if (patterns.some((p) => p.id === 'macro-no-evidence' || p.id === 'macro-no-weekend-transmission'))
      list.push({
        check: 'Is the macro premise backed by live macro evidence?',
        why: 'Macro-leaning theses need a verified statement, not a vibe.',
      });
    if (patterns.some((p) => p.id === 'skills-coverage-gap' || p.id === 'high-confidence-thin-coverage'))
      list.push({
        check: 'Are all planned skills completed before locking confidence?',
        why: 'Partial coverage skews the thesis.',
      });
    return list;
  }

  private composeRecap(thesis: NormalizedThesis | null): string {
    if (!thesis) return 'No thesis produced — review is limited to skill coverage.';
    const stress = thesis.stressTests ?? [];
    const worst = stress.reduce((m, s) => Math.max(m, s.maxDrawdown ?? 0), 0);
    return (
      `Direction ${thesis.direction} · confidence ${Math.round(thesis.confidence * 100)}%` +
      (worst > 0 ? ` · worst-case stress drawdown ${worst.toFixed(1)}%` : '') +
      (thesis.stopLossPct != null ? ` · suggested stop ${thesis.stopLossPct.toFixed(1)}%` : '')
    );
  }

  private composeMarkdown(
    recap: string,
    patterns: PatternFlag[],
    checklist: ReusableChecklistItem[],
    plannedSkills: number,
    skillsCompleted: number,
    recurring: RecurringPattern[],
  ): string {
    const lines = [recap, ''];
    lines.push(patterns.length ? '**Bad-decision patterns flagged:**' : '**No adverse patterns flagged.**');
    lines.push(
      ...(patterns.length
        ? patterns.map((p) => `- ${p.message}`)
        : ['- Coverage and risk posture look sound for this idea.']),
    );
    if (recurring.length) {
      lines.push('', '**Recurring across your research history:**');
      lines.push(
        ...recurring.map(
          (r) =>
            `- ⚠️ Repeated in ${r.occurrences}/${r.sessionsConsidered} of your recent reviewed sessions: ${r.message}`,
        ),
      );
    }
    lines.push('', '**Reusable checklist for the NEXT idea:**');
    lines.push(...checklist.map((c) => `- [ ] ${c.check} — ${c.why}`));
    lines.push('', `_${skillsCompleted}/${plannedSkills} planned skills completed; review composed by rules._`);
    return lines.join('\n');
  }
}
