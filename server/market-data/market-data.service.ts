import { Injectable, Optional } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { McpClientService } from './mcp-client.service';
import { UsStockMcpClientService } from './us-stock-mcp.service';

export interface Candle {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type MarketVenue =
  | 'bitget-reality'
  | 'yahoo'
  | 'mcp'
  | 'bitget-mcp-server'
  | 'bitget-spot'
  | 'none';

export interface CashEquityRef {
  symbol: string;
  last: number;
  change24h?: number;
  /** yahoo | bitget-mcp-server (US MCP) | mcp (bitget-signal global_assets) */
  source: 'yahoo' | 'bitget-mcp-server' | 'mcp';
}

export interface Ticker {
  symbol: string;
  last: number;
  bid: number;
  ask: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  change24h?: number;
  /** Where the primary quote came from. */
  venue?: MarketVenue;
  /** Bitget Reality pair when primary is an rToken (e.g. rNVDAUSDT). */
  rTokenSymbol?: string;
  /** Thin cash-equity reference for rToken vs native stock compare. */
  cashEquity?: CashEquityRef | null;
}

export interface MarketSnapshot {
  symbol: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  assetType: string;
  venue?: MarketVenue;
  rTokenSymbol?: string;
  cashEquity?: CashEquityRef | null;
  /** Basis vs cash equity: (rToken - cash) / cash * 100 when both exist. */
  rTokenVsCashPct?: number | null;
}

export interface NewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  summary?: string;
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        currency?: string;
        regularMarketPrice?: number;
        regularMarketDayHigh?: number;
        regularMarketDayLow?: number;
        regularMarketVolume?: number;
        regularMarketChangePercent?: number;
        previousClose?: number;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
  };
}

const BITGET_CANDLES_URL =
  'https://api.bitget.com/api/v2/spot/market/candles';

const KNOWN_CRYPTO = new Set([
  'BTC',
  'ETH',
  'XRP',
  'ADA',
  'DOGE',
  'SOL',
  'DOT',
  'LTC',
  'LINK',
  'MATIC',
  'AVAX',
  'SHIB',
  'UNI',
  'ATOM',
  'ETC',
  'XLM',
  'BCH',
  'TRX',
  'NEAR',
  'APT',
  'SUI',
  'BNB',
  'TON',
  'TIA',
  'SEI',
]);

const BITGET_GRANULARITY: Record<string, string> = {
  '1min': '1min',
  '5min': '5min',
  '15min': '15min',
  '30min': '30min',
  '1h': '1h',
  '4h': '4h',
  '6h': '6h',
  '12h': '12h',
  '1d': '1day',
  '1w': '1week',
  '1M': '1M',
};

/**
 * Market data service — US-stock / rToken research is Bitget Reality-first
 * (B2): live r*USDT pairs as primary market truth, with a thin cash-equity
 * quote (Yahoo / MCP) for rToken-vs-native compare. Crypto OHLCV still comes
 * from Bitget spot REST. Falls back to a deterministic placeholder when the
 * network/provider is unavailable.
 */
@Injectable()
export class MarketDataService {
  private mcp: McpClientService | null = null;
  private usMcp: UsStockMcpClientService | null = null;
  private stockProvider: MarketVenue = 'none';

  constructor(
    @Optional() mcp?: McpClientService,
    @Optional() usMcp?: UsStockMcpClientService,
  ) {
    this.mcp = mcp ?? null;
    this.usMcp = usMcp ?? null;
    if (!process.env.MARKET_DATA_PROVIDER) {
      process.env.MARKET_DATA_PROVIDER = 'bitget';
    }
  }

  /** Bind MCP clients (used by the standalone harness too). */
  attach(mcp: McpClientService, usMcp?: UsStockMcpClientService): void {
    this.mcp = mcp;
    if (usMcp) this.usMcp = usMcp;
  }

  /** Which provider served the last US-stock / rToken candle request. */
  stockCandleSource(): string {
    return this.stockProvider;
  }

  get provider(): string {
    return process.env.MARKET_DATA_PROVIDER!;
  }

  private bitgetSymbol(symbol: string): string {
    return symbol.toUpperCase().includes('USDT')
      ? symbol.toUpperCase()
      : `${symbol.toUpperCase()}USDT`;
  }

  /**
   * Underlying equity ticker (AAPL) from AAPL / rAAPL / rAAPLUSDT / RAAPLUSDT.
   */
  equityBase(symbol: string): string {
    let s = symbol.toUpperCase().trim();
    s = s.replace(/[-_/]/g, '');
    if (s.endsWith('USDT') || s.endsWith('USDC')) {
      s = s.slice(0, -4);
    }
    if (s.startsWith('R') && s.length > 1 && !KNOWN_CRYPTO.has(s.slice(1))) {
      // Reality pairs are listed as rAAPLUSDT → RAAPL after USDT strip.
      const maybe = s.slice(1);
      if (/^[A-Z]{1,5}$/.test(maybe)) return maybe;
    }
    return s;
  }

  /** Bitget Reality spot pair for a US equity (e.g. NVDA → rNVDAUSDT). */
  realitySymbol(symbol: string): string {
    return `r${this.equityBase(symbol)}USDT`;
  }

  /** Best-effort asset type classification. */
  assetTypeOf(symbol: string): 'crypto' | 'us-stock' {
    const clean = symbol.toUpperCase().replace(/^[0-9.]+(?=.)/, '');
    // Reality / tokenized US equities trade as r*USDT on Bitget spot.
    if (/^R[A-Z]{1,10}USDT$/i.test(clean)) return 'us-stock';
    if (KNOWN_CRYPTO.has(clean)) return 'crypto';
    if (KNOWN_CRYPTO.has(this.equityBase(clean)) && /USDT$/i.test(clean)) {
      return 'crypto';
    }
    if (/(?:USDT|USDC|BTC|ETH|USD[CT]?)$/.test(clean)) return 'crypto';
    return 'us-stock';
  }

  async getTicker(symbol: string): Promise<Ticker> {
    if (this.assetTypeOf(symbol) === 'us-stock') {
      return this.getStockQuote(symbol);
    }
    try {
      const row = await this.fetchBitgetTicker(this.bitgetSymbol(symbol));
      if (!row) throw new Error('ticker not found');
      return {
        symbol,
        ...row,
        venue: 'bitget-spot',
      };
    } catch {
      return {
        symbol,
        last: 0,
        bid: 0,
        ask: 0,
        high24h: 0,
        low24h: 0,
        volume24h: 0,
        change24h: 0,
        venue: 'none',
      };
    }
  }

  /** Compact market snapshot for a symbol (used by the research result). */
  async getMarketSnapshot(symbol: string): Promise<MarketSnapshot | null> {
    try {
      const t = await this.getTicker(symbol);
      if (!t.last) return null;
      const cash = t.cashEquity;
      let rTokenVsCashPct: number | null = null;
      if (cash && cash.last > 0 && t.venue === 'bitget-reality') {
        rTokenVsCashPct = ((t.last - cash.last) / cash.last) * 100;
      }
      return {
        symbol: this.equityBase(symbol),
        price: t.last,
        change24h: t.change24h ?? 0,
        high24h: t.high24h,
        low24h: t.low24h,
        volume24h: t.volume24h,
        assetType: this.assetTypeOf(symbol),
        venue: t.venue,
        rTokenSymbol: t.rTokenSymbol,
        cashEquity: cash ?? null,
        rTokenVsCashPct,
      };
    } catch {
      return null;
    }
  }

  /**
   * Live quote for US stocks / rTokens.
   * Primary: Bitget Reality (r*USDT). Secondary: cash equity (Yahoo / MCP).
   */
  private async getStockQuote(symbol: string): Promise<Ticker> {
    const base = this.equityBase(symbol);
    const rPair = this.realitySymbol(base);

    const [reality, cash] = await Promise.all([
      this.fetchBitgetTicker(rPair),
      this.getCashEquityQuote(base),
    ]);

    if (reality && reality.last > 0) {
      this.stockProvider = 'bitget-reality';
      return {
        symbol: base,
        ...reality,
        venue: 'bitget-reality',
        rTokenSymbol: rPair,
        cashEquity: cash,
      };
    }

    if (cash && cash.last > 0) {
      this.stockProvider = cash.source;
      return {
        symbol: base,
        last: cash.last,
        bid: cash.last,
        ask: cash.last,
        high24h: 0,
        low24h: 0,
        volume24h: 0,
        change24h: cash.change24h ?? 0,
        venue: cash.source,
        cashEquity: cash,
      };
    }

    this.stockProvider = 'none';
    return {
      symbol: base,
      last: 0,
      bid: 0,
      ask: 0,
      high24h: 0,
      low24h: 0,
      volume24h: 0,
      venue: 'none',
    };
  }

  private async fetchBitgetTicker(pair: string): Promise<{
    last: number;
    bid: number;
    ask: number;
    high24h: number;
    low24h: number;
    volume24h: number;
    change24h: number;
  } | null> {
    try {
      const tickerUrl = `https://api.bitget.com/api/v2/spot/market/tickers?symbol=${encodeURIComponent(
        pair,
      )}`;
      const res = await fetch(tickerUrl, {
        signal: AbortSignal.timeout(15_000),
      });
      const json = (await res.json()) as {
        code: string;
        data?: Array<{
          lastPr: string;
          bidPr: string;
          askPr: string;
          open: string;
          high24h: string;
          low24h: string;
          baseVolume: string;
          change24h?: string;
        }>;
      };
      const t = json.data?.[0];
      if (json.code !== '00000' || !t) return null;
      const last = Number(t.lastPr);
      if (!Number.isFinite(last) || last <= 0) return null;
      const open = Number(t.open);
      const changeFromApi = Number(t.change24h);
      return {
        last,
        bid: Number(t.bidPr) || last,
        ask: Number(t.askPr) || last,
        high24h: Number(t.high24h) || last,
        low24h: Number(t.low24h) || last,
        volume24h: Number(t.baseVolume) || 0,
        change24h: Number.isFinite(changeFromApi)
          ? changeFromApi * 100
          : open > 0
            ? ((last - open) / open) * 100
            : 0,
      };
    } catch {
      return null;
    }
  }

  /**
   * Thin cash-equity reference.
   * Order: bitget-mcp-server (handbook US MCP) → Yahoo → bitget-signal.
   */
  private async getCashEquityQuote(
    base: string,
  ): Promise<CashEquityRef | null> {
    if (this.usMcp && !this.usMcp.isDown()) {
      try {
        const hit = await this.usMcp.callIntent('quote', base);
        const price = hit ? this.findPrice(hit.parsed ?? hit.text) : null;
        if (price && price > 0) {
          return {
            symbol: base,
            last: price,
            source: 'bitget-mcp-server',
          };
        }
      } catch {
        // fall through
      }
    }

    try {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
          base,
        )}?interval=1d&range=5d`,
        {
          signal: AbortSignal.timeout(12_000),
          headers: { 'User-Agent': 'Mozilla/5.0' },
        },
      );
      const json = (await res.json()) as YahooChartResponse;
      const meta = json?.chart?.result?.[0]?.meta;
      const last = meta?.regularMarketPrice ?? meta?.previousClose ?? 0;
      if (meta?.symbol && last > 0) {
        return {
          symbol: base,
          last,
          change24h: meta.regularMarketChangePercent ?? 0,
          source: 'yahoo',
        };
      }
    } catch {
      // fall through to signal MCP
    }

    if (this.mcp) {
      const price = await this.signalStockPrice(base);
      if (price && price > 0) {
        return { symbol: base, last: price, source: 'mcp' };
      }
    }
    return null;
  }

  /** Last price via bitget-signal `global_assets`. */
  private async signalStockPrice(symbol: string): Promise<number | null> {
    try {
      const text = await this.mcp!.callTool(
        'global_assets',
        { action: 'price', symbol },
        10,
      );
      const parsed = this.parseMcpText(text);
      return this.findPrice(parsed);
    } catch {
      return null;
    }
  }

  /**
   * OHLCV: bitget-mcp-server first, then bitget-signal `global_assets`.
   */
  private async mcpStockCandles(
    symbol: string,
    interval: string,
    intervalLabel: string,
    range: string,
    limit: number,
  ): Promise<Candle[] | null> {
    if (this.usMcp && !this.usMcp.isDown()) {
      try {
        const hit = await this.usMcp.callIntent('ohlcv', symbol, {
          interval: intervalLabel,
          period: range,
          range,
        });
        if (hit) {
          const parsed = hit.parsed ?? this.parseMcpText(hit.text);
          const rows = this.findCandleRows(parsed);
          if (rows.length > 0) {
            this.stockProvider = 'bitget-mcp-server';
            return rows.slice(-limit);
          }
        }
      } catch {
        // fall through to signal
      }
    }

    if (!this.mcp) return null;
    try {
      const text = await this.mcp.callTool(
        'global_assets',
        { action: 'ohlcv', symbol, interval: intervalLabel, period: range },
        12,
      );
      const parsed = this.parseMcpText(text);
      const rows = this.findCandleRows(parsed);
      if (rows.length > 0) {
        this.stockProvider = 'mcp';
        return rows.slice(-limit);
      }
      return null;
    } catch {
      return null;
    }
  }

  private parseMcpText(text: string): unknown {
    try {
      const first = text.trim().startsWith('{') ? text : text.slice(text.indexOf('{'));
      return JSON.parse(first);
    } catch {
      return null;
    }
  }

  private findPrice(node: unknown): number | null {
    if (!node || typeof node !== 'object') return null;
    const keys = ['regularMarketPrice', 'last', 'price', 'close', 'bid', 'value'];
    const direct = (node as Record<string, unknown>);
    for (const k of keys) {
      const v = direct[k];
      const n = Number(v);
      if (Number.isFinite(n) && n > 0 && typeof v !== 'object') return n;
    }
    for (const k of Object.keys(direct)) {
      const sub = this.findPrice(direct[k]);
      if (sub != null) return sub;
    }
    return null;
  }

  private findCandleRows(node: unknown): Candle[] {
    const out: Candle[] = [];
    const visit = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) {
        const cand = this.candlesFromArray(value);
        if (cand.length >= 3 && cand.length > out.length) {
          out.length = 0;
          out.push(...cand);
        }
        for (const item of value) visit(item);
      } else {
        for (const key of Object.keys(value as Record<string, unknown>)) {
          visit((value as Record<string, unknown>)[key]);
        }
      }
    };
    visit(node);
    return out;
  }

  private candlesFromArray(items: unknown[]): Candle[] {
    const out: Candle[] = [];
    for (const item of items) {
      if (Array.isArray(item) && item.length >= 5) {
        const close = Number(item[4]);
        if (!Number.isFinite(close) || close <= 0) continue;
        out.push({
          ts: Number(item[0]) ?? 0,
          open: Number(item[1]),
          high: Number(item[2]),
          low: Number(item[3]),
          close,
          volume: Number(item[5] ?? 0),
        });
      } else if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        const pick = (names: string[]): number => {
          for (const n of names) {
            const v = Number(obj[n]);
            if (Number.isFinite(v) && v !== 0) return v;
          }
          return NaN;
        };
        const close = pick(['close', 'c', 'last', 'closePrice']);
        if (!Number.isFinite(close) || close <= 0) continue;
        const tsRaw = obj['ts'] ?? obj['timestamp'] ?? obj['time'] ?? obj['date'] ?? 0;
        let ts = Number(tsRaw);
        if (!Number.isFinite(ts) || ts === 0) ts = Date.parse(String(tsRaw));
        out.push({
          ts: Number.isFinite(ts) ? ts : 0,
          open: pick(['open', 'o']) || close,
          high: pick(['high', 'h', 'highPrice']) || close,
          low: pick(['low', 'l', 'lowPrice']) || close,
          close,
          volume: pick(['volume', 'v', 'vol']) || 0,
        });
      }
    }
    return out;
  }

  /**
   * OHLCV for US stocks / rTokens.
   * Primary: Bitget Reality r*USDT candles. Fallback: Yahoo (cash), then MCP.
   */
  async getStockCandles(
    symbol: string,
    interval: string,
    limit = 200,
  ): Promise<Candle[]> {
    const base = this.equityBase(symbol);
    const rPair = this.realitySymbol(base);

    const reality = await this.fetchBitgetCandles(rPair, interval, limit);
    if (reality.length > 0) {
      this.stockProvider = 'bitget-reality';
      return reality;
    }

    const yahooInterval =
      interval === '1w' ? '1wk' : interval === '1M' ? '1mo' : '1d';
    const mcpInterval =
      interval === '1w' ? '1wk' : interval === '1M' ? '1mo' : '1d';

    try {
      const range = this.yahooRange(interval, limit);
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
          base,
        )}?interval=${yahooInterval}&range=${range}`,
        {
          signal: AbortSignal.timeout(20_000),
          headers: { 'User-Agent': 'Mozilla/5.0' },
        },
      );
      const json = (await res.json()) as YahooChartResponse;
      const result = json?.chart?.result?.[0];
      const timestamps = result?.timestamp ?? [];
      const quote = result?.indicators?.quote?.[0];
      if (timestamps.length && quote) {
        const out: Candle[] = [];
        for (let i = 0; i < timestamps.length; i++) {
          const close = quote.close?.[i];
          if (close == null || Number.isNaN(Number(close))) continue;
          out.push({
            ts: timestamps[i] * 1000,
            open: Number(quote.open?.[i] ?? close),
            high: Number(quote.high?.[i] ?? close),
            low: Number(quote.low?.[i] ?? close),
            close: Number(close),
            volume: Number(quote.volume?.[i] ?? 0),
          });
        }
        if (out.length > 0) {
          this.stockProvider = 'yahoo';
          return out.slice(-limit);
        }
      }
    } catch {
      // fall through to MCP
    }

    if (this.mcp) {
      const range = this.yahooRange(interval, limit);
      const mcpCandles = await this.mcpStockCandles(
        base,
        interval,
        mcpInterval,
        range,
        limit,
      );
      if (mcpCandles && mcpCandles.length > 0) {
        this.stockProvider = 'mcp';
        return mcpCandles;
      }
    }

    this.stockProvider = 'none';
    return [];
  }

  private async fetchBitgetCandles(
    pair: string,
    interval: string,
    limit: number,
  ): Promise<Candle[]> {
    const granularity = BITGET_GRANULARITY[interval] ?? interval;
    try {
      const url = `${BITGET_CANDLES_URL}?symbol=${encodeURIComponent(
        pair,
      )}&granularity=${granularity}&limit=${limit}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      const json = (await res.json()) as { code: string; data?: string[][] };
      if (json.code !== '00000' || !json.data?.length) return [];
      const mapped = json.data
        .map((row) => ({
          ts: Number(row[0]),
          open: Number(row[1]),
          high: Number(row[2]),
          low: Number(row[3]),
          close: Number(row[4]),
          volume: Number(row[5]),
        }))
        .filter((c) => Number.isFinite(c.close) && c.close > 0);
      // Normalize to ascending time (API order varies by granularity).
      if (mapped.length >= 2 && mapped[0].ts > mapped[mapped.length - 1].ts) {
        mapped.reverse();
      }
      return mapped;
    } catch {
      return [];
    }
  }

  async getCandles(
    symbol: string,
    interval: string,
    limit = 200,
  ): Promise<Candle[]> {
    if (this.assetTypeOf(symbol) === 'us-stock') {
      const stock = await this.getStockCandles(symbol, interval, limit);
      if (stock.length > 0) return stock;
    }
    try {
      const candles = await this.fetchBitgetCandles(
        this.bitgetSymbol(symbol),
        interval,
        limit,
      );
      if (candles.length > 0) return candles;
      throw new Error('Bitget candles empty');
    } catch {
      // Placeholder fallback
      const candles: Candle[] = [];
      const now = Date.now();
      const stepMs = this.intervalToMs(interval);
      for (let i = limit; i > 0; i--) {
        candles.push({
          ts: now - i * stepMs,
          open: 0,
          high: 0,
          low: 0,
          close: 0,
          volume: 0,
        });
      }
      return candles;
    }
  }

  /**
   * Google News RSS - reliable, keyless news fallback (also used by the
   * news skill when the Bitget MCP feed is unavailable).
   */
  async fetchGoogleNews(
    query: string,
    limit = 8,
  ): Promise<NewsItem[]> {
    try {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(
        query,
      )}&hl=en-US&gl=US&ceid=US:en`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(15_000),
        redirect: 'follow',
      });
      const xml = await res.text();
      const parser = new XMLParser({
        ignoreAttributes: false,
        parseTagValue: false,
      });
      const doc = parser.parse(xml);
      const items = doc?.rss?.channel?.item;
      const list = Array.isArray(items) ? items : items ? [items] : [];
      return list.slice(0, limit).map((item: Record<string, unknown>) => {
        const rawSource = item['source'] as unknown;
        const source =
          typeof rawSource === 'string'
            ? rawSource
            : (rawSource && typeof rawSource === 'object'
                ? String(
                    (rawSource as Record<string, unknown>)['#text'] ??
                      (rawSource as Record<string, unknown>)['text'] ??
                      '',
                  )
                : '') || 'Google News';
        return {
          title: String(item['title'] ?? '').replace(
            / - [^-]*Google News$/i,
            '',
          ),
          url: String(item['link'] ?? ''),
          source: source.replace(/ - Google News$/i, ''),
          publishedAt: String(item['pubDate'] ?? new Date().toISOString()),
          summary: String(item['description'] ?? '').replace(/<[^>]+>/g, ' '),
        };
      });
    } catch {
      return [];
    }
  }

  private intervalToMs(interval: string): number {
    const unit = interval.slice(-1);
    const value = Number(interval.slice(0, -1)) || 1;
    switch (unit) {
      case 'm':
        return value * 60_000;
      case 'h':
        return value * 3_600_000;
      case 'd':
        return value * 86_400_000;
      case 'w':
        return value * 604_800_000;
      default:
        return value * 60_000;
    }
  }

  private yahooRange(interval: string, limit: number): string {
    if (interval === '1w') {
      return limit > 200 ? 'max' : limit > 104 ? '2y' : limit > 52 ? '1y' : '6mo';
    }
    // daily bars
    if (limit > 250) return 'max';
    if (limit > 125) return '2y';
    if (limit > 60) return '1y';
    return '6mo';
  }
}