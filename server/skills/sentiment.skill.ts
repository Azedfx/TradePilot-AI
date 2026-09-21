import { Injectable } from '@nestjs/common';
import { BaseSkill } from './base.skill';
import { ResearchContext, SkillResult } from './skill.types';
import { McpClientService } from '../market-data/mcp-client.service';
import { MarketDataService } from '../market-data/market-data.service';
import { unwrapMcpPayload } from './mcp.util';

const BULLISH = [
  'beat',
  'surge',
  'soar',
  'rally',
  'upgrade',
  'record',
  'bullish',
  'outperform',
  'undervalued',
  'buy',
  'growth',
  'breakthrough',
  'raises',
  'strong',
  'optimistic',
];
const BEARISH = [
  'miss',
  'plunge',
  'crash',
  'downgrade',
  'lawsuit',
  'bearish',
  'avoid',
  'sell',
  'cut',
  'weak',
  'warning',
  'probe',
  'recall',
  'layoff',
  'overvalued',
  'risk',
];

/**
 * Sentiment skill.
 * Crypto: Fear & Greed + derivatives L/S via bitget-signal.
 * US stocks / rTokens: headline tone + Reality/cash tape momentum
 * (crypto F&G is not mislabelled as equity sentiment).
 */
@Injectable()
export class SentimentSkill extends BaseSkill {
  readonly name = 'sentiment';

  constructor(
    private readonly mcp: McpClientService,
    private readonly marketData: MarketDataService,
  ) {
    super();
  }

  private lastSource = 'placeholder';

  async run(context: ResearchContext): Promise<SkillResult> {
    const isStock = context.assetType === 'us-stock';

    if (isStock) {
      return this.runEquitySentiment(context);
    }

    const fearAndGreed = await this.fearAndGreed();
    const derivatives = await this.derivatives(context);

    return this.buildResult(
      'sentiment',
      `Crowd sentiment and derivatives positioning profiled for ${context.symbols.join(
        ', ',
      )}.`,
      {
        fearAndGreed,
        derivatives,
        source: this.lastSource,
      },
    );
  }

  private async runEquitySentiment(
    context: ResearchContext,
  ): Promise<SkillResult> {
    const symbol = context.symbols[0] ?? 'STOCK';
    const [headlines, ticker] = await Promise.all([
      this.fetchHeadlines(symbol),
      this.marketData.getTicker(symbol).catch(() => null),
    ]);

    const tone = this.scoreHeadlines(headlines);
    const change24h = ticker?.change24h ?? null;
    const momentum =
      change24h == null
        ? 'unknown'
        : change24h >= 2
          ? 'strong-up'
          : change24h <= -2
            ? 'strong-down'
            : change24h >= 0.5
              ? 'mild-up'
              : change24h <= -0.5
                ? 'mild-down'
                : 'flat';

    let positioning: 'risk-on' | 'risk-off' | 'mixed' | 'neutral' = 'neutral';
    if (tone.label === 'bullish' && (change24h ?? 0) >= 0) positioning = 'risk-on';
    else if (tone.label === 'bearish' && (change24h ?? 0) <= 0)
      positioning = 'risk-off';
    else if (tone.label !== 'neutral' || Math.abs(change24h ?? 0) >= 1.5)
      positioning = 'mixed';

    this.lastSource =
      headlines.length > 0 ? 'headline-tone+tape' : 'tape-only';

    const data = {
      symbol,
      tone: tone.label,
      toneScore: tone.score,
      bullishHits: tone.bullish,
      bearishHits: tone.bearish,
      sampleHeadlines: headlines.slice(0, 4),
      change24h,
      momentum,
      positioning,
      venue: ticker?.venue ?? null,
      rTokenSymbol: ticker?.rTokenSymbol ?? null,
      source: this.lastSource,
      guidance:
        'Equity sentiment = news headline tone + live tape momentum (not crypto Fear & Greed).',
    };

    const summary =
      `${symbol} sentiment ${tone.label} (score ${tone.score >= 0 ? '+' : ''}${tone.score})` +
      (change24h != null
        ? ` · tape ${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}% (${momentum})`
        : '') +
      ` · positioning ${positioning}`;

    return this.buildResult('sentiment', summary, data);
  }

  private async fetchHeadlines(symbol: string): Promise<string[]> {
    const base = this.marketData.equityBase(symbol);
    const q = encodeURIComponent(`${base} stock OR ${base}`);
    try {
      const res = await fetch(
        `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`,
        {
          signal: AbortSignal.timeout(10_000),
          headers: { 'User-Agent': 'Mozilla/5.0' },
        },
      );
      const xml = await res.text();
      const titles = [...xml.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>/g)]
        .map((m) => m[1]?.trim())
        .filter((t): t is string => Boolean(t) && !/^Google News$/i.test(t));
      // First match is often the feed title.
      return titles.slice(1, 9);
    } catch {
      return [];
    }
  }

  private scoreHeadlines(titles: string[]): {
    label: 'bullish' | 'bearish' | 'neutral';
    score: number;
    bullish: number;
    bearish: number;
  } {
    let bullish = 0;
    let bearish = 0;
    for (const title of titles) {
      const t = title.toLowerCase();
      for (const w of BULLISH) if (t.includes(w)) bullish += 1;
      for (const w of BEARISH) if (t.includes(w)) bearish += 1;
    }
    const score = bullish - bearish;
    const label =
      score >= 2 ? 'bullish' : score <= -2 ? 'bearish' : 'neutral';
    return { label, score, bullish, bearish };
  }

  private async fearAndGreed(): Promise<{
    value: number;
    classification: string;
  } | null> {
    try {
      const text = await this.mcp.callTool(
        'sentiment_index',
        { action: 'current' },
        8,
      );
      const parsed = unwrapMcpPayload<Record<string, unknown>>(text);
      const value = Number(
        parsed?.['value'] ??
          (parsed?.['data'] as Array<{ value?: unknown }> | undefined)?.[0]
            ?.value,
      );
      if (Number.isFinite(value)) {
        this.lastSource = 'mcp';
        return {
          value,
          classification:
            (parsed?.['classification'] as string) ?? this.classify(value),
        };
      }
    } catch {
      // ignore
    }

    try {
      const res = await fetch('https://api.alternative.me/fng/?limit=1', {
        signal: AbortSignal.timeout(10_000),
      });
      const json = (await res.json()) as {
        data?: Array<{ value: string; value_classification: string }>;
      };
      const row = json.data?.[0];
      if (row) {
        this.lastSource = 'fear-greed-api';
        return {
          value: Number(row.value),
          classification: row.value_classification,
        };
      }
    } catch {
      // ignore
    }
    return null;
  }

  private async derivatives(
    context: ResearchContext,
  ): Promise<Array<Record<string, unknown>>> {
    const out: Array<Record<string, unknown>> = [];
    for (const symbol of context.symbols.slice(0, 3)) {
      const pair = symbol.toUpperCase().includes('USDT')
        ? symbol.toUpperCase()
        : `${symbol.toUpperCase()}USDT`;
      try {
        const text = await this.mcp.callTool(
          'derivatives_sentiment',
          {
            action: 'long_short',
            symbol: pair,
            period: '4h',
          },
          8,
        );
        const parsed = unwrapMcpPayload<Record<string, unknown>>(text);
        if (parsed) {
          this.lastSource = 'mcp';
          out.push({
            symbol,
            longShortRatio: parsed['longShortRatio'] ?? parsed,
            source: 'mcp',
          });
          continue;
        }
      } catch {
        // ignore
      }
      out.push({
        symbol,
        fundingRate: null,
        openInterest: null,
        longShortRatio: null,
        takerBuySellRatio: null,
        source: 'unavailable',
      });
    }
    return out;
  }

  private classify(value: number): string {
    if (value <= 25) return 'Extreme Fear';
    if (value <= 45) return 'Fear';
    if (value <= 55) return 'Neutral';
    if (value <= 75) return 'Greed';
    return 'Extreme Greed';
  }
}
