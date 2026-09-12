import { Injectable } from '@nestjs/common';
import { Candle, MarketDataService } from '../market-data/market-data.service';

export interface HistoricalStats {
  symbol: string;
  interval: string;
  period: {
    start: string;
    end: string;
  };
  returns: {
    total: number;
    annualized: number;
  };
  volatilityAnnualized: number;
  maxDrawdown: number;
  range: {
    high: number;
    low: number;
  };
  sampleSize: number;
}

/**
 * Historical service - computes quantitative statistics over a symbol's
 * historical candles (returns, volatility, drawdown, range).
 */
@Injectable()
export class HistoricalService {
  constructor(private readonly marketData: MarketDataService) {}

  async compute(
    symbol: string,
    interval: string,
    limit = 200,
  ): Promise<HistoricalStats> {
    const candles = await this.marketData.getCandles(symbol, interval, limit);
    const closes = candles.map((c) => c.close);
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);

    const totalReturn =
      closes.length > 1 ? closes[closes.length - 1] / closes[0] - 1 : 0;
    const volatility = this.annualizedVolatility(closes, interval);
    const maxDrawdown = this.maxDrawdown(closes);

    return {
      symbol,
      interval,
      period: {
        start: new Date(candles[0]?.ts ?? 0).toISOString(),
        end: new Date(candles[candles.length - 1]?.ts ?? 0).toISOString(),
      },
      returns: {
        total: totalReturn,
        annualized: this.annualizedReturn(candles, interval),
      },
      volatilityAnnualized: volatility,
      maxDrawdown,
      range: {
        high: Math.max(...highs),
        low: Math.min(...lows),
      },
      sampleSize: candles.length,
    };
  }

  private annualizedVolatility(closes: number[], interval: string): number {
    if (closes.length < 2) return 0;
    const logReturns: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      logReturns.push(Math.log(closes[i] / closes[i - 1]));
    }
    const mean =
      logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
    const variance =
      logReturns.reduce((a, b) => a + (b - mean) ** 2, 0) /
      (logReturns.length - 1);
    const periodsPerYear = this.periodsPerYear(interval);
    return Math.sqrt(variance) * Math.sqrt(periodsPerYear);
  }

  private annualizedReturn(candles: Candle[], interval: string): number {
    if (candles.length < 2) return 0;
    const years =
      ((candles[candles.length - 1].ts - candles[0].ts) / 86_400_000) / 365;
    if (years <= 0) return 0;
    const total = candles[candles.length - 1].close / candles[0].close;
    return Math.pow(total, 1 / years) - 1;
  }

  private maxDrawdown(closes: number[]): number {
    let peak = closes[0] ?? 0;
    let maxDd = 0;
    for (const price of closes) {
      if (price > peak) peak = price;
      const dd = peak > 0 ? (price - peak) / peak : 0;
      if (dd < maxDd) maxDd = dd;
    }
    return maxDd;
  }

  private periodsPerYear(interval: string): number {
    const unit = interval.slice(-1);
    const value = Number(interval.slice(0, -1)) || 1;
    switch (unit) {
      case 'm':
        return (365 * 24 * 60) / value;
      case 'h':
        return (365 * 24) / value;
      case 'd':
        return 365 / value;
      case 'w':
        return 52 / value;
      default:
        return 365 / value;
    }
  }
}
