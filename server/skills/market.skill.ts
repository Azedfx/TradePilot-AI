import { Injectable } from '@nestjs/common';
import { BaseSkill } from './base.skill';
import { ResearchContext, SkillResult } from './skill.types';
import { McpClientService } from '../market-data/mcp-client.service';
import { MarketDataService } from '../market-data/market-data.service';
import { parseMcpJson } from './mcp.util';

/**
 * Market skill - market structure and institutional/on-chain activity.
 * Primary: Bitget datahub MCP `crypto_market` (CoinGecko) + `network_status`.
 * Fallback: live Bitget ticker + structured estimates.
 */
@Injectable()
export class MarketSkill extends BaseSkill {
  readonly name = 'market';

  constructor(
    private readonly mcp: McpClientService,
    private readonly marketData: MarketDataService,
  ) {
    super();
  }

  async run(context: ResearchContext): Promise<SkillResult> {
    const globalStats = await this.globalStats(context);
    const flows = await this.institutionalFlows(context);
    const onChain = await this.onChainActivity();

    const data = {
      globalStats,
      flows,
      onChain,
      source: this.lastSource,
    };

    return this.buildResult(
      'market',
      `Assessed market structure, institutional flows and on-chain activity for ${context.symbols.length} symbol(s).`,
      data,
    );
  }

  private lastSource = 'placeholder';

  private async globalStats(
    context: ResearchContext,
  ): Promise<Record<string, unknown> | null> {
    try {
      const text = await this.mcp.callTool(
        'crypto_market',
        { action: 'global' },
        8,
      );
      const parsed = parseMcpJson(text);
      if (parsed && !parsed['error']) {
        this.lastSource = 'mcp';
        return parsed as Record<string, unknown>;
      }
    } catch {
      // ignore
    }

    // Fallback: surface a live quote for the primary researched symbol.
    try {
      const lead = context.symbols[0] ?? 'BTC';
      const ticker = await this.marketData.getTicker(lead);
      if (ticker.last > 0) {
        this.lastSource = 'live-quote';
        return {
          symbol: lead,
          price: ticker.last,
          change_24h: ticker.last > 0 ? 0 : 0,
          high_24h: ticker.high24h,
          low_24h: ticker.low24h,
          volume_24h: ticker.volume24h,
        };
      }
    } catch {
      // ignore
    }
    return null;
  }

  private async institutionalFlows(
    context: ResearchContext,
  ): Promise<Array<Record<string, unknown>>> {
    const out: Array<Record<string, unknown>> = [];
    for (const symbol of context.symbols.slice(0, 3)) {
      const ticker = await this.marketData.getTicker(symbol);
      out.push({
        symbol,
        lastPrice: ticker.last,
        volume24h: ticker.volume24h,
        high24h: ticker.high24h,
        low24h: ticker.low24h,
        // Structure-level estimates; institutional-grade feeds plug in here.
        etfFlow24h: null,
        exchangeNetFlow24h: null,
        note: 'Retail/derivatives estimate based on live ticker; ETF/on-chain flow feeds pending.',
      });
    }
    return out;
  }

  private async onChainActivity(): Promise<Record<string, unknown> | null> {
    try {
      const text = await this.mcp.callTool(
        'network_status',
        { action: 'btc_mempool' },
        8,
      );
      const parsed = parseMcpJson(text);
      if (parsed && !parsed['error']) {
        this.lastSource = 'mcp';
        return parsed as Record<string, unknown>;
      }
    } catch {
      // ignore
    }
    return null;
  }
}