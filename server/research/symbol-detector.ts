// This workbench is US-stock-first (Bitget AI Base Camp Hackathon S2: AI x
// US stock trading, including tokenized US stocks / rTokens). We no longer
// maintain an exhaustive crypto-ticker dictionary — crypto is still
// supported (the market/technical/sentiment skills have real crypto data
// paths), but it's now a best-effort fallback rather than the default: an
// unrecognised or ambiguous symbol resolves to 'us-stock', not 'crypto'.
const CRYPTO_HINT_RE =
  /\b(crypto|cryptocurrency|bitcoin|btc|ethereum|eth|token|coin|blockchain|defi|altcoin|memecoin|solana|sol|xrp|doge|dogecoin)\b/i;

const STOCK_ALIASES: Record<string, string> = {
  nvidia: 'NVDA',
  nvda: 'NVDA',
  apple: 'AAPL',
  aapl: 'AAPL',
  microsoft: 'MSFT',
  msft: 'MSFT',
  tesla: 'TSLA',
  tsla: 'TSLA',
  amazon: 'AMZN',
  amzn: 'AMZN',
  google: 'GOOGL',
  goog: 'GOOGL',
  googl: 'GOOGL',
  alphabet: 'GOOGL',
  meta: 'META',
  metaplatforms: 'META',
  netflix: 'NFLX',
  nflx: 'NFLX',
  coinbase: 'COIN',
  coin: 'COIN',
  palantir: 'PLTR',
  pltr: 'PLTR',
  microstrategy: 'MSTR',
  mstr: 'MSTR',
  robinhood: 'HOOD',
  hood: 'HOOD',
  intel: 'INTC',
  intc: 'INTC',
  advancedmicrodevices: 'AMD',
  amd: 'AMD',
  'semiconductor etf': 'SOXX',
  soxx: 'SOXX',
  'nasdaq 100 etf': 'QQQ',
  qqq: 'QQQ',
  's&p 500 etf': 'SPY',
  spy: 'SPY',
  'bitcoinminers': 'BITO',
};

const TICKER_RE = /\b([A-Za-z]{1,6})\b/g;

export function detectSymbols(question: string): string[] {
  const normalized = question.toLowerCase().replace(/[^a-z0-9\s/]/g, ' ');
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const found: string[] = [];

  for (const token of tokens) {
    const alias = STOCK_ALIASES[token];
    if (alias && !found.includes(alias)) {
      found.push(alias);
    }
  }

  if (found.length === 0) {
    const raw = question.toUpperCase();
    for (const match of raw.matchAll(TICKER_RE)) {
      const ticker = match[1];
      if (ticker.length >= 2 && /^[A-Z]{2,5}$/.test(ticker)) {
        if (!STOCK_ALIASES[ticker.toLowerCase()]) {
          // Heuristic: uppercase multi-letter token that isn't a common word.
          if (!COMMON_WORDS.has(ticker)) {
            found.push(ticker);
          }
        }
      }
    }
  }

  return [...new Set(found)];
}

// Broad stopword list so freeform natural-language questions (the app's
// main entry point) don't misfire on ordinary English words when no known
// stock alias matched — e.g. "thinking about buying some here" should not
// surface SOME/HERE as tickers alongside the real symbol.
const COMMON_WORDS = new Set([
  'I', 'A', 'IS', 'IT', 'OF', 'TO', 'IN', 'ON', 'AT', 'BY', 'FOR', 'WITH',
  'THE', 'AND', 'WHY', 'FROM', 'DO', 'IF', 'OR', 'AS', 'AN', 'BE', 'WE',
  'BUY', 'SELL', 'SHORT', 'LONG', 'NOW', 'HIGH', 'LOW', 'RISK', 'ALL',
  'WHAT', 'WHEN', 'WILL', 'BIG', 'NEW', 'TOP', 'ANY', 'KEY', 'MAIN',
  'SOME', 'HERE', 'THERE', 'THIS', 'THAT', 'THESE', 'THOSE', 'ABOUT',
  'GOOD', 'BAD', 'CAN', 'COULD', 'WOULD', 'SHOULD', 'MIGHT', 'MUST',
  'INTO', 'OUT', 'OVER', 'UNDER', 'AFTER', 'BEFORE', 'DURING', 'GIVEN',
  'THINK', 'THINKING', 'CONSIDER', 'CONSIDERING', 'LOOK', 'LOOKING',
  'GET', 'GETTING', 'GOING', 'GO', 'MAKE', 'MAKING', 'JUST', 'LIKE',
  'ITS', 'OUR', 'YOUR', 'MY', 'ME', 'YOU', 'THEY', 'THEM', 'THEIR',
  'HAS', 'HAVE', 'HAD', 'DOES', 'DID', 'DONE', 'BEEN', 'WAS', 'WERE',
  'YET', 'STILL', 'ALSO', 'EVEN', 'ONE', 'TWO', 'HOW', 'WHO', 'WHERE',
  'HOLD', 'HOLDING', 'HOLDER', 'ENTRY', 'EXIT', 'IDEA', 'PLAN', 'PLANS',
]);

/**
 * Defaults to 'us-stock' — matching this workbench's (and the hackathon's)
 * US-stock focus — and only classifies as 'crypto' when the question or
 * symbol explicitly signals it. A recognised stock ticker (e.g. NVDA) wins
 * immediately; otherwise an unrecognised/ambiguous ticker no longer
 * silently falls back to crypto (which used to mis-route the technical
 * skill into treating it as a crypto pair and skip the US-market-hours /
 * rToken 7×24 signal entirely).
 */
export function detectAssetType(question: string, symbol?: string): 'crypto' | 'us-stock' {
  if (symbol && STOCK_ALIASES[symbol.toLowerCase()]) return 'us-stock';

  const normalized = question.toLowerCase();
  const looksCrypto =
    CRYPTO_HINT_RE.test(normalized) ||
    (symbol ? CRYPTO_HINT_RE.test(symbol.toLowerCase()) : false);

  return looksCrypto ? 'crypto' : 'us-stock';
}