import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Brain,
  Gauge,
  History,
  LineChart,
  Newspaper,
  Sparkles,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { AssetLogo } from '../ui/AssetLogo';
import { useResearch } from '@/lib/research-context';

export function AssetNavigation() {
  const { session } = useResearch();
  const md = session?.marketData;

  return (
    <section className="relative rounded-lg border border-[#173552] bg-[#071424]">
      <div className="p-3">
        <button className="mb-4 flex items-center gap-2 text-[9px] text-[#8195ac]">
          <ArrowLeft size={12} />
          Back to Research
        </button>

        <div className="mb-5 flex items-center gap-3">
          <AssetLogo type={logoFor(session?.symbol)} />

          <div>
            <p className="text-[14px] font-semibold">{session?.symbol ?? '—'}</p>
            <p className="text-[8px] text-[#73869e]">
              {md
                ? md.assetType === 'crypto'
                  ? 'Cryptocurrency'
                  : 'US Stock'
                : '—'}
            </p>
            <p className="mt-1 text-[11px] font-semibold">
              {md
                ? `$${md.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                : '—'}
            </p>
            <p
              className={`text-[8px] font-medium ${
                (md?.change24h ?? 0) >= 0 ? 'text-[#24d8b2]' : 'text-[#f05d65]'
              }`}
            >
              {md
                ? `${md.change24h >= 0 ? '+' : ''}${md.change24h.toFixed(2)}% (24h)`
                : '—'}
            </p>
          </div>
        </div>

        <div className="space-y-1">
          <AssetNavItem icon={<Sparkles size={13} />} label="Overview" active />
          <AssetNavItem icon={<Brain size={13} />} label="Thesis" />
          <AssetNavItem icon={<BarChart3 size={13} />} label="Market Analysis" />
          <AssetNavItem icon={<Newspaper size={13} />} label="News & Sentiment" />
          <AssetNavItem icon={<LineChart size={13} />} label="Technical Analysis" />
          <AssetNavItem icon={<History size={13} />} label="Historical Scenarios" />
          <AssetNavItem icon={<Gauge size={13} />} label="Stress Testing" />
          <AssetNavItem icon={<BookOpen size={13} />} label="Sources & References" />
        </div>
      </div>
    </section>
  );
}

function AssetNavItem({
  icon,
  label,
  active = false,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      className={`flex w-full items-center gap-3 rounded-md px-2.5 py-2 ${
        active
          ? 'bg-[#163351] text-[#54d8ff]'
          : 'text-[#879bb1] hover:bg-[#0b1d31]'
      }`}
    >
      {icon}
      <span className="text-[9px]">{label}</span>
    </button>
  );
}

function logoFor(symbol: string | null | undefined): string {
  if (!symbol) return 'nvda';
  const s = symbol.toLowerCase();
  if (s.includes('nvda')) return 'nvda';
  if (s.includes('tsla')) return 'tsla';
  if (s.includes('aapl')) return 'aapl';
  if (s.includes('btc')) return 'btc';
  return s;
}