import { Injectable } from '@nestjs/common';
import { BaseSkill } from './base.skill';
import { ResearchContext, SkillResult } from './skill.types';
import { McpClientService } from '../market-data/mcp-client.service';
import { UsStockMcpClientService } from '../market-data/us-stock-mcp.service';
import { MarketDataService } from '../market-data/market-data.service';
import { parseMcpJson } from './mcp.util';

/**
 * Fundamentals skill — US equity company / earnings / valuation context.
 *
 * Handbook Track 3 order:
 * 1. bitget-mcp-server (agent.bitget.com) — US quotes & fundamentals
 * 2. bitget-signal tradfi_news / global_data — crypto-side bridge + wiki
 * 3. Yahoo chart meta (52w) + optional FINNHUB_API_KEY
 * Plus live Bitget Reality basis vs cash.
 */
@Injectable()
export class FundamentalsSkill extends BaseSkill {
  readonly name = 'fundamentals';

  constructor(
    private readonly signalMcp: McpClientService,
    private readonly usMcp: UsStockMcpClientService,
    private readonly marketData: MarketDataService,
  ) {
    super();
  }

  private lastSource = 'placeholder';

  async run(context: ResearchContext): Promise<SkillResult> {
    const symbol = context.symbols[0] ?? 'SPY';
    const isStock = context.assetType !== 'crypto';

    if (!isStock) {
      return this.buildResult(
        'fundamentals',
        'Fundamentals skill is US-equity oriented; skipped for crypto research.',
        { applicable: false, source: 'not-applicable-for-crypto' },
      );
    }

    const [earningsRaw, company, companyNews, quoteMeta, wiki] =
      await Promise.all([
        this.fetchEarnings(symbol),
        this.fetchCompany(symbol),
        this.fetchCompanyNews(symbol),
        this.yahooMeta(symbol),
        this.wikiBlurb(symbol),
      ]);
    let earnings: unknown = earningsRaw;

    const cash = await this.marketData.getTicker(symbol).catch(() => null);
    let expectationGap = this.expectationGap(earnings);
    if (!expectationGap) {
      const finnhub = await this.finnhubEarnings(symbol);
      if (finnhub) {
        earnings = finnhub.rows;
        expectationGap = finnhub.gap;
        this.lastSource = 'finnhub';
      }
    }

    const rangePosition = this.rangePosition(quoteMeta);
    const rTokenBasis =
      cash?.venue === 'bitget-reality' && cash.cashEquity?.last
        ? ((cash.last - cash.cashEquity.last) / cash.cashEquity.last) * 100
        : null;

    const data = {
      symbol,
      earnings,
      company,
      companyNews,
      quoteMeta,
      wiki,
      rangePosition,
      venue: cash?.venue ?? null,
      rTokenSymbol: cash?.rTokenSymbol ?? null,
      lastPrice: cash?.last ?? quoteMeta?.price ?? null,
      cashEquity: cash?.cashEquity ?? null,
      rTokenVsCashPct: rTokenBasis,
      expectationGap,
      source: this.lastSource,
      usMcpReachable: this.usMcp.isReachable(),
    };

    const bits: string[] = [];
    if (expectationGap) bits.push(`Expectation gap: ${expectationGap.summary}`);
    if (rangePosition) bits.push(rangePosition.summary);
    if (rTokenBasis != null) {
      bits.push(
        `Bitget Reality basis ${rTokenBasis >= 0 ? '+' : ''}${rTokenBasis.toFixed(2)}% vs cash`,
      );
    }
    const summary =
      `Fundamentals for ${symbol} (${this.lastSource}).` +
      (bits.length ? ` ${bits.join(' · ')}` : '');

    return this.buildResult('fundamentals', summary, data);
  }

  /** Direct Finnhub when FINNHUB_API_KEY is set (beats empty MCP tradfi). */
  private async finnhubEarnings(symbol: string): Promise<{
    rows: unknown;
    gap: { summary: string; surprisePct: number | null };
  } | null> {
    const key = process.env.FINNHUB_API_KEY;
    if (!key) return null;
    try {
      const base = this.marketData.equityBase(symbol);
      const res = await fetch(
        `https://finnhub.io/api/v1/stock/earnings?symbol=${encodeURIComponent(
          base,
        )}&token=${encodeURIComponent(key)}`,
        { signal: AbortSignal.timeout(10_000) },
      );
      if (!res.ok) return null;
      const rows = (await res.json()) as unknown;
      const gap = this.expectationGap(rows);
      if (!gap) return null;
      return { rows, gap };
    } catch {
      return null;
    }
  }

  private rangePosition(
    meta: Record<string, number | string> | null,
  ): { pct: number; summary: string } | null {
    if (!meta) return null;
    const price = Number(meta.price);
    const hi = Number(meta.fiftyTwoWeekHigh);
    const lo = Number(meta.fiftyTwoWeekLow);
    if (!(price > 0 && hi > lo)) return null;
    const pct = ((price - lo) / (hi - lo)) * 100;
    return {
      pct,
      summary: `Trading at ${pct.toFixed(0)}th percentile of 52-week range ($${lo.toFixed(2)}–$${hi.toFixed(2)})`,
    };
  }

  private async fetchEarnings(symbol: string): Promise<unknown> {
    const us = await this.usMcp.callIntent('earnings', symbol, this.earningsWindow());
    if (us?.parsed && !(us.parsed as { error?: unknown }).error) {
      this.lastSource = 'bitget-mcp-server';
      return us.parsed;
    }
    return this.signalEarnings(symbol);
  }

  private async fetchCompany(symbol: string): Promise<unknown> {
    const us = await this.usMcp.callIntent('company', symbol);
    if (us?.parsed && !(us.parsed as { error?: unknown }).error) {
      this.lastSource = 'bitget-mcp-server';
      return us.parsed;
    }
    return this.signalCompany(symbol);
  }

  private async fetchCompanyNews(symbol: string): Promise<unknown[]> {
    const us = await this.usMcp.callIntent('news', symbol, { limit: 5 });
    if (us) {
      const items = this.asNewsArray(us.parsed);
      if (items.length > 0) {
        this.lastSource = 'bitget-mcp-server';
        return items.slice(0, 5);
      }
    }
    return this.signalCompanyNews(symbol);
  }

  private earningsWindow(): Record<string, string | number> {
    const to = new Date();
    const from = new Date();
    from.setMonth(from.getMonth() - 1);
    to.setMonth(to.getMonth() + 3);
    return {
      from_date: from.toISOString().slice(0, 10),
      to_date: to.toISOString().slice(0, 10),
      limit: 8,
    };
  }

  private async signalEarnings(symbol: string): Promise<unknown> {
    try {
      const text = await this.signalMcp.callTool(
        'tradfi_news',
        { action: 'earnings', symbol, ...this.earningsWindow() },
        10,
      );
      const parsed = parseMcpJson(text);
      if (parsed && !(parsed as { error?: unknown }).error) {
        this.lastSource = 'bitget-signal';
        return parsed;
      }
    } catch {
      // ignore
    }
    return null;
  }

  private async signalCompany(symbol: string): Promise<unknown> {
    try {
      const text = await this.signalMcp.callTool(
        'tradfi_news',
        { action: 'company', symbol },
        10,
      );
      const parsed = parseMcpJson(text);
      if (parsed && !(parsed as { error?: unknown }).error) {
        this.lastSource = 'bitget-signal';
        return parsed;
      }
    } catch {
      // ignore
    }
    return null;
  }

  private async signalCompanyNews(symbol: string): Promise<unknown[]> {
    try {
      const text = await this.signalMcp.callTool(
        'tradfi_news',
        { action: 'news', symbol, limit: 5 },
        10,
      );
      const parsed = parseMcpJson(text);
      const items = this.asNewsArray(parsed);
      if (items.length > 0) {
        this.lastSource = 'bitget-signal';
        return items.slice(0, 5);
      }
    } catch {
      // ignore
    }
    return [];
  }

  private asNewsArray(parsed: unknown): unknown[] {
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as { items?: unknown[]; news?: unknown[]; data?: unknown[] };
      if (Array.isArray(obj.items)) return obj.items;
      if (Array.isArray(obj.news)) return obj.news;
      if (Array.isArray(obj.data)) return obj.data;
    }
    return [];
  }

  private async yahooMeta(symbol: string): Promise<Record<string, number | string> | null> {
    try {
      const base = this.marketData.equityBase(symbol);
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
          base,
        )}?interval=1d&range=1y`,
        {
          signal: AbortSignal.timeout(12_000),
          headers: { 'User-Agent': 'Mozilla/5.0' },
        },
      );
      const json = (await res.json()) as {
        chart?: { result?: Array<{ meta?: Record<string, unknown> }> };
      };
      const meta = json?.chart?.result?.[0]?.meta;
      if (!meta) return null;
      if (this.lastSource === 'placeholder') this.lastSource = 'yahoo-meta';
      return {
        symbol: String(meta.symbol ?? base),
        price: Number(meta.regularMarketPrice ?? 0),
        fiftyTwoWeekHigh: Number(meta.fiftyTwoWeekHigh ?? 0),
        fiftyTwoWeekLow: Number(meta.fiftyTwoWeekLow ?? 0),
        currency: String(meta.currency ?? 'USD'),
        exchangeName: String(meta.exchangeName ?? ''),
      };
    } catch {
      return null;
    }
  }

  private async wikiBlurb(symbol: string): Promise<string | null> {
    try {
      const text = await this.signalMcp.callTool(
        'global_data',
        { action: 'wikipedia', query: `${symbol} company`, lang: 'en' },
        8,
      );
      const parsed = parseMcpJson(text) as { extract?: string; summary?: string } | null;
      const blurb = parsed?.extract ?? parsed?.summary;
      if (blurb && typeof blurb === 'string') {
        if (this.lastSource === 'placeholder') this.lastSource = 'bitget-signal';
        return blurb.slice(0, 400);
      }
    } catch {
      // ignore
    }
    return null;
  }

  private expectationGap(earnings: unknown): {
    summary: string;
    surprisePct: number | null;
  } | null {
    if (!earnings || typeof earnings !== 'object') return null;
    const rows = Array.isArray(earnings)
      ? earnings
      : Array.isArray((earnings as { earningsCalendar?: unknown[] }).earningsCalendar)
        ? (earnings as { earningsCalendar: unknown[] }).earningsCalendar
        : Array.isArray((earnings as { data?: unknown[] }).data)
          ? (earnings as { data: unknown[] }).data
          : [];
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const r = row as Record<string, unknown>;
      const actual = Number(r.epsActual ?? r.actual ?? r.eps);
      const estimate = Number(r.epsEstimate ?? r.estimate ?? r.consensus);
      if (Number.isFinite(actual) && Number.isFinite(estimate) && estimate !== 0) {
        const surprisePct = ((actual - estimate) / Math.abs(estimate)) * 100;
        const dir = surprisePct >= 0 ? 'beat' : 'miss';
        return {
          surprisePct,
          summary: `EPS actual ${actual} vs estimate ${estimate} → ${dir} ${surprisePct >= 0 ? '+' : ''}${surprisePct.toFixed(1)}%`,
        };
      }
      const date = r.date ?? r.reportDate ?? r.earningsDate;
      if (date) {
        return {
          surprisePct: null,
          summary: `Next / recent earnings date on calendar: ${String(date)}`,
        };
      }
    }
    return null;
  }
}
