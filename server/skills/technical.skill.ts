import { Injectable } from '@nestjs/common';
import { BaseSkill } from './base.skill';
import { ResearchContext, SkillResult } from './skill.types';
import { McpClientService } from '../market-data/mcp-client.service';
import { MarketDataService, Candle } from '../market-data/market-data.service';
import { parseMcpJson } from './mcp.util';

/**
 * Technical skill - chart structure, indicators, support/resistance.
 * Primary: Bitget datahub MCP `technical_analysis` (full composite).
 * Fallback: live Bitget klines + locally computed RSI / MA / MACD in TS.
 */
@Injectable()
export class TechnicalSkill extends BaseSkill {
  readonly name = 'technical';

  constructor(
    private readonly mcp: McpClientService,
    private readonly marketData: MarketDataService,
  ) {
    super();
  }

  private lastSource = 'placeholder';

  async run(context: ResearchContext): Promise<SkillResult> {
    const setups: Array<Record<string, unknown>> = [];
    for (const symbol of context.symbols.slice(0, 5)) {
      const setup = await this.analyze(symbol, context.timeframe, context);
      setups.push(setup);
    }

    return this.buildResult(
      'technical',
      `Produced technical setups across ${setups.length} symbol(s) on the ${context.timeframe} timeframe (source: ${this.lastSource}).`,
      { setups, source: this.lastSource },
    );
  }

  private async analyze(
    symbol: string,
    timeframe: string,
    context?: ResearchContext,
  ): Promise<Record<string, unknown>> {
    const isStock =
      context?.assetType === 'us-stock' ||
      (!context?.assetType &&
        this.marketData.assetTypeOf(symbol) === 'us-stock');

    // US stocks: compute locally from live Yahoo OHLCV (no crypto-style MCP).
    if (isStock) {
      try {
        const candles = await this.marketData.getStockCandles(
          symbol,
          timeframe,
          200,
        );
        if (candles.length > 0) {
          const source = this.marketData.stockCandleSource();
          this.lastSource = source === 'mcp' ? 'mcp-global-assets' : 'yahoo-finance';
          return this.computeLocal(symbol, timeframe, candles);
        }
      } catch {
        // ignore
      }
      return {
        symbol,
        timeframe,
        trend: 'neutral',
        note: 'technical data unavailable',
      };
    }

    // Primary path: MCP full_analysis (crypto pairs only: BTC/USDT form).
    const pair = symbol.includes('/')
      ? symbol
      : `${symbol.toUpperCase()}/USDT`;
    try {
      const text = await this.mcp.callTool(
        'technical_analysis',
        {
          action: 'full_analysis',
          symbol: pair,
          timeframe,
        },
        40,
      );
      const parsed = parseMcpJson(text);
      if (parsed && !parsed['error']) {
        this.lastSource = 'mcp';
        return { symbol, timeframe, ...(parsed as Record<string, unknown>) };
      }
    } catch {
      // ignore
    }

    // Fallback: local indicators from live Bitget candles.
    try {
      const candles = await this.marketData.getCandles(symbol, timeframe, 200);
      if (candles.length > 0 && candles.some((c) => c.close > 0)) {
        this.lastSource = 'compute-bitget';
        return this.computeLocal(symbol, timeframe, candles);
      }
    } catch {
      // ignore
    }

    return {
      symbol,
      timeframe,
      trend: 'neutral',
      note: 'technical data unavailable',
    };
  }

  private computeLocal(
    symbol: string,
    timeframe: string,
    candles: Candle[],
  ): Record<string, unknown> {
    const closes = candles.map((c) => c.close);

    const rsi = this.rsi(closes, 14);
    const ma20 = this.sma(closes, 20);
    const ma50 = this.sma(closes, 50);
    const ema12 = this.ema(closes, 12);
    const { dif, dea } = this.macd(closes);
    const last = closes[closes.length - 1];

    const recentHigh = Math.max(...candles.slice(-20).map((c) => c.high));
    const recentLow = Math.min(...candles.slice(-20).map((c) => c.low));

    let trend: string;
    if (last > ma20 && last > ma50) trend = 'bullish';
    else if (last < ma20 && last < ma50) trend = 'bearish';
    else trend = 'neutral';

    return {
      symbol,
      timeframe,
      lastPrice: last,
      rsi: { value: Number(rsi.toFixed(2)), signal: this.rsiSignal(rsi) },
      macd: { dif: Number(dif), dea: Number(dea), signal: dif > dea ? 'bullish' : 'bearish' },
      ma: { ma20: Number(ma20.toFixed(2)), ma50: Number(ma50.toFixed(2)) },
      ema12: Number(ema12.toFixed(2)),
      support: Number(recentLow.toFixed(2)),
      resistance: Number(recentHigh.toFixed(2)),
      trend,
    };
  }

  private rsiSignal(rsi: number): string {
    if (rsi >= 70) return 'overbought';
    if (rsi <= 30) return 'oversold';
    return 'neutral';
  }

  private sma(values: number[], period: number): number {
    if (values.length < period) return values[values.length - 1] ?? 0;
    const slice = values.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  private ema(values: number[], period: number): number {
    const k = 2 / (period + 1);
    let ema = values[0] ?? 0;
    for (const v of values.slice(1)) ema = v * k + ema * (1 - k);
    return ema;
  }

  private rsi(values: number[], period: number): number {
    if (values.length < period + 1) return 50;
    let gains = 0;
    let losses = 0;
    for (let i = values.length - period; i < values.length; i++) {
      const change = values[i] - values[i - 1];
      if (change >= 0) gains += change;
      else losses -= change;
    }
    if (losses === 0) return 100;
    const rs = gains / period / (losses / period);
    return 100 - 100 / (1 + rs);
  }

  private macd(values: number[]): { dif: number; dea: number } {
    // Compute a DIF series (EMA12 - EMA26) then smooth with EMA9 for DEA.
    const k12 = 2 / 13;
    const k26 = 2 / 27;
    const k9 = 2 / 10;
    let e12 = values[0] ?? 0;
    let e26 = values[0] ?? 0;
    const difSeries: number[] = [];
    for (const v of values) {
      e12 = v * k12 + e12 * (1 - k12);
      e26 = v * k26 + e26 * (1 - k26);
      difSeries.push(e12 - e26);
    }
    let dea = difSeries[0] ?? 0;
    for (const d of difSeries.slice(1)) dea = d * k9 + dea * (1 - k9);
    return { dif: difSeries[difSeries.length - 1], dea };
  }
}