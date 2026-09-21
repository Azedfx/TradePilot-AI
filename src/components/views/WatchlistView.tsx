import { useEffect, useState } from 'react';
import { Star, TrendingDown, TrendingUp } from 'lucide-react';
import { getMarket } from '@/lib/api';
import { AssetLogo } from '../ui/AssetLogo';
import { NumberBadge } from '../ui/NumberBadge';
import type { MarketSnapshot } from '@/lib/types';

const WATCHLIST = ['NVDA', 'TSLA', 'AAPL', 'MSFT', 'AMZN', 'META'];

export function WatchlistView() {
  const [snapshots, setSnapshots] = useState<Record<string, MarketSnapshot | null>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const results = await Promise.allSettled(
      WATCHLIST.map((s) => getMarket(s)),
    );
    const next: Record<string, MarketSnapshot | null> = {};
    results.forEach((res, i) => {
      const sym = WATCHLIST[i];
      next[sym] = res.status === 'fulfilled' ? res.value : null;
    });
    setSnapshots(next);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="p-2">
      <section className="relative rounded-lg border border-[#173a5a] bg-[#071424]">
        <NumberBadge number="2" />

        <div className="flex items-center justify-between border-b border-[#142b44] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-5 w-5 items-center justify-center rounded-full border border-[#617b9d]">
              <Star size={10} className="text-[#9ab7d8]" />
            </div>
            <h2 className="text-[13px] font-semibold">Watchlist</h2>
          </div>

          <button
            onClick={() => void load()}
            className="text-[9px] font-medium text-[#57d9ff]"
          >
            Refresh
          </button>
        </div>

        <div className="p-3">
          {loading && !Object.keys(snapshots).length ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {WATCHLIST.map((s) => (
                <AssetCard key={s} symbol={s} loading />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {WATCHLIST.map((s) => (
                <AssetCard key={s} symbol={s} snapshot={snapshots[s]} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function AssetCard({
  symbol,
  snapshot,
  loading,
}: {
  symbol: string;
  snapshot?: MarketSnapshot | null;
  loading?: boolean;
}) {
  const up = (snapshot?.change24h ?? 0) >= 0;

  return (
    <div className="rounded-lg border border-[#112a43] bg-[#08182a] p-3">
      <div className="flex items-center gap-3">
        <AssetLogo type={symbol.toLowerCase()} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-[#e3ebf4]">{symbol}</p>
          <p className="text-[8px] text-[#73869e]">
            {snapshot?.venue === 'bitget-reality'
              ? `Bitget Reality · ${snapshot.rTokenSymbol ?? `r${symbol}USDT`}`
              : 'US Stock'}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between">
        <div>
          <p className="text-[7px] text-[#71869e]">Price</p>
          <p className="mt-1 text-[14px] font-semibold text-[#dce7f3]">
            {loading || !snapshot
              ? '—'
              : `$${snapshot.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
          </p>
        </div>

        <div className="text-right">
          <p className="text-[7px] text-[#71869e]">24h change</p>
          <p className={`mt-1 flex items-center justify-end gap-1 text-[11px] font-semibold ${up ? 'text-[#24d8b2]' : 'text-[#f05d65]'}`}>
            {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {loading || !snapshot ? '—' : `${up ? '+' : ''}${snapshot.change24h.toFixed(2)}%`}
          </p>
        </div>
      </div>
    </div>
  );
}