import { Injectable } from '@nestjs/common';
import { SkillResult } from '../skills/skill.types';

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
 * investment thesis using a transparent, rule-based signal model:
 * technical structure + momentum, market flow, crowd sentiment,
 * news tilt and macro backdrop.
 */
@Injectable()
export class ThesisService {
  build(results: SkillResult[], symbols: string[]): Thesis {
    const s = this.score(results);

    const direction: 'long' | 'short' | 'neutral' =
      s.score >= 0.7 ? 'long' : s.score <= -0.7 ? 'short' : 'neutral';
    const confidence = Math.max(
      0.15,
      Math.min(0.95, 0.45 + Math.abs(s.score) * 0.3 + (s.realSources / 5) * 0.2),
    );

    const rationale = this.rationale(s, symbols);
    const catalysts = s.longNote.length ? s.longNote.slice(0, 5) : ['No positive catalyst identified yet'];
    const risks = s.shortNote.length ? s.shortNote.slice(0, 5) : ['Data coverage too thin to identify risks yet'];

    const marketWindowNote = this.marketWindowNote(results);
    if (marketWindowNote) risks.unshift(marketWindowNote);
    if (risks.length > 5) risks.length = 5;

    return {
      symbols,
      direction,
      confidence,
      rationale,
      catalysts,
      risks,
      signals: { score: s.score, longNotes: s.longNote, shortNotes: s.shortNote },
      generatedAt: new Date().toISOString(),
    };
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

    // --- Technical ---
    const setup = technical?.data?.['setups']?.[0];
    if (technical && setup) {
      const verdict = String(setup['verdict'] ?? '').toUpperCase();
      if (verdict === 'BULLISH') {
        out.score += 1.2;
        out.longNote.push(`Technical structure is bullish (MACD/trend confirmation on ${technical.summary})`);
      } else if (verdict === 'BEARISH') {
        out.score -= 1.2;
        out.shortNote.push('Technical structure is bearish');
      }
      const rsi = Number(setup['rsi']?.['rsi']);
      if (Number.isFinite(rsi)) {
        if (rsi > 70) {
          out.score -= 0.4;
          out.shortNote.push(`RSI at ${rsi.toFixed(0)} signals overbought conditions`);
        } else if (rsi < 30) {
          out.score += 0.4;
          out.longNote.push(`RSI at ${rsi.toFixed(0)} signals oversold / rebound potential`);
        } else if (rsi > 55) {
          out.score += 0.3;
          out.longNote.push(`RSI at ${rsi.toFixed(0)} shows positive momentum`);
        } else if (rsi < 45) {
          out.score -= 0.3;
          out.shortNote.push(`RSI at ${rsi.toFixed(0)} shows fading momentum`);
        }
      }
      const bb = String(setup['bollinger']?.['position'] ?? '');
      if (bb === 'above_upper') {
        out.shortNote.push('Price has extended above the upper Bollinger band');
      } else if (bb === 'below_lower') {
        out.longNote.push('Price has reached the lower Bollinger band');
      }
      out.realSources += 1;
    }

    // --- Market ---
    const stats = market?.data?.['globalStats'];
    if (market && stats) {
      const change = Number(stats['change_24h'] ?? 0);
      const price = Number(stats['price'] ?? 0);
      if (price > 0) {
        if (change >= 2) {
          out.score += 0.5;
          out.longNote.push(`Strong 24h momentum (${change.toFixed(1)}%)`);
        } else if (change > 0) {
          out.score += 0.2;
          out.longNote.push('Broad market tape is mildly positive');
        } else if (change <= -2) {
          out.score -= 0.5;
          out.shortNote.push(`Broad market tape is down ${Math.abs(change).toFixed(1)}% today`);
        } else if (change < 0) {
          out.score -= 0.2;
          out.shortNote.push('Broad market tape is mildly negative');
        }
      }
      out.realSources += 1;
    }

    // --- Sentiment ---
    const fng = sentiment?.data?.['fearAndGreed']?.['value'];
    if (sentiment && Number.isFinite(Number(fng))) {
      const value = Number(fng);
      if (value >= 75) {
        out.score += 0.3;
        out.shortNote.push(`Sentiment is euphoric (Fear & Greed ${value}) - limited upside left`);
      } else if (value >= 55) {
        out.score += 0.4;
        out.longNote.push(`Market sentiment is constructive (Fear & Greed ${value})`);
      } else if (value >= 45) {
        out.longNote.push('Sentiment is neutral');
      } else if (value >= 25) {
        out.score -= 0.4;
        out.shortNote.push(`Fear is elevated (Fear & Greed ${value}) - contrarian buying zone`);
      } else {
        out.score += 0.3;
        out.longNote.push(`Extreme fear (Fear & Greed ${value}) often marks better entry zones`);
      }
      out.realSources += 1;
    }

    // --- News tilt ---
    const headlines = (news?.data?.['headlines'] ?? []) as Array<{
      sentiment?: string;
      title: string;
    }>;
    if (news && headlines.length) {
      const pos = headlines.filter((h) => String(h.sentiment).toLowerCase() === 'positive');
      const neg = headlines.filter((h) => String(h.sentiment).toLowerCase() === 'negative');
      const tilt = (pos.length - neg.length) / headlines.length;
      out.score += tilt * 0.6;
      if (tilt > 0.2) {
        out.longNote.push('Recent news flow is skewed positive');
        for (const h of pos.slice(0, 2)) out.longNote.push(h.title);
      } else if (tilt < -0.2) {
        out.shortNote.push('Recent news flow is skewed negative');
        for (const h of neg.slice(0, 2)) out.shortNote.push(h.title);
      }
      out.realSources += 1;
    }

    // --- Macro ---
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

    return out;
  }

  private rationale(s: SignalScoring, symbols: string[]): string {
    const asset = symbols.join(', ');
    const tone =
      s.score >= 0.7
        ? 'constructive bullish'
        : s.score <= -0.7
          ? 'defensive bearish'
          : 'mixed / neutral';
    const real = `based on ${s.realSources} of 5 live data signals`;
    return `${asset} currently shows a ${tone} structure ${real}. ` +
      (s.longNote[0]
        ? `On the positive side, ${this.trim(s.longNote[0])}. `
        : 'No strong bullish signal is present yet. ') +
      (s.shortNote[0]
        ? `On the downside, ${this.trim(s.shortNote[0])}. `
        : 'The bearish case is not well supported right now. ') +
      'Keep a defined risk level and revisit as new data lands.';
  }

  /**
   * Surfaces the macro skill's US-market-hours note (if any) so a research
   * run on a US stock / rToken proactively flags the 7×24 weekend/overnight
   * transmission risk in the live thesis, not just in the after-the-fact
   * self-evolution review.
   */
  private marketWindowNote(results: SkillResult[]): string | null {
    const macro = results.find((r) => r.skill === 'macro');
    const window = macro?.data?.['usMarketWindow'] as { note?: string | null } | undefined;
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