import { Injectable } from '@nestjs/common';
import { BaseSkill } from './base.skill';
import { ResearchContext, SkillResult } from './skill.types';
import { McpClientService } from '../market-data/mcp-client.service';
import { MarketDataService } from '../market-data/market-data.service';
import { parseMcpJson } from './mcp.util';

/**
 * Market skill - market structure and institutional/flow activity. This
 * workbench is US-stock / rToken-first: primary quote is Bitget Reality
 * (r*USDT), with a thin cash-equity compare (Yahoo/MCP). Crypto research
 * (when explicitly detected) still uses Bitget datahub MCP `crypto_market`
 * + `network_status`.
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
    const isStock = context.assetType === 'us-stock';
    const globalStats = await this.globalStats(context, isStock);
    const flows = await this.institutionalFlows(context);
    const onChain = isStock ? null : await this.onChainActivity();

    const data = {
      globalStats,
      flows,
      onChain,
      source: this.lastSource,
    };

    return this.buildResult(
      'market',
      isStock
        ? `Assessed market structure and flow activity for ${context.symbols.length} US stock symbol(s).`
        : `Assessed market structure, institutional flows and on-chain activity for ${context.symbols.length} symbol(s).`,
      data,
    );
  }

  private lastSource = 'placeholder';

  private async globalStats(
    context: ResearchContext,
    isStock: boolean,
  ): Promise<Record<string, unknown> | null> {
    if (!isStock) {
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
    }

    // Stock / rToken path (and crypto fallback): live quote for the primary symbol.
    try {
      const lead = context.symbols[0] ?? (isStock ? 'SPY' : 'BTC');
      const ticker = await this.marketData.getTicker(lead);
      if (ticker.last > 0) {
        this.lastSource =
          ticker.venue === 'bitget-reality'
            ? 'bitget-reality'
            : ticker.venue === 'yahoo' || ticker.venue === 'mcp'
              ? `cash-${ticker.venue}`
              : 'live-quote';
        const cash = ticker.cashEquity;
        let vsCashPct: number | null = null;
        if (cash && cash.last > 0 && ticker.venue === 'bitget-reality') {
          vsCashPct = ((ticker.last - cash.last) / cash.last) * 100;
        }
        return {
          symbol: lead,
          rTokenSymbol: ticker.rTokenSymbol ?? null,
          price: ticker.last,
          change_24h: ticker.change24h ?? 0,
          high_24h: ticker.high24h,
          low_24h: ticker.low24h,
          volume_24h: ticker.volume24h,
          venue: ticker.venue ?? null,
          cashEquity: cash
            ? {
                symbol: cash.symbol,
                price: cash.last,
                change_24h: cash.change24h ?? null,
                source: cash.source,
              }
            : null,
          rTokenVsCashPct: vsCashPct,
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
      const cash = ticker.cashEquity;
      out.push({
        symbol,
        rTokenSymbol: ticker.rTokenSymbol ?? null,
        lastPrice: ticker.last,
        volume24h: ticker.volume24h,
        high24h: ticker.high24h,
        low24h: ticker.low24h,
        venue: ticker.venue ?? null,
        cashLast: cash?.last ?? null,
        etfFlow24h: null,
        exchangeNetFlow24h: null,
        note:
          ticker.venue === 'bitget-reality'
            ? 'Primary: Bitget Reality rToken. Cash equity shown for closed-market / basis compare.'
            : 'Live ticker; Reality rToken listing unavailable for this symbol.',
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