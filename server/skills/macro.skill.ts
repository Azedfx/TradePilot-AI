import { Injectable } from '@nestjs/common';
import { BaseSkill } from './base.skill';
import { ResearchContext, SkillResult } from './skill.types';
import { McpClientService } from '../market-data/mcp-client.service';
import { parseMcpJson, unwrapMcpPayload } from './mcp.util';

/**
 * Macro skill - the global economic backdrop for risk assets.
 * Primary: Bitget datahub MCP `macro_indicators` (FRED), `rates_yields`
 * (yield curve / Fed funds / spreads) and `cross_asset` (BTC vs DXY, Nasdaq,
 * Gold, 10Y, VIX correlations).
 */
@Injectable()
export class MacroSkill extends BaseSkill {
  readonly name = 'macro';

  constructor(private readonly mcp: McpClientService) {
    super();
  }

  private lastSource = 'placeholder';

  async run(context: ResearchContext): Promise<SkillResult> {
    const indicators = await this.indicators();
    const rates = await this.rates();
    const crossAsset = await this.crossAsset(context);

    const backdrop = {
      environment: this.assessEnvironment(indicators, rates),
      indicators,
      rates,
      crossAsset,
      source: this.lastSource,
    };

    return this.buildResult(
      'macro',
      this.lastSource === 'mcp'
        ? 'Live macro dashboard assembled from FRED, Treasury yields and cross-asset correlations.'
        : 'Macro backdrop could not be refreshed from live sources; returning structured estimates.',
      backdrop,
    );
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