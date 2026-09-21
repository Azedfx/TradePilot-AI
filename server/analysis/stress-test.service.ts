import { Injectable } from '@nestjs/common';
import { Thesis } from './thesis.service';
import { MarketDataService } from '../market-data/market-data.service';

export interface StressResult {
  symbol: string;
  threat: number; // 0..1 likelihood-adjusted severity
  scenarios: {
    name: string;
    description: string;
    maxDrawdown: number;
    recoveryMonths: number;
  }[];
  recommendation: string;
}

interface VolStats {
  dailyVol: number;
  annualizedVol: number;
  sampleSize: number;
  lastPrice: number;
}

/**
 * Stress-test service - derives downside scenarios from the *live*
 * realized volatility of the asset (daily candle returns) and its thesis,
 * then quantifies drawdowns and estimated recovery time.
 */
@Injectable()
export class StressTestService {
  constructor(private readonly marketData: MarketDataService) {}

  async run(
    thesis: Thesis,
    symbols: string[],
  ): Promise<StressResult[]> {
    const out: StressResult[] = [];
    for (const symbol of symbols.slice(0, 5)) {
      const vol = await this.volatilityOf(symbol).catch(() => null);
      out.push(
        vol ? this.buildScenarios(symbol, thesis, vol) : this.estimateFallback(symbol, thesis),
      );
    }
    return out;
  }

  /** Compute realized daily volatility from live 30-day candles. */
  private async volatilityOf(symbol: string): Promise<VolStats> {
    const candles = await this.marketData.getCandles(symbol, '1d', 30);
    if (candles.length < 5) throw new Error('Not enough candles');

    const prices = candles.map((c) => c.close).filter((p) => p > 0);
    if (prices.length < 5) throw new Error('No price data');

    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push(prices[i] / prices[i - 1] - 1);
    }
    const mean =
      returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance =
      returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
    const dailyVol = Math.sqrt(variance);

    return {
      dailyVol,
      annualizedVol: dailyVol * Math.sqrt(252),
      sampleSize: returns.length,
      lastPrice: prices[prices.length - 1],
    };
  }

  private buildScenarios(
    symbol: string,
    thesis: Thesis,
    vol: VolStats,
  ): StressResult {
    // One-day moves sized in multiples of live realized vol.
    const v = vol.dailyVol;
    const scenarios = [
      {
        name: 'macro-shock',
        description: 'Liquidity-driven risk-off correction',
        multiple: 4.0,
      },
      {
        name: 'leverage-unwind',
        description: 'Margin-call driven deleveraging cascade',
        multiple: 5.5,
      },
      {
        name: 'bear-market',
        description: 'Sustained bear market drawdown',
        multiple: 8.0,
      },
    ];

    const mapped = scenarios.map((s) => {
      const shocked = Math.min(0.9, s.multiple * v);
      return {
        name: s.name,
        description: s.description,
        maxDrawdown: -shocked,
        recoveryMonths: Math.max(
          1,
          Math.round((shocked / Math.max(0.015, vol.annualizedVol)) * 12),
        ),
      };
    });

    const worstShock = Math.max(...mapped.map((m) => m.maxDrawdown));
    const threat = Math.min(
      0.95,
      Math.max(
        0.15,
        Math.abs(worstShock) * (1 - thesis.confidence) * 1.4,
      ),
    );

    return {
      symbol,
      threat,
      scenarios: mapped,
      recommendation: this.recommendation(symbol, thesis, worstShock, vol),
    };
  }

  /** Derive scenario workloads from the thesis without live candles. */
  private estimateFallback(
    symbol: string,
    thesis: Thesis,
  ): StressResult {
    const base = thesis.direction === 'neutral' ? 0.05 : 0.06;
    const scenarios = [
      {
        name: 'macro-shock',
        description: 'Liquidity-driven risk-off correction',
        maxDrawdown: -4 * base,
      },
      {
        name: 'leverage-unwind',
        description: 'Margin-call driven deleveraging cascade',
        maxDrawdown: -5.5 * base,
      },
      {
        name: 'bear-market',
        description: 'Sustained bear market drawdown',
        maxDrawdown: -8 * base,
      },
    ];
    const worstShock = Math.max(...scenarios.map((m) => m.maxDrawdown));
    return {
      symbol,
      threat: Math.min(0.9, Math.abs(worstShock) * (1 - thesis.confidence) * 1.4),
      scenarios: scenarios.map((m) => ({
        name: m.name,
        description: m.description,
        maxDrawdown: m.maxDrawdown,
        recoveryMonths: (1 - thesis.confidence) > 0.4 ? 6 : 3,
      })),
      recommendation:
        `Live volatility feed unavailable for ${symbol}; ` +
        `stress estimates are scaled off the thesis bias. ` +
        `Core recommendation: keep position size under ${Math.round(
          (1 - thesis.confidence) * 100,
        )}% of account and use a stop below the worst-case drawdown.`,
    };
  }

  private recommendation(
    symbol: string,
    thesis: Thesis,
    worstShock: number,
    vol: VolStats,
  ): string {
    const stop = Math.min(0.15, Math.abs(worstShock + 0.02));
    const size = Math.max(
      2,
      Math.min(20, Math.round((1 - thesis.confidence) * 30)),
    );
    return `Based on live Bitget Reality ${vol.sampleSize}-day volatility of ${(
      vol.annualizedVol * 100
    ).toFixed(1)}% annualized for ${symbol}, scenario drawdowns range from ` +
      `${(worstShock * 100).toFixed(1)}% to -${(stop * 100).toFixed(1)}%. ` +
      `Recommended max position: ${size}% of account with a hard stop at ` +
      `${(stop * 100).toFixed(1)}% below entry.`;
  }
}