const CRYPTO_ALIASES: Record<string, string> = {
  bitcoin: 'BTC',
  btc: 'BTC',
  bitcoinusdt: 'BTC',
  ethereum: 'ETH',
  eth: 'ETH',
  ether: 'ETH',
  solana: 'SOL',
  sol: 'SOL',
  xrp: 'XRP',
  ripple: 'XRP',
  dogecoin: 'DOGE',
  doge: 'DOGE',
  cardano: 'ADA',
  ada: 'ADA',
  binancecoin: 'BNB',
  bnb: 'BNB',
  chainlink: 'LINK',
  link: 'LINK',
  polkadot: 'DOT',
  dot: 'DOT',
  litecoin: 'LTC',
  ltc: 'LTC',
  avalanche: 'AVAX',
  avax: 'AVAX',
  polygon: 'POL',
  matic: 'POL',
  pol: 'POL',
  ton: 'TON',
  toncoin: 'TON',
  shiba: 'SHIB',
  shib: 'SHIB',
  pepe: 'PEPE',
  sui: 'SUI',
  aptos: 'APT',
  apt: 'APT',
  near: 'NEAR',
  tron: 'TRX',
  trx: 'TRX',
  luna: 'LUNA',
  cosmos: 'ATOM',
  atom: 'ATOM',
  render: 'RENDER',
  thegraph: 'GRT',
  grt: 'GRT',
  'internet computer': 'ICP',
  icp: 'ICP',
  optimism: 'OP',
  arbitrum: 'ARB',
  uniswap: 'UNI',
  uni: 'UNI',
  aave: 'AAVE',
  injective: 'INJ',
  inj: 'INJ',
  sepoliaeth: 'ETH',
  bitcoincash: 'BCH',
  bch: 'BCH',
  monero: 'XMR',
  xmr: 'XMR',
  celestia: 'TIA',
  tia: 'TIA',
  worldcoin: 'WLD',
  wld: 'WLD',
};

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
    const alias = CRYPTO_ALIASES[token] ?? STOCK_ALIASES[token];
    if (alias && !found.includes(alias)) {
      found.push(alias);
    }
  }

  if (found.length === 0) {
    const raw = question.toUpperCase();
    for (const match of raw.matchAll(TICKER_RE)) {
      const ticker = match[1];
      if (ticker.length >= 2 && /^[A-Z]{2,5}$/.test(ticker)) {
        if (!CRYPTO_ALIASES[ticker.toLowerCase()] && !STOCK_ALIASES[ticker.toLowerCase()]) {
          // Heuristic: uppercase multi-letter token that isn't a common word.
          const commonWords = new Set([
            'I', 'A', 'IS', 'IT', 'OF', 'TO', 'IN', 'ON', 'AT', 'BY', 'FOR', 'WITH',
            'THE', 'AND', 'WHY', 'FROM', 'DO', 'IF', 'OR', 'AS', 'AN', 'BE', 'WE',
            'BUY', 'SELL', 'SHORT', 'LONG', 'NOW', 'HIGH', 'LOW', 'RISK', 'ALL',
            'WHAT', 'WHEN', 'WILL', 'BIG', 'NEW', 'TOP', 'ANY', 'KEY', 'MAIN',
          ]);
          if (!commonWords.has(ticker)) {
            found.push(ticker);
          }
        }
      }
    }
  }

  return [...new Set(found)];
}

export function detectAssetType(question: string, symbol?: string): 'crypto' | 'us-stock' {
  const normalized = question.toLowerCase();
  if (
    /stock|equity|share|nasdaq|nyse|dow jones|etf|nvidia|tesla|apple|microsoft|amazon|meta|google/.test(
      normalized,
    )
  ) {
    if (symbol && STOCK_ALIASES[symbol.toLowerCase()]) return 'us-stock';
    if (symbol && !CRYPTO_ALIASES[symbol.toLowerCase()]) return 'us-stock';
    return 'us-stock';
  }
  return 'crypto';
}