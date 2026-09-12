import { Injectable } from '@nestjs/common';
import { BaseSkill } from './base.skill';
import { ResearchContext, SkillResult } from './skill.types';
import { McpClientService } from '../market-data/mcp-client.service';
import { unwrapMcpPayload } from './mcp.util';

/**
 * Sentiment skill - crowd psychology and derivatives positioning.
 * Primary: Bitget datahub MCP `sentiment_index` (Fear & Greed) and
 * `derivatives_sentiment` (long/short, open interest, taker ratio).
 * Fallback: direct Fear & Greed API (keyless).
 */
@Injectable()
export class SentimentSkill extends BaseSkill {
  readonly name = 'sentiment';

  constructor(private readonly mcp: McpClientService) {
    super();
  }

  private lastSource = 'placeholder';

  async run(context: ResearchContext): Promise<SkillResult> {
    const fearAndGreed = await this.fearAndGreed();
    const derivatives = await this.derivatives(context);

    const data = {
      fearAndGreed,
      derivatives,
      source: this.lastSource,
    };

    return this.buildResult(
      'sentiment',
      `Crowd sentiment and derivatives positioning profiled for ${context.symbols.join(
        ', ',
      )}.`,
      data,
    );
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
      const value = Number(parsed?.['value'] ?? parsed?.['data']?.[0]?.['value']);
      if (Number.isFinite(value)) {
        this.lastSource = 'mcp';
        return { value, classification: parsed?.['classification'] as string ?? this.classify(value) };
      }
    } catch {
      // ignore
    }

    // Fallback: direct Fear & Greed API.
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
        return { value: Number(row.value), classification: row.value_classification };
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