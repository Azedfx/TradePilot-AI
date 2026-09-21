import { Injectable, Logger } from '@nestjs/common';
import { DeskPreferences, ResearchContext, SkillResult } from '../skills/skill.types';
import { LlmService } from '../llm/llm.service';

export interface Thesis {
  symbols: string[];
  direction: 'long' | 'short' | 'neutral';
  confidence: number; // 0..1
  rationale: string;
  catalysts: string[];
  risks: string[];
  signals: Record<string, unknown>;
  generatedAt: string;
}

interface SignalScoring {
  count: number;
  realSources: number;
  score: number;
  longNote: string[];
  shortNote: string[];
}

/**
 * Thesis service - synthesises raw skill outputs into an actionable
 * investment thesis using a transparent, rule-based signal model, then
 * optionally enriches catalysts/risks with a short Qwen extraction pass.
 */
@Injectable()
export class ThesisService {
  private readonly logger = new Logger(ThesisService.name);

  constructor(private readonly llm: LlmService) {}

  async build(
    results: SkillResult[],
    symbols: string[],
    context?: ResearchContext,
  ): Promise<Thesis> {
    const s = this.score(results);
    const prefs = context?.preferences;

    let direction: 'long' | 'short' | 'neutral' =
      s.score >= 0.7 ? 'long' : s.score <= -0.7 ? 'short' : 'neutral';
    let confidence = Math.max(
      0.15,
      Math.min(0.95, 0.45 + Math.abs(s.score) * 0.3 + (s.realSources / 6) * 0.2),
    );

    if (prefs?.riskAppetite === 'conservative') {
      confidence = Math.max(0.15, confidence - 0.08);
      if (direction === 'long' && confidence < 0.55) direction = 'neutral';
    } else if (prefs?.riskAppetite === 'aggressive') {
      confidence = Math.min(0.95, confidence + 0.06);
    }

    let rationale = this.rationale(s, symbols, prefs);
    let catalysts = s.longNote.length
      ? s.longNote.slice(0, 5)
      : ['No positive catalyst identified yet'];
    let risks = s.shortNote.length
      ? s.shortNote.slice(0, 5)
      : ['Data coverage too thin to identify risks yet'];

    const marketWindowNote = this.marketWindowNote(results);
    if (marketWindowNote) risks.unshift(marketWindowNote);

    const fundGap = this.fundamentalsGap(results);
    if (fundGap) {
      if (/beat|\+/i.test(fundGap)) catalysts.unshift(fundGap);
      else risks.unshift(fundGap);
    }

    const enriched = await this.enrichWithLlm(results, symbols, context?.question);
    if (enriched) {
      if (enriched.catalysts?.length) {
        catalysts = [...enriched.catalysts, ...catalysts].slice(0, 6);
      }
      if (enriched.risks?.length) {
        risks = [...enriched.risks, ...risks].slice(0, 6);
      }
      if (enriched.rationaleAddendum) {
        rationale = `${rationale} ${enriched.rationaleAddendum}`;
      }
    }

    if (risks.length > 6) risks.length = 6;
    if (catalysts.length > 6) catalysts.length = 6;

    return {
      symbols,
      direction,
      confidence,
      rationale,
      catalysts,
      risks,
      signals: {
        score: s.score,
        longNotes: s.longNote,
        shortNotes: s.shortNote,
        preferences: prefs ?? null,
        llmEnriched: Boolean(enriched),
      },
      generatedAt: new Date().toISOString(),
    };
  }

  private async enrichWithLlm(
    results: SkillResult[],
    symbols: string[],
    question?: string,
  ): Promise<{
    catalysts?: string[];
    risks?: string[];
    rationaleAddendum?: string;
  } | null> {
    if (this.llm.provider === 'placeholder') return null;

    const digest = results.map((r) => ({
      skill: r.skill,
      summary: r.summary,
      data: JSON.stringify(r.data).slice(0, 600),
    }));

    try {
      const raw = await this.llm.complete(
        [
          {
            role: 'system',
            content:
              'You extract trading research signals as JSON only. ' +
              'Return {"catalysts":[string],"risks":[string],"rationaleAddendum":string}. ' +
              'Use ONLY provided evidence. Prefer earnings/expectation-gap and rToken vs cash basis when present. ' +
              'Max 3 catalysts and 3 risks. No markdown.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              symbols,
              question: question ?? null,
              evidence: digest,
            }),
          },
        ],
        { temperature: 0.1, maxTokens: 500, jsonMode: true, timeoutMs: 12_000, maxAttempts: 1 },
      );
      const parsed = JSON.parse(raw) as {
        catalysts?: string[];
        risks?: string[];
        rationaleAddendum?: string;
      };
      return {
        catalysts: Array.isArray(parsed.catalysts)
          ? parsed.catalysts.map(String).filter(Boolean).slice(0, 3)
          : undefined,
        risks: Array.isArray(parsed.risks)
          ? parsed.risks.map(String).filter(Boolean).slice(0, 3)
          : undefined,
        rationaleAddendum: parsed.rationaleAddendum
          ? String(parsed.rationaleAddendum).slice(0, 280)
          : undefined,
      };
    } catch (error) {
      this.logger.warn(`LLM thesis enrich skipped: ${String(error)}`);
      return null;
    }
  }

  private fundamentalsGap(results: SkillResult[]): string | null {
    const fund = results.find((r) => r.skill === 'fundamentals');
    const gap = fund?.data?.['expectationGap'] as
      | { summary?: string }
      | null
      | undefined;
    return gap?.summary ? String(gap.summary) : null;
  }

  private score(results: SkillResult[]): SignalScoring {
    const out: SignalScoring = {
      count: results.length,
      realSources: 0,
      score: 0,
      longNote: [],
      shortNote: [],
    };

    const technical = results.find((r) => r.skill === 'technical');
    const market = results.find((r) => r.skill === 'market');
    const sentiment = results.find((r) => r.skill === 'sentiment');
    const news = results.find((r) => r.skill === 'news');
    const macro = results.find((r) => r.skill === 'macro');
    const fundamentals = results.find((r) => r.skill === 'fundamentals');

    const setup = technical?.data?.['setups']?.[0];
    if (technical && setup) {
      const verdict = String(setup['verdict'] ?? '').toUpperCase();
      if (verdict === 'BULLISH') {
        out.score += 0.8;
        out.longNote.push('Technical structure is bullish');
      } else if (verdict === 'BEARISH') {
        out.score -= 0.8;
        out.shortNote.push('Technical structure is bearish');
      }
      const trend = String(setup['trend'] ?? '').toLowerCase();
      if (trend.includes('up') || trend === 'bullish') {
        out.score += 0.3;
        out.longNote.push(`Trend is ${trend}`);
      } else if (trend.includes('down') || trend === 'bearish') {
        out.score -= 0.3;
        out.shortNote.push(`Trend is ${trend}`);
      }
      const rsi = Number(
        typeof setup['rsi'] === 'object'
          ? (setup['rsi'] as { value?: number })?.['value']
          : setup['rsi'],
      );
      if (Number.isFinite(rsi)) {
        if (rsi >= 70) {
          out.score -= 0.2;
          out.shortNote.push(`RSI at ${rsi.toFixed(0)} shows fading momentum`);
        } else if (rsi <= 30) {
          out.score += 0.2;
          out.longNote.push(`RSI at ${rsi.toFixed(0)} is washed out`);
        }
      }
      out.realSources += 1;
    }

    const stats = market?.data?.['globalStats'] as Record<string, unknown> | undefined;
    if (market && stats) {
      const change = Number(stats['change_24h'] ?? 0);
      const price = Number(stats['price'] ?? 0);
      const venue = String(stats['venue'] ?? '');
      const rPair = String(stats['rTokenSymbol'] ?? '');
      const vsCash = Number(stats['rTokenVsCashPct']);
      const tapeLabel =
        venue === 'bitget-reality' ? 'Bitget Reality rToken tape' : 'Broad market tape';
      if (price > 0) {
        if (change >= 2) {
          out.score += 0.5;
          out.longNote.push(
            `Strong 24h momentum on ${tapeLabel} (${change.toFixed(1)}%)`,
          );
        } else if (change > 0) {
          out.score += 0.2;
          out.longNote.push(`${tapeLabel} is mildly positive`);
        } else if (change <= -2) {
          out.score -= 0.5;
          out.shortNote.push(
            `${tapeLabel} is down ${Math.abs(change).toFixed(1)}% today`,
          );
        } else if (change < 0) {
          out.score -= 0.2;
          out.shortNote.push(`${tapeLabel} is mildly negative`);
        }
      }
      if (venue === 'bitget-reality' && Number.isFinite(vsCash)) {
        const basis = `${vsCash >= 0 ? '+' : ''}${vsCash.toFixed(2)}%`;
        const pair = rPair || 'rToken';
        if (Math.abs(vsCash) >= 0.5) {
          out.shortNote.push(
            `${pair} trades ${basis} vs cash equity — watch closed-market / weekend basis risk`,
          );
        } else {
          out.longNote.push(
            `${pair} tracks cash equity closely (${basis} basis on Bitget Reality)`,
          );
        }
      }
      out.realSources += 1;
    }

    const fng = (sentiment?.data as { fearAndGreed?: { value?: number } } | undefined)
      ?.fearAndGreed?.value;
    if (sentiment && Number.isFinite(Number(fng))) {
      const value = Number(fng);
      if (value >= 75) {
        out.score += 0.3;
        out.shortNote.push(
          `Sentiment is euphoric (Fear & Greed ${value}) - limited upside left`,
        );
      } else if (value >= 55) {
        out.score += 0.4;
        out.longNote.push(`Market sentiment is constructive (Fear & Greed ${value})`);
      } else if (value >= 45) {
        out.longNote.push('Sentiment is neutral');
      } else if (value >= 25) {
        out.score -= 0.4;
        out.shortNote.push(
          `Fear is elevated (Fear & Greed ${value}) - contrarian buying zone`,
        );
      } else {
        out.score += 0.3;
        out.longNote.push(
          `Extreme fear (Fear & Greed ${value}) often marks better entry zones`,
        );
      }
      out.realSources += 1;
    }

    const headlines = (news?.data?.['headlines'] ?? []) as Array<{
      sentiment?: string;
      title: string;
    }>;
    if (news && headlines.length) {
      const pos = headlines.filter(
        (h) => String(h.sentiment).toLowerCase() === 'positive',
      );
      const neg = headlines.filter(
        (h) => String(h.sentiment).toLowerCase() === 'negative',
      );
      const tilt = (pos.length - neg.length) / headlines.length;
      out.score += tilt * 0.6;
      if (tilt > 0.2) {
        out.longNote.push('Recent news flow is skewed positive');
        for (const h of pos.slice(0, 2)) out.longNote.push(h.title);
      } else if (tilt < -0.2) {
        out.shortNote.push('Recent news flow is skewed negative');
        for (const h of neg.slice(0, 2)) out.shortNote.push(h.title);
      } else if (headlines[0]?.title) {
        out.longNote.push(headlines[0].title);
      }
      out.realSources += 1;
    }

    const env = String(macro?.data?.['environment'] ?? '');
    if (macro && env && !env.includes('unavailable')) {
      out.realSources += 1;
      if (/risk[- ]on|liquidity.*improv|accommodativ/i.test(env)) {
        out.score += 0.3;
        out.longNote.push('Macro backdrop is risk-on');
      } else if (/risk[- ]off|tighten|recession|hawkish/i.test(env)) {
        out.score -= 0.3;
        out.shortNote.push('Macro backdrop is risk-off');
      }
    }

    if (fundamentals && fundamentals.data?.['applicable'] !== false) {
      out.realSources += 1;
      const gap = fundamentals.data?.['expectationGap'] as
        | { surprisePct?: number | null; summary?: string }
        | null
        | undefined;
      if (gap?.surprisePct != null && Number.isFinite(gap.surprisePct)) {
        if (gap.surprisePct >= 0) {
          out.score += 0.35;
          out.longNote.push(String(gap.summary));
        } else {
          out.score -= 0.35;
          out.shortNote.push(String(gap.summary));
        }
      } else if (fundamentals.data?.['quoteMeta']) {
        out.longNote.push(
          'Cash equity quote/range context available for fundamentals',
        );
      }
    }

    return out;
  }

  private rationale(
    s: SignalScoring,
    symbols: string[],
    prefs?: DeskPreferences,
  ): string {
    const asset = symbols.join(', ');
    const tone =
      s.score >= 0.7
        ? 'constructive bullish'
        : s.score <= -0.7
          ? 'defensive bearish'
          : 'mixed / neutral';
    const real = `based on ${s.realSources} live data signals`;
    const focus =
      prefs?.focus && prefs.focus !== 'balanced'
        ? ` Desk focus is ${prefs.focus}.`
        : '';
    return (
      `${asset} currently shows a ${tone} structure ${real}.${focus} ` +
      (s.longNote[0]
        ? `On the positive side, ${this.trim(s.longNote[0])}. `
        : 'No strong bullish signal is present yet. ') +
      (s.shortNote[0]
        ? `On the downside, ${this.trim(s.shortNote[0])}. `
        : 'The bearish case is not well supported right now. ') +
      'Keep a defined risk level and revisit as new data lands.'
    );
  }

  private marketWindowNote(results: SkillResult[]): string | null {
    const macro = results.find((r) => r.skill === 'macro');
    const window = macro?.data?.['usMarketWindow'] as
      | { note?: string | null }
      | undefined;
    return window?.note ?? null;
  }

  private trim(text: string): string {
    return String(text)
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[.!?]+$/, '')
      .toLowerCase();
  }
}
