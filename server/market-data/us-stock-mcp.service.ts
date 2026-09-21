import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { McpHttpClient, McpTool } from './mcp-http.client';
import { parseMcpJson } from '../skills/mcp.util';

const DEFAULT_US_MCP_URL = 'https://agent.bitget.com/mcp';

/** Candidate tool names when listTools is unavailable / empty. */
const QUOTE_CANDIDATES = [
  'stock_quote',
  'get_stock_quote',
  'get_quote',
  'quote',
  'us_stock_quote',
  'ticker',
  'get_ticker',
];
const OHLCV_CANDIDATES = [
  'stock_candles',
  'historical_prices',
  'get_candles',
  'ohlcv',
  'kline',
  'get_ohlcv',
];
const COMPANY_CANDIDATES = [
  'company_profile',
  'get_company_profile',
  'stock_fundamentals',
  'fundamentals',
  'get_fundamentals',
  'company',
];
const EARNINGS_CANDIDATES = [
  'earnings',
  'earnings_calendar',
  'get_earnings',
  'stock_earnings',
];
const NEWS_CANDIDATES = [
  'stock_news',
  'company_news',
  'get_news',
  'news',
];

export type UsStockIntent =
  | 'quote'
  | 'ohlcv'
  | 'company'
  | 'earnings'
  | 'news'
  | 'fundamentals';

export interface UsMcpCallResult {
  text: string;
  tool: string;
  parsed: unknown;
  source: 'bitget-mcp-server';
}

/**
 * Bitget US stock / ETF read-only MCP (`BITGET_US_MCP_URL`).
 * Handbook name: `bitget-mcp-server` — quotes, fundamentals, earnings,
 * corporate actions. Track 3 information layer (core US data).
 *
 * Discovers tools at runtime; falls through quickly when the endpoint is
 * unreachable (common on some local networks) so callers can use
 * bitget-signal / Reality / Yahoo fallbacks.
 */
@Injectable()
export class UsStockMcpClientService implements OnModuleInit {
  private readonly logger = new Logger(UsStockMcpClientService.name);
  private readonly client: McpHttpClient;
  private tools: McpTool[] | null = null;
  private toolsPromise: Promise<McpTool[]> | null = null;

  constructor() {
    const url = process.env.BITGET_US_MCP_URL ?? DEFAULT_US_MCP_URL;
    this.client = new McpHttpClient(url, {
      label: 'bitget-mcp-server',
      // Fail fast — local networks often cannot reach agent.bitget.com.
      initTimeoutMs: 6_000,
      callTimeoutMs: 12_000,
      circuitFailures: 1,
      circuitCooldownMs: 120_000,
    });
  }

  onModuleInit(): void {
    this.logger.log(`bitget-mcp-server MCP → ${this.client.url}`);
    void this.warmTools();
  }

  get url(): string {
    return this.client.url;
  }

  get label(): string {
    return this.client.label;
  }

  isDown(): boolean {
    return this.client.isDown();
  }

  /** True after a successful tools/list (US MCP is reachable). */
  isReachable(): boolean {
    return this.tools != null && this.tools.length > 0;
  }

  listTools(): Promise<McpTool[]> {
    return this.ensureTools();
  }

  callTool(
    name: string,
    arguments_: object,
    timeoutSeconds?: number,
  ): Promise<string> {
    return this.client.callTool(name, arguments_, timeoutSeconds);
  }

  /**
   * Call the best matching US MCP tool for an intent.
   * Returns null when unreachable or no tool produces data.
   */
  async callIntent(
    intent: UsStockIntent,
    symbol: string,
    extra: Record<string, unknown> = {},
  ): Promise<UsMcpCallResult | null> {
    if (this.isDown()) return null;

    let names: string[];
    try {
      names = await this.resolveToolNames(intent);
    } catch {
      return null;
    }
    if (this.isDown() || names.length === 0) return null;

    const argSets = this.argVariants(intent, symbol, extra);
    // Keep attempts tiny — unreachable US MCP must not stall the desk.
    const toolLimit = this.isReachable() ? 3 : 1;
    const argLimit = this.isReachable() ? 2 : 1;

    for (const tool of names.slice(0, toolLimit)) {
      if (this.isDown()) return null;
      for (const args of argSets.slice(0, argLimit)) {
        try {
          const text = await this.client.callTool(tool, args, 6);
          if (!text || /error|not (found|available)|unknown tool/i.test(text)) {
            continue;
          }
          const parsed = parseMcpJson(text);
          return {
            text,
            tool,
            parsed,
            source: 'bitget-mcp-server',
          };
        } catch {
          if (this.isDown()) return null;
        }
      }
    }
    return null;
  }

  private async warmTools(): Promise<void> {
    try {
      const tools = await this.ensureTools();
      if (tools.length > 0) {
        this.logger.log(
          `bitget-mcp-server online — ${tools.length} tools: ${tools
            .slice(0, 8)
            .map((t) => t.name)
            .join(', ')}${tools.length > 8 ? '…' : ''}`,
        );
      } else {
        this.logger.warn(
          'bitget-mcp-server reachable but returned 0 tools; US calls will use name heuristics + signal fallback',
        );
      }
    } catch (err) {
      this.logger.warn(
        `bitget-mcp-server unreachable (${this.client.url}): ${
          err instanceof Error ? err.message : String(err)
        }. Fundamentals/quotes will fall back to bitget-signal / Reality / Yahoo.`,
      );
    }
  }

  private async ensureTools(): Promise<McpTool[]> {
    if (this.tools) return this.tools;
    if (this.toolsPromise) return this.toolsPromise;
    if (this.isDown()) return [];

    this.toolsPromise = this.client
      .listTools()
      .then((tools) => {
        this.tools = tools;
        return tools;
      })
      .catch((err) => {
        this.tools = [];
        this.client.tripCircuit(
          err instanceof Error ? err.message : 'listTools failed',
        );
        throw err;
      })
      .finally(() => {
        this.toolsPromise = null;
      });

    return this.toolsPromise;
  }

  private async resolveToolNames(intent: UsStockIntent): Promise<string[]> {
    let discovered: McpTool[] = [];
    try {
      discovered = await this.ensureTools();
    } catch {
      discovered = [];
    }

    const patterns = this.intentPatterns(intent);
    const matched = discovered
      .filter((t) => {
        const hay = `${t.name} ${t.description ?? ''}`.toLowerCase();
        return patterns.some((p) => p.test(hay));
      })
      .map((t) => t.name);

    const fallback = this.intentFallbacks(intent);
    // Prefer discovered matches, then known handbook-style names.
    return [...new Set([...matched, ...fallback])];
  }

  private intentPatterns(intent: UsStockIntent): RegExp[] {
    switch (intent) {
      case 'quote':
        return [/quote/, /ticker/, /\bprice\b/, /last.?price/];
      case 'ohlcv':
        return [/ohlcv/, /candle/, /kline/, /historical/, /bar/];
      case 'company':
      case 'fundamentals':
        return [
          /company/,
          /profile/,
          /fundamental/,
          /financial/,
          /valuation/,
          /ratio/,
        ];
      case 'earnings':
        return [/earning/, /eps/, /calendar/];
      case 'news':
        return [/news/, /headline/];
      default:
        return [];
    }
  }

  private intentFallbacks(intent: UsStockIntent): string[] {
    switch (intent) {
      case 'quote':
        return QUOTE_CANDIDATES;
      case 'ohlcv':
        return OHLCV_CANDIDATES;
      case 'company':
      case 'fundamentals':
        return COMPANY_CANDIDATES;
      case 'earnings':
        return EARNINGS_CANDIDATES;
      case 'news':
        return NEWS_CANDIDATES;
      default:
        return [];
    }
  }

  private argVariants(
    intent: UsStockIntent,
    symbol: string,
    extra: Record<string, unknown>,
  ): object[] {
    const base = { symbol, ticker: symbol, ...extra };
    switch (intent) {
      case 'quote':
        return [
          { symbol },
          { ticker: symbol },
          { action: 'quote', symbol },
          { action: 'price', symbol },
          base,
        ];
      case 'ohlcv':
        return [
          { symbol, ...extra },
          { ticker: symbol, ...extra },
          { action: 'ohlcv', symbol, ...extra },
          { action: 'candles', symbol, ...extra },
        ];
      case 'company':
      case 'fundamentals':
        return [
          { symbol },
          { ticker: symbol },
          { action: 'company', symbol },
          { action: 'profile', symbol },
          { action: 'fundamentals', symbol },
        ];
      case 'earnings':
        return [
          { symbol, ...extra },
          { ticker: symbol, ...extra },
          { action: 'earnings', symbol, ...extra },
          { action: 'calendar', symbol, ...extra },
        ];
      case 'news':
        return [
          { symbol, limit: 5, ...extra },
          { ticker: symbol, limit: 5, ...extra },
          { action: 'news', symbol, limit: 5, ...extra },
        ];
      default:
        return [{ symbol }];
    }
  }
}
