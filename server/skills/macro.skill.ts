import { Injectable } from '@nestjs/common';
import { BaseSkill } from './base.skill';
import { ResearchContext, SkillResult } from './skill.types';
import { McpClientService } from '../market-data/mcp-client.service';
import { parseMcpJson, unwrapMcpPayload } from './mcp.util';
import { usEquityMarketStatus, UsMarketStatus } from '../research/market-hours';

interface MacroSnapshot {
  tenYearYield: number | null;
  threeMonthYield: number | null;
  vix: number | null;
  dxy: number | null;
  spxChangePct: number | null;
}

/**
 * Macro skill — global backdrop for risk assets.
 * Primary: bitget-signal `macro_indicators` / `rates_yields`.
 * Fallback: Yahoo quotes for 10Y (^TNX), 3M (^IRX), VIX, DXY, S&P —
 * so stock/rToken demos never show "unknown / unavailable".
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
    let indicators = await this.indicators();
    let rates = await this.rates();
    const crossAsset = isStock ? [] : await this.crossAsset(context);
    const usMarketWindow = this.marketWindow(context);

    let snapshot: MacroSnapshot | null = null;
    if (!this.hasLiveMacro(indicators, rates)) {
      snapshot = await this.yahooMacroSnapshot();
      if (snapshot) {
        this.lastSource = 'yahoo-macro';
        rates = {
          ...(rates ?? {}),
          tenYearYield: snapshot.tenYearYield,
          threeMonthYield: snapshot.threeMonthYield,
          vix: snapshot.vix,
          dxy: snapshot.dxy,
          spxChangePct: snapshot.spxChangePct,
          yieldCurve:
            snapshot.tenYearYield != null && snapshot.threeMonthYield != null
              ? snapshot.tenYearYield - snapshot.threeMonthYield
              : null,
        };
        indicators = {
          ...(indicators ?? {}),
          vix: snapshot.vix,
          dxy: snapshot.dxy,
        };
      }
    }

    const environment = this.assessEnvironment(indicators, rates, snapshot);
    const backdrop = {
      environment,
      indicators,
      rates,
      snapshot,
      crossAsset,
      usMarketWindow,
      source: this.lastSource,
    };

    const bits: string[] = [`Environment: ${environment}`];
    if (snapshot?.vix != null) bits.push(`VIX ${snapshot.vix.toFixed(1)}`);
    if (snapshot?.tenYearYield != null)
      bits.push(`10Y ${snapshot.tenYearYield.toFixed(2)}%`);
    if (snapshot?.dxy != null) bits.push(`DXY ${snapshot.dxy.toFixed(2)}`);
    if (usMarketWindow?.note) bits.push(usMarketWindow.note);

    const summary =
      this.lastSource === 'placeholder'
        ? 'Macro backdrop could not be refreshed from live sources.'
        : bits.join(' · ');

    return this.buildResult('macro', summary, backdrop);
  }

  private hasLiveMacro(
    indicators: Record<string, unknown> | null,
    rates: Record<string, unknown> | null,
  ): boolean {
    return this.hasNumericPayload(indicators) || this.hasNumericPayload(rates);
  }

  private hasNumericPayload(node: Record<string, unknown> | null): boolean {
    if (!node) return false;
    for (const v of Object.values(node)) {
      if (typeof v === 'number' && Number.isFinite(v)) return true;
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const obj = v as Record<string, unknown>;
        if (obj.error === '' || obj.error == null) {
          for (const nested of Object.values(obj)) {
            if (typeof nested === 'number' && Number.isFinite(nested)) return true;
            if (typeof nested === 'string' && Number.isFinite(Number(nested)))
              return true;
          }
        }
      }
    }
    return false;
  }

  private marketWindow(
    context: ResearchContext,
  ): (UsMarketStatus & { note: string | null }) | null {
    if (context.assetType !== 'us-stock') return null;
    const status = usEquityMarketStatus();
    const symbol = context.symbols[0] ?? 'This asset';
    const focusRtoken = context.preferences?.focus === 'rToken';

    if (status.isRegularSessionOpen) {
      const note = focusRtoken
        ? `${symbol}: cash session is open now, but an rToken thesis still needs a weekend/overnight transmission plan — Reality keeps pricing 7×24 after the cash close.`
        : null;
      return { ...status, note };
    }

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

  private async yahooMacroSnapshot(): Promise<MacroSnapshot | null> {
    const [tnx, irx, vix, dxy, spx] = await Promise.all([
      this.yahooMeta('^TNX'),
      this.yahooMeta('^IRX'),
      this.yahooMeta('^VIX'),
      this.yahooMeta('DX-Y.NYB'),
      this.yahooMeta('^GSPC'),
    ]);
    if (!tnx && !vix && !dxy) return null;
    return {
      tenYearYield: tnx?.price ?? null,
      threeMonthYield: irx?.price ?? null,
      vix: vix?.price ?? null,
      dxy: dxy?.price ?? null,
      spxChangePct: spx?.changePct ?? null,
    };
  }

  private async yahooMeta(
    symbol: string,
  ): Promise<{ price: number; changePct: number | null } | null> {
    try {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
          symbol,
        )}?interval=1d&range=5d`,
        {
          signal: AbortSignal.timeout(10_000),
          headers: { 'User-Agent': 'Mozilla/5.0' },
        },
      );
      const json = (await res.json()) as {
        chart?: {
          result?: Array<{
            meta?: {
              regularMarketPrice?: number;
              previousClose?: number;
              chartPreviousClose?: number;
            };
          }>;
        };
      };
      const meta = json?.chart?.result?.[0]?.meta;
      const price = Number(meta?.regularMarketPrice);
      if (!Number.isFinite(price) || price <= 0) return null;
      const prev = Number(meta?.previousClose ?? meta?.chartPreviousClose);
      const changePct =
        Number.isFinite(prev) && prev > 0
          ? ((price - prev) / prev) * 100
          : null;
      return { price, changePct };
    } catch {
      return null;
    }
  }

  private async indicators(): Promise<Record<string, unknown> | null> {
    try {
      const text = await this.mcp.callTool(
        'macro_indicators',
        { action: 'multi_indicator' },
        8,
      );
      const parsed = unwrapMcpPayload<Record<string, unknown>>(
        text,
        'alt_me_error',
      );
      if (parsed && this.hasNumericPayload(parsed)) {
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
      if (parsed && this.hasNumericPayload(parsed)) {
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
      if (parsed && !(parsed as { error?: unknown }).error) {
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
    snapshot: MacroSnapshot | null,
  ): string {
    const vix =
      snapshot?.vix ??
      this.pickNumber(rates, ['vix', 'VIX']) ??
      this.pickNumber(indicators, ['vix', 'VIX']);
    const tenY =
      snapshot?.tenYearYield ??
      this.pickNumber(rates, ['tenYearYield', 't10y', 'T10Y']);
    const dxy =
      snapshot?.dxy ?? this.pickNumber(rates, ['dxy', 'DXY']);
    const spx = snapshot?.spxChangePct;

    if (vix == null && tenY == null && dxy == null) {
      return 'unknown (live macro feed unavailable)';
    }

    // Simple risk regime from VIX + equity tape + dollar.
    if (vix != null && vix >= 25) return 'risk-off (elevated VIX)';
    if (vix != null && vix <= 15 && (spx == null || spx >= 0) && (dxy == null || dxy < 105))
      return 'risk-on (low vol)';
    if (spx != null && spx <= -1.5) return 'risk-off (equity weakness)';
    if (dxy != null && dxy >= 105) return 'mixed (strong dollar headwind)';
    if (tenY != null && tenY >= 4.5) return 'mixed (higher-for-longer rates)';
    return 'neutral';
  }

  private pickNumber(
    node: Record<string, unknown> | null,
    keys: string[],
  ): number | null {
    if (!node) return null;
    for (const k of keys) {
      const v = node[k];
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
    return null;
  }
}
