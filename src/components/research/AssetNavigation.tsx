'use client';

import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Brain,
  Check,
  Gauge,
  History,
  LineChart,
  Newspaper,
  Sparkles,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { AssetLogo } from '../ui/AssetLogo';
import { useResearch } from '@/lib/research-context';

export type DeskSectionId =
  | 'overview'
  | 'thesis'
  | 'market'
  | 'news'
  | 'technical'
  | 'fundamentals'
  | 'historical'
  | 'stress'
  | 'review'
  | 'decision'
  | 'sources';

const NAV: {
  id: DeskSectionId;
  label: string;
  icon: ReactNode;
  /** DOM id to scroll to */
  target: string;
  /** Optional Research Skills panel key to expand */
  skillKey?: string;
}[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: <Sparkles size={13} />,
    target: 'section-overview',
  },
  {
    id: 'thesis',
    label: 'Thesis',
    icon: <Brain size={13} />,
    target: 'section-thesis',
  },
  {
    id: 'market',
    label: 'Market Analysis',
    icon: <BarChart3 size={13} />,
    target: 'section-skills',
    skillKey: 'market',
  },
  {
    id: 'news',
    label: 'News & Sentiment',
    icon: <Newspaper size={13} />,
    target: 'section-skills',
    skillKey: 'news',
  },
  {
    id: 'technical',
    label: 'Technical Analysis',
    icon: <LineChart size={13} />,
    target: 'section-skills',
    skillKey: 'technical',
  },
  {
    id: 'fundamentals',
    label: 'Fundamentals',
    icon: <BookOpen size={13} />,
    target: 'section-skills',
    skillKey: 'fundamentals',
  },
  {
    id: 'historical',
    label: 'Historical Scenarios',
    icon: <History size={13} />,
    target: 'section-historical',
  },
  {
    id: 'stress',
    label: 'Stress Testing',
    icon: <Gauge size={13} />,
    target: 'section-stress',
  },
  {
    id: 'review',
    label: 'Self-Evolution Review',
    icon: <Sparkles size={13} />,
    target: 'section-review',
  },
  {
    id: 'decision',
    label: 'Accept / Reject',
    icon: <Check size={13} />,
    target: 'section-decision',
  },
  {
    id: 'sources',
    label: 'Sources & References',
    icon: <BookOpen size={13} />,
    target: 'section-sources',
  },
];

export const OPEN_SKILL_EVENT = 'tradepilot:open-skill';

function scrollToSection(targetId: string) {
  const el = document.getElementById(targetId);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el.classList.add('ring-1', 'ring-[#29b7ed]/50');
  window.setTimeout(() => {
    el.classList.remove('ring-1', 'ring-[#29b7ed]/50');
  }, 1200);
}

export function AssetNavigation() {
  const { session, clearSession } = useResearch();
  const md = session?.marketData;
  const [active, setActive] = useState<DeskSectionId>('overview');

  const go = (item: (typeof NAV)[number]) => {
    setActive(item.id);
    scrollToSection(item.target);
    if (item.skillKey) {
      window.dispatchEvent(
        new CustomEvent(OPEN_SKILL_EVENT, { detail: { skillKey: item.skillKey } }),
      );
    }
  };

  return (
    <section className="relative rounded-lg border border-[#173552] bg-[#071424]">
      <div className="p-3">
        <button
          type="button"
          onClick={() => {
            clearSession();
            scrollToSection('section-hero');
          }}
          className="mb-4 flex cursor-pointer items-center gap-2 text-[9px] text-[#8195ac] transition hover:text-[#57d9ff]"
        >
          <ArrowLeft size={12} />
          Back to Research
        </button>

        <div className="mb-5 flex items-center gap-3">
          <AssetLogo type={logoFor(session?.symbol)} />

          <div>
            <p className="text-[14px] font-semibold">{session?.symbol ?? '—'}</p>
            <p className="text-[8px] text-[#73869e]">
              {session
                ? md?.venue === 'bitget-reality'
                  ? `Bitget Reality · ${md.rTokenSymbol ?? `r${session.symbol}USDT`}`
                  : md?.assetType === 'us-stock' || !md
                    ? 'US Stock / rToken'
                    : 'US Stock'
                : 'No session yet'}
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
            {md?.cashEquity && md.venue === 'bitget-reality' ? (
              <p className="mt-1 text-[8px] text-[#8195ac]">
                Cash {md.cashEquity.symbol} $
                {md.cashEquity.last.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}
                {md.rTokenVsCashPct != null
                  ? ` · rToken ${md.rTokenVsCashPct >= 0 ? '+' : ''}${md.rTokenVsCashPct.toFixed(2)}% vs cash`
                  : ''}
              </p>
            ) : null}
          </div>
        </div>

        <nav className="space-y-1" aria-label="Research sections">
          {NAV.map((item) => (
            <AssetNavItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              active={active === item.id}
              onClick={() => go(item)}
            />
          ))}
        </nav>
      </div>
    </section>
  );
}

function AssetNavItem({
  icon,
  label,
  active = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 transition ${
        active
          ? 'bg-[#163351] text-[#54d8ff]'
          : 'text-[#879bb1] hover:bg-[#0b1d31] hover:text-[#c5d6e8]'
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
  if (s.includes('msft')) return 'msft';
  if (s.includes('amzn')) return 'amzn';
  if (s.includes('meta')) return 'meta';
  return s;
}
