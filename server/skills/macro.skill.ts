import { Injectable } from '@nestjs/common';
import { BaseSkill } from './base.skill';
import { ResearchContext, SkillResult } from './skill.types';
import { McpClientService } from '../market-data/mcp-client.service';
import { parseMcpJson, unwrapMcpPayload } from './mcp.util';
import { usEquityMarketStatus, UsMarketStatus } from '../research/market-hours';

/**
 * Macro skill - the global economic backdrop for risk assets.
 * Primary: Bitget datahub MCP `macro_indicators` (FRED) and `rates_yields`
 * (yield curve / Fed funds / spreads) — these apply to any asset, including
 * US stocks. `cross_asset` (BTC vs DXY, Nasdaq, Gold, 10Y, VIX correlations)
 * is a crypto-centric tool (correlations are always computed against BTC as
 * the base asset) so it's skipped for stock research rather than showing an
 * off-topic crypto correlation table on a stock report; crypto research
 * (when explicitly detected) still uses it.
 */
@Injectable()
export class MacroSkill extends BaseSkill {
  readonly name = 'macro';

  constructor(private readonly mcp: McpClientService) {
    super();
  }

  private lastSource = 'placeholder';

  async run(context: ResearchContext): Promise<SkillResult> {
    const isStock = context.assetType === 'us-stock';
    const indicators = await this.indicators();
    const rates = await this.rates();
    const crossAsset = isStock ? [] : await this.crossAsset(context);
    const usMarketWindow = this.marketWindow(context);

    const backdrop = {
      environment: this.assessEnvironment(indicators, rates),
      indicators,
      rates,
      crossAsset,
      usMarketWindow,
      source: this.lastSource,
    };

    const summary =
      this.lastSource === 'mcp'
        ? 'Live macro dashboard assembled from FRED, Treasury yields and cross-asset correlations.'
        : 'Macro backdrop could not be refreshed from live sources; returning structured estimates.';

    return this.buildResult(
      'macro',
      usMarketWindow?.note ? `${summary} ${usMarketWindow.note}` : summary,
      backdrop,
    );
  }

  /**
   * When researching a US stock / tokenized rToken, flags whether the
   * underlying NYSE/Nasdaq cash market is currently open. This is the core
   * S2 scenario: rTokens keep pricing 7×24 while the exchange is closed
   * nights and weekends, so a macro catalyst can transmit with no arb or
   * halt window until the next regular session.
   */
  private marketWindow(
    context: ResearchContext,
  ): (UsMarketStatus & { note: string | null }) | null {
    if (context.assetType !== 'us-stock') return null;
    const status = usEquityMarketStatus();
    if (status.isRegularSessionOpen) return { ...status, note: null };

    const symbol = context.symbols[0] ?? 'This asset';
    const closedReason =
      status.session === 'closed-weekend'
        ? 'closed for the weekend'
        : status.session === 'pre-market'
          ? 'not yet open (pre-market)'
          : status.session === 'after-hours'
            ? 'closed for the day (after-hours)'
            : 'closed overnight';

    const note =
      `US cash market is ${closedReason} (${status.etClock}). If ${symbol} trades as a tokenized rToken, ` +
      `on-chain pricing continues 7×24 and can move on a macro/news catalyst with no arb or halt window ` +
      `until the market reopens ${status.nextOpenDescription}. Any macro-driven thesis should state how ` +
      `the transmission chain holds across calendar hours, not just NYSE hours.`;

    return { ...status, note };
  }

  private async indicators(): Promise<Record<string, unknown> | null> {
    try {
      const text = await this.mcp.callTool(
        'macro_indicators',
        { action: 'multi_indicator' },
        8,
      );
      const parsed = unwrapMcpPayload<Record<string, unknown>>(text, 'alt_me_error');
      if (parsed && Object.keys(parsed).length > 0) {
        this.lastSource = 'mcp';
        return parsed;
      }
    } catch {
      // ignore
    }
    return null;
  }

  private async rates(): Promise<Record<string, unknown> | null> {
    try {
      const text = await this.mcp.callTool(
        'rates_yields',
        { action: 'rates_snapshot' },
        8,
      );
      const parsed = unwrapMcpPayload<Record<string, unknown>>(text);
      if (parsed && Object.keys(parsed).length > 0) {
        this.lastSource = 'mcp';
        return parsed;
      }
    } catch {
      // ignore
    }
    return null;
  }

  private async crossAsset(
    context: ResearchContext,
  ): Promise<Array<Record<string, unknown>> | null> {
    try {
      const text = await this.mcp.callTool(
        'cross_asset',
        {
          action: 'correlation',
          base: 'btc',
          targets: 'gold,dxy,ndx,spx,t10y,vix',
          period: '90d',
        },
        8,
      );
      const parsed = parseMcpJson(text);
      if (parsed && !parsed['error']) {
        this.lastSource = 'mcp';
        const data = parsed as Record<string, unknown>;
        return Object.entries(data).map(([asset, value]) => ({
          asset,
          correlation: value,
        }));
      }
    } catch {
      // ignore
    }
    return [];
  }

  private assessEnvironment(
    indicators: Record<string, unknown> | null,
    rates: Record<string, unknown> | null,
  ): string {
    // Conservative: only claim a direction when we have live data hints.
    if (!indicators && !rates) return 'unknown (live macro feed unavailable)';
    return 'neutral';
  }
}