import { Injectable, Logger } from '@nestjs/common';
import { MarketDataService, Candle } from '../market-data/market-data.service';
import { ResearchRepository } from '../db/research.repository';

export interface SimilarScenarioMatch {
  eventId: string;
  symbol: string;
  eventType: string;
  eventDate: string;
  similarityScore: number;
  similarityExplanation: string;
  return1dPct: number | null;
  return5dPct: number | null;
  return20dPct: number | null;
  volatility20d: number | null;
}

/**
 * Decision stress-testing companion: mine historically similar regimes from
 * live candles (large 1d moves / drawdown troughs), persist them as
 * HistoricalEvent rows, and attach the closest matches to the session.
 */
@Injectable()
export class SimilarScenariosService {
  private readonly logger = new Logger(SimilarScenariosService.name);

  constructor(
    private readonly marketData: MarketDataService,
    private readonly repo: ResearchRepository,
  ) {}

  async findAndAttach(
    sessionId: string,
    symbol: string,
    limit = 5,
  ): Promise<SimilarScenarioMatch[]> {
    const candles = await this.marketData.getCandles(symbol, '1d', 260);
    const closes = candles
      .map((c) => c.close)
      .filter((p) => Number.isFinite(p) && p > 0);
    if (closes.length < 40) return [];

    const featuresNow = this.currentFeatures(closes);
    const events = this.mineEvents(symbol, candles);
    if (!events.length) return [];

    const scored = events
      .map((ev) => {
        const score = this.similarity(featuresNow, {
          rsi: ev.rsi ?? 50,
          vol20: ev.volatility20d ?? 0,
          ret5: (ev.return5dPct ?? 0) / 100,
          vs200: (ev.priceVs200maPct ?? 0) / 100,
        });
        return { ev, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    const matches: SimilarScenarioMatch[] = [];
    for (const { ev, score } of scored) {
      try {
        const saved = await this.repo.upsertHistoricalEvent(ev);
        const explanation = this.explain(featuresNow, ev, score);
        await this.repo.addHistoricalMatch({
          sessionId,
          historicalEventId: saved.id,
          similarityScore: score,
          similarityExplanation: explanation,
        });
        matches.push({
          eventId: saved.id,
          symbol: saved.symbol,
          eventType: saved.eventType,
          eventDate: saved.eventDate.toISOString(),
          similarityScore: score,
          similarityExplanation: explanation,
          return1dPct: saved.return1dPct,
          return5dPct: saved.return5dPct,
          return20dPct: saved.return20dPct,
          volatility20d: saved.volatility20d,
        });
      } catch (error) {
        this.logger.warn(`Failed to persist similar scenario: ${String(error)}`);
      }
    }
    return matches;
  }

  private currentFeatures(closes: number[]) {
    const rsi = this.rsi(closes, 14);
    const vol20 = this.realizedVol(closes.slice(-21));
    const ret5 =
      closes.length > 5 ? closes[closes.length - 1] / closes[closes.length - 6] - 1 : 0;
    const ma200 =
      closes.length >= 200
        ? closes.slice(-200).reduce((a, b) => a + b, 0) / 200
        : closes.reduce((a, b) => a + b, 0) / closes.length;
    const vs200 = ma200 > 0 ? closes[closes.length - 1] / ma200 - 1 : 0;
    return { rsi, vol20, ret5, vs200 };
  }

  private mineEvents(
    symbol: string,
    candles: Candle[],
  ): Array<{
    symbol: string;
    eventType: string;
    eventDate: Date;
    rsi?: number;
    priceVs200maPct?: number;
    return1dPct?: number;
    return5dPct?: number;
    return20dPct?: number;
    volatility20d?: number;
    metadata?: Record<string, unknown>;
  }> {
    const closes = candles.map((c) => c.close);
    const rets: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      if (closes[i - 1] > 0) rets.push(closes[i] / closes[i - 1] - 1);
      else rets.push(0);
    }
    const mean = rets.reduce((a, b) => a + b, 0) / Math.max(1, rets.length);
    const variance =
      rets.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, rets.length);
    const sigma = Math.sqrt(variance) || 0.01;
    const threshold = Math.max(0.025, 2 * sigma);

    const out: Array<{
      symbol: string;
      eventType: string;
      eventDate: Date;
      rsi?: number;
      priceVs200maPct?: number;
      return1dPct?: number;
      return5dPct?: number;
      return20dPct?: number;
      volatility20d?: number;
      metadata?: Record<string, unknown>;
    }> = [];

    // Skip the most recent 5 bars so "now" is not matched to itself.
    for (let i = 25; i < candles.length - 5; i++) {
      const r1 = rets[i - 1] ?? 0;
      if (Math.abs(r1) < threshold) continue;

      const slice = closes.slice(0, i + 1);
      const rsi = this.rsi(slice, 14);
      const vol20 = this.realizedVol(slice.slice(-21));
      const ret5 =
        i >= 5 && closes[i - 5] > 0 ? closes[i] / closes[i - 5] - 1 : 0;
      const ret20 =
        i >= 20 && closes[i - 20] > 0 ? closes[i] / closes[i - 20] - 1 : 0;
      const ma200 =
        slice.length >= 200
          ? slice.slice(-200).reduce((a, b) => a + b, 0) / 200
          : slice.reduce((a, b) => a + b, 0) / slice.length;
      const vs200 = ma200 > 0 ? closes[i] / ma200 - 1 : 0;

      // Forward returns from the event (what happened after).
      const fwd1 =
        i + 1 < closes.length && closes[i] > 0
          ? closes[i + 1] / closes[i] - 1
          : r1;
      const fwd5 =
        i + 5 < closes.length && closes[i] > 0
          ? closes[i + 5] / closes[i] - 1
          : ret5;
      const fwd20 =
        i + 20 < closes.length && closes[i] > 0
          ? closes[i + 20] / closes[i] - 1
          : ret20;

      out.push({
        symbol,
        eventType: r1 >= 0 ? 'shock-rally' : 'shock-selloff',
        eventDate: new Date(candles[i].ts),
        rsi,
        priceVs200maPct: vs200 * 100,
        return1dPct: fwd1 * 100,
        return5dPct: fwd5 * 100,
        return20dPct: fwd20 * 100,
        volatility20d: vol20,
        metadata: {
          triggerReturn1dPct: r1 * 100,
          close: closes[i],
          venueHint: 'bitget-reality-or-cash',
        },
      });
    }

    // Keep strongest shocks only (avoid flooding).
    return out
      .sort(
        (a, b) =>
          Math.abs(Number((b.metadata as { triggerReturn1dPct?: number })?.triggerReturn1dPct ?? 0)) -
          Math.abs(Number((a.metadata as { triggerReturn1dPct?: number })?.triggerReturn1dPct ?? 0)),
      )
      .slice(0, 40);
  }

  private similarity(
    now: { rsi: number; vol20: number; ret5: number; vs200: number },
    then: { rsi: number; vol20: number; ret5: number; vs200: number },
  ): number {
    const dRsi = Math.abs(now.rsi - then.rsi) / 50;
    const dVol =
      Math.abs(now.vol20 - then.vol20) / Math.max(0.01, now.vol20 + then.vol20);
    const dRet = Math.abs(now.ret5 - then.ret5) / 0.1;
    const dMa = Math.abs(now.vs200 - then.vs200) / 0.15;
    const distance = dRsi + dVol + dRet + dMa;
    return Math.max(0, Math.min(1, 1 - distance / 4));
  }

  private explain(
    now: { rsi: number; vol20: number; ret5: number; vs200: number },
    ev: {
      eventType: string;
      eventDate: Date;
      rsi?: number;
      return5dPct?: number;
      return20dPct?: number;
    },
    score: number,
  ): string {
    const date = ev.eventDate.toISOString().slice(0, 10);
    const fwd =
      ev.return5dPct != null
        ? ` Afterward: 5d ${ev.return5dPct >= 0 ? '+' : ''}${ev.return5dPct.toFixed(1)}%` +
          (ev.return20dPct != null
            ? `, 20d ${ev.return20dPct >= 0 ? '+' : ''}${ev.return20dPct.toFixed(1)}%.`
            : '.')
        : '';
    return (
      `${(score * 100).toFixed(0)}% similar to ${ev.eventType} on ${date} ` +
      `(RSI then ${ev.rsi?.toFixed(0) ?? 'n/a'} vs now ${now.rsi.toFixed(0)}).${fwd}`
    );
  }

  private rsi(closes: number[], period = 14): number {
    if (closes.length < period + 1) return 50;
    let gains = 0;
    let losses = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
      const d = closes[i] - closes[i - 1];
      if (d >= 0) gains += d;
      else losses -= d;
    }
    if (losses === 0) return 100;
    const rs = gains / losses;
    return 100 - 100 / (1 + rs);
  }

  private realizedVol(closes: number[]): number {
    if (closes.length < 3) return 0;
    const rets: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      if (closes[i - 1] > 0) rets.push(closes[i] / closes[i - 1] - 1);
    }
    if (!rets.length) return 0;
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
    const variance =
      rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length;
    return Math.sqrt(variance) * Math.sqrt(252);
  }
}
