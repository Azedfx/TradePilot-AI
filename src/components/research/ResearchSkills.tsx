'use client';

import {
  Activity,
  BarChart3,
  Building2,
  ChevronDown,
  ExternalLink,
  Gauge,
  LineChart,
  Newspaper,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { NumberBadge } from '../ui/NumberBadge';
import { useResearch } from '@/lib/research-context';
import type { FindingView } from '@/lib/types';
import { OPEN_SKILL_EVENT } from './AssetNavigation';

const SKILLS: {
  name: string;
  key: string;
  description: string;
  icon: ReactNode;
}[] = [
  {
    name: 'News Briefing',
    key: 'news',
    description: 'Latest news, events, and narratives',
    icon: <Newspaper size={16} />,
  },
  {
    name: 'Market Intel',
    key: 'market',
    description: 'Bitget Reality rToken + cash compare',
    icon: <BarChart3 size={16} />,
  },
  {
    name: 'Fundamentals',
    key: 'fundamentals',
    description: 'Earnings gap, 52w range, Reality vs cash',
    icon: <Building2 size={16} />,
  },
  {
    name: 'Sentiment Analyst',
    key: 'sentiment',
    description: 'News tone and market positioning',
    icon: <Gauge size={16} />,
  },
  {
    name: 'Macro Analyst',
    key: 'macro',
    description: 'Macro, rates, DXY, global markets',
    icon: <Activity size={16} />,
  },
  {
    name: 'Technical Analysis',
    key: 'technical',
    description: 'Indicators and chart analysis',
    icon: <LineChart size={16} />,
  },
];

export function ResearchSkills() {
  const { session } = useResearch();
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ skillKey?: string }>).detail;
      if (!detail?.skillKey) return;
      setOpenKey(detail.skillKey);
    };
    window.addEventListener(OPEN_SKILL_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_SKILL_EVENT, onOpen);
  }, []);

  const stateFor = (key: string): 'done' | 'active' | 'pending' | 'idle' => {
    const s = session?.skills.find((s) => s.skillName === key);
    if (!s) return session ? 'pending' : 'idle';
    if (s.status === 'COMPLETED') return 'done';
    if (s.status === 'FAILED') return 'pending';
    if (s.status === 'RUNNING') return 'active';
    return 'pending';
  };

  const findingsFor = (key: string): FindingView[] =>
    (session?.findings ?? []).filter((f) => f.category === key);

  return (
    <section
      id="section-skills"
      className="relative scroll-mt-16 rounded-lg border border-[#173a5a] bg-[#071424]"
    >
      <NumberBadge number="2" />

      <div className="flex items-center justify-between border-b border-[#142b44] px-5 py-4">
        <h2 className="text-[13px] font-semibold">Research Skills</h2>

        <span className="text-[8px] text-[#71869f]">
          Powered by <span className="font-bold text-[#d9e7f5]">⚡Bitget</span>
        </span>
      </div>

      <div className="p-2">
        {SKILLS.map((skill) => {
          const run = session?.skills.find((s) => s.skillName === skill.key);
          const state = stateFor(skill.key);
          const open = openKey === skill.key;
          const canOpen =
            state === 'done' || state === 'active' || Boolean(run?.summary);

          return (
            <SkillCard
              key={skill.name}
              skillKey={skill.key}
              skill={skill}
              state={state}
              durationMs={run?.durationMs ?? null}
              summary={run?.summary ?? null}
              error={run?.error ?? null}
              findings={findingsFor(skill.key)}
              open={open}
              canOpen={canOpen}
              onToggle={() => {
                if (!canOpen) return;
                setOpenKey((cur) => (cur === skill.key ? null : skill.key));
              }}
            />
          );
        })}
      </div>
    </section>
  );
}

function SkillCard({
  skillKey,
  skill,
  state,
  durationMs,
  summary,
  error,
  findings,
  open,
  canOpen,
  onToggle,
}: {
  skillKey: string;
  skill: { name: string; description: string; icon: ReactNode };
  state: 'done' | 'active' | 'pending' | 'idle';
  durationMs: number | null;
  summary?: string | null;
  error?: string | null;
  findings: FindingView[];
  open: boolean;
  canOpen: boolean;
  onToggle: () => void;
}) {
  const active = state === 'active';
  const detail = extractSkillDetail(skillKey, findings);

  const badge = {
    done: {
      cls: 'bg-[#073b3b] text-[#43dcbf]',
      label: durationMs != null ? `${(durationMs / 1000).toFixed(0)}s` : 'Done',
    },
    active: {
      cls: 'bg-[#063e3e] text-[#31e5bb]',
      label: 'Running',
    },
    pending: {
      cls: 'bg-[#1c3048] text-[#8298b2]',
      label: 'Pending',
    },
    idle: {
      cls: 'bg-[#1c3048] text-[#8298b2]',
      label: 'Pending',
    },
  }[state];

  const preview =
    detail.kind === 'headlines' && detail.items[0]
      ? detail.items[0].title
      : detail.kind === 'setups' && detail.items[0]
        ? `${detail.items[0].Symbol} · ${detail.items[0].Trend}`
        : detail.kind === 'rows' && detail.items[0]
          ? `${detail.items[0].label}: ${detail.items[0].value}`
          : summary;

  return (
    <div
      className={`rounded-lg transition ${
        canOpen ? 'hover:bg-[#0b1d31]' : ''
      } ${open ? 'bg-[#0b1d31]' : ''}`}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={!canOpen}
        aria-expanded={open}
        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left ${
          canOpen ? 'cursor-pointer' : 'cursor-default opacity-80'
        }`}
      >
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            active ? 'bg-[#466fff] text-white' : 'bg-[#28364e] text-[#a0b3cc]'
          }`}
        >
          {skill.icon}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold text-[#dbe6f3]">{skill.name}</p>
          <p className="truncate text-[8px] text-[#71869f]">
            {skill.description}
          </p>
        </div>

        <span className={`rounded-md px-2 py-1 text-[7px] font-semibold ${badge.cls}`}>
          {badge.label}
        </span>

        {canOpen ? (
          <ChevronDown
            size={14}
            className={`shrink-0 text-[#7e94ae] transition-transform ${
              open ? 'rotate-180' : ''
            }`}
          />
        ) : null}
      </button>

      {!open && state === 'done' && preview ? (
        <p className="line-clamp-2 px-3 pb-2.5 pl-14 text-[8px] leading-3 text-[#8fa2b7]">
          {preview}
        </p>
      ) : null}

      {open ? (
        <div className="space-y-2 border-t border-[#142b44] px-3 py-3 pl-14">
          {error ? (
            <p className="text-[9px] leading-3.5 text-[#f05d65]">{error}</p>
          ) : null}

          <SkillDetailBody detail={detail} summary={summary} active={active} />
        </div>
      ) : null}
    </div>
  );
}

type HeadlineItem = {
  title: string;
  url?: string | null;
  source?: string;
  publishedAt?: string;
  summary?: string;
};

type SkillDetail =
  | { kind: 'headlines'; items: HeadlineItem[] }
  | { kind: 'rows'; items: { label: string; value: string }[] }
  | { kind: 'setups'; items: Array<Record<string, string>> }
  | { kind: 'text'; items: string[] }
  | { kind: 'empty' };

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function money(value: unknown): string | null {
  const n = num(value);
  if (n == null) return null;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function pct(value: unknown): string | null {
  const n = num(value);
  if (n == null) return null;
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function pick(obj: Record<string, unknown> | null | undefined, keys: string[]): unknown {
  if (!obj) return undefined;
  for (const k of keys) {
    if (obj[k] != null) return obj[k];
  }
  return undefined;
}

function extractSkillDetail(
  skillKey: string,
  findings: FindingView[],
): SkillDetail {
  const summaryFinding = findings.find((f) =>
    f.title.toLowerCase().startsWith('summary from'),
  );
  const data = (summaryFinding?.data ?? findings[0]?.data ?? null) as Record<
    string,
    unknown
  > | null;

  if (skillKey === 'news') {
    const fromData = Array.isArray(data?.headlines)
      ? (data.headlines as HeadlineItem[])
      : [];
    const fromFindings = findings
      .filter((f) => !f.title.toLowerCase().startsWith('summary from'))
      .map((f) => {
        const d = (f.data ?? {}) as HeadlineItem;
        return {
          title: f.title,
          url: d.url ?? null,
          source: d.source,
          publishedAt: d.publishedAt,
          summary: f.statement !== f.title ? f.statement : d.summary,
        };
      });
    const items = (fromData.length ? fromData : fromFindings).filter((h) =>
      Boolean(h.title?.trim()),
    );
    if (items.length) return { kind: 'headlines', items };
  }

  if (skillKey === 'market' && data) {
    const stats = (data.globalStats ?? null) as Record<string, unknown> | null;
    const flows = Array.isArray(data.flows)
      ? (data.flows as Array<Record<string, unknown>>)
      : [];
    const lead = stats ?? flows[0] ?? null;
    const rows: { label: string; value: string }[] = [];

    const symbol = pick(lead ?? undefined, ['symbol']);
    const rToken = pick(lead ?? undefined, ['rTokenSymbol']);
    const price = pick(lead ?? undefined, ['price', 'lastPrice']);
    const change = pick(lead ?? undefined, ['change_24h', 'change24h']);
    const high = pick(lead ?? undefined, ['high_24h', 'high24h']);
    const low = pick(lead ?? undefined, ['low_24h', 'low24h']);
    const volume = pick(lead ?? undefined, ['volume_24h', 'volume24h']);
    const venue = pick(lead ?? undefined, ['venue']);
    const cash = (lead?.cashEquity ?? null) as Record<string, unknown> | null;
    const vsCash = pick(lead ?? undefined, ['rTokenVsCashPct']);

    if (symbol != null) rows.push({ label: 'Symbol', value: String(symbol) });
    if (rToken != null) rows.push({ label: 'rToken', value: String(rToken) });
    if (money(price)) rows.push({ label: 'Last (Reality)', value: money(price)! });
    if (pct(change)) rows.push({ label: '24h change', value: pct(change)! });
    if (money(high)) rows.push({ label: '24h high', value: money(high)! });
    if (money(low)) rows.push({ label: '24h low', value: money(low)! });
    if (num(volume) != null) {
      rows.push({
        label: '24h volume',
        value: num(volume)!.toLocaleString(),
      });
    }
    if (cash && money(cash.price ?? cash.last)) {
      rows.push({
        label: 'Cash equity',
        value: `${money(cash.price ?? cash.last)}${cash.source ? ` (${cash.source})` : ''}`,
      });
    }
    if (pct(vsCash)) {
      rows.push({ label: 'rToken vs cash', value: pct(vsCash)! });
    }
    if (venue != null) rows.push({ label: 'Venue', value: String(venue) });
    else if (data.source) rows.push({ label: 'Source', value: String(data.source) });
    if (rows.length) return { kind: 'rows', items: rows };
  }

  if (skillKey === 'fundamentals' && data) {
    const rows: { label: string; value: string }[] = [];
    if (data.applicable === false) {
      rows.push({ label: 'Scope', value: 'US equities only' });
      return { kind: 'rows', items: rows };
    }
    if (data.symbol) rows.push({ label: 'Symbol', value: String(data.symbol) });
    if (data.rTokenSymbol) {
      rows.push({ label: 'rToken', value: String(data.rTokenSymbol) });
    }
    if (money(data.lastPrice)) {
      rows.push({ label: 'Last', value: money(data.lastPrice)! });
    }
    const gap = data.expectationGap as { summary?: string } | null;
    if (gap?.summary) rows.push({ label: 'Expectation gap', value: gap.summary });
    const range = data.rangePosition as { summary?: string } | null;
    if (range?.summary) rows.push({ label: '52w position', value: range.summary });
    if (pct(data.rTokenVsCashPct)) {
      rows.push({ label: 'rToken vs cash', value: pct(data.rTokenVsCashPct)! });
    }
    const meta = data.quoteMeta as Record<string, unknown> | null;
    if (meta?.fiftyTwoWeekHigh != null) {
      rows.push({
        label: '52w high',
        value: money(meta.fiftyTwoWeekHigh) ?? String(meta.fiftyTwoWeekHigh),
      });
    }
    if (meta?.fiftyTwoWeekLow != null) {
      rows.push({
        label: '52w low',
        value: money(meta.fiftyTwoWeekLow) ?? String(meta.fiftyTwoWeekLow),
      });
    }
    const companyNews = Array.isArray(data.companyNews)
      ? (data.companyNews as Array<Record<string, unknown>>)
      : [];
    for (const n of companyNews.slice(0, 2)) {
      const title = String(n.headline ?? n.title ?? '').trim();
      if (title) rows.push({ label: 'Company news', value: title.slice(0, 120) });
    }
    if (typeof data.wiki === 'string' && data.wiki.trim()) {
      rows.push({ label: 'Company', value: data.wiki.slice(0, 220) });
    }
    if (data.source) {
      rows.push({
        label: 'Source',
        value:
          data.source === 'finnhub'
            ? 'Finnhub earnings (EPS actual vs estimate)'
            : String(data.source),
      });
    }
    if (rows.length) return { kind: 'rows', items: rows };
  }

  if (skillKey === 'technical' && data) {
    const setups = Array.isArray(data.setups)
      ? (data.setups as Array<Record<string, unknown>>)
      : [];
    const items: Array<Record<string, string>> = [];
    for (const s of setups.slice(0, 4)) {
      const rsiObj = s.rsi as Record<string, unknown> | number | undefined;
      const macdObj = s.macd as Record<string, unknown> | undefined;
      const maObj = s.ma as Record<string, unknown> | undefined;
      const rsiVal =
        typeof rsiObj === 'number'
          ? rsiObj
          : num(pick(rsiObj, ['value', 'rsi']));
      const rsiSignal =
        typeof rsiObj === 'object' && rsiObj
          ? String(rsiObj.signal ?? '')
          : '';
      const trend = String(s.trend ?? s.verdict ?? 'n/a');
      const item: Record<string, string> = {
        Symbol: String(s.symbol ?? 'Asset'),
        Trend: trend,
      };
      if (s.rTokenSymbol) item.rToken = String(s.rTokenSymbol);
      if (s.venue) item.Venue = String(s.venue);
      if (money(s.lastPrice)) item.Price = money(s.lastPrice)!;
      if (rsiVal != null) {
        item.RSI = `${rsiVal.toFixed(1)}${rsiSignal ? ` (${rsiSignal})` : ''}`;
      }
      if (macdObj?.signal != null) item.MACD = String(macdObj.signal);
      else if (macdObj?.cross != null) item.MACD = String(macdObj.cross);
      if (maObj?.ma20 != null) item['MA20'] = money(maObj.ma20) ?? String(maObj.ma20);
      if (maObj?.ma50 != null) item['MA50'] = money(maObj.ma50) ?? String(maObj.ma50);
      if (money(s.support)) item.Support = money(s.support)!;
      if (money(s.resistance)) item.Resistance = money(s.resistance)!;
      if (s.note) item.Note = String(s.note);
      items.push(item);
    }
    if (items.length) return { kind: 'setups', items };
  }

  if (skillKey === 'macro' && data) {
    const rows: { label: string; value: string }[] = [];
    if (data.environment != null) {
      rows.push({ label: 'Environment', value: String(data.environment) });
    }
    const snap = data.snapshot as {
      vix?: number | null;
      tenYearYield?: number | null;
      threeMonthYield?: number | null;
      dxy?: number | null;
      spxChangePct?: number | null;
    } | null;
    if (snap?.vix != null) rows.push({ label: 'VIX', value: String(snap.vix) });
    if (snap?.tenYearYield != null)
      rows.push({ label: '10Y yield', value: `${Number(snap.tenYearYield).toFixed(2)}%` });
    if (snap?.threeMonthYield != null)
      rows.push({
        label: '3M yield',
        value: `${Number(snap.threeMonthYield).toFixed(2)}%`,
      });
    if (snap?.dxy != null)
      rows.push({ label: 'DXY', value: String(Number(snap.dxy).toFixed(2)) });
    if (snap?.spxChangePct != null)
      rows.push({
        label: 'S&P 24h',
        value: `${Number(snap.spxChangePct) >= 0 ? '+' : ''}${Number(snap.spxChangePct).toFixed(2)}%`,
      });
    const window = data.usMarketWindow as {
      note?: string;
      session?: string;
      etClock?: string;
      nextOpenDescription?: string;
    } | null;
    if (window?.session) {
      rows.push({ label: 'US session', value: String(window.session) });
    }
    if (window?.etClock) {
      rows.push({ label: 'Clock (ET)', value: String(window.etClock) });
    }
    if (window?.nextOpenDescription) {
      rows.push({ label: 'Next open', value: String(window.nextOpenDescription) });
    }
    if (window?.note) {
      rows.push({ label: 'rToken note', value: window.note });
    }
    const rates = data.rates as Record<string, unknown> | null;
    if (rates && typeof rates === 'object' && !snap) {
      for (const [k, v] of Object.entries(rates).slice(0, 4)) {
        if (v != null && typeof v !== 'object') {
          rows.push({ label: k, value: String(v) });
        }
      }
    }
    if (data.source) rows.push({ label: 'Source', value: String(data.source) });
    if (rows.length) return { kind: 'rows', items: rows };
  }

  if (skillKey === 'sentiment' && data) {
    const rows: { label: string; value: string }[] = [];
    if (data.tone != null) {
      rows.push({
        label: 'Headline tone',
        value: `${String(data.tone)}${
          data.toneScore != null
            ? ` (score ${Number(data.toneScore) >= 0 ? '+' : ''}${data.toneScore})`
            : ''
        }`,
      });
    }
    if (data.positioning != null) {
      rows.push({ label: 'Positioning', value: String(data.positioning) });
    }
    if (data.momentum != null) {
      rows.push({ label: 'Tape momentum', value: String(data.momentum) });
    }
    if (data.change24h != null) {
      const c = Number(data.change24h);
      rows.push({
        label: '24h change',
        value: `${c >= 0 ? '+' : ''}${c.toFixed(2)}%`,
      });
    }
    if (data.headlineCount != null) {
      rows.push({
        label: 'Headlines scored',
        value: String(data.headlineCount),
      });
    }
    const samples = Array.isArray(data.sampleHeadlines)
      ? (data.sampleHeadlines as string[])
      : [];
    if (samples.length) {
      rows.push({
        label: 'Sample headlines',
        value: samples.slice(0, 3).join(' · '),
      });
    }
    if (data.source === 'not-applicable-for-stocks') {
      rows.push({
        label: 'Equity path',
        value: 'Use News tone + Technical momentum for positioning',
      });
      if (typeof data.guidance === 'string') {
        rows.push({ label: 'Why', value: data.guidance });
      }
      return { kind: 'rows', items: rows };
    }
    const fg = data.fearAndGreed as { value?: number; classification?: string } | null;
    if (fg?.value != null) {
      rows.push({
        label: 'Fear & Greed',
        value: `${fg.value}${fg.classification ? ` · ${fg.classification}` : ''}`,
      });
    }
    const derivatives = Array.isArray(data.derivatives)
      ? (data.derivatives as Array<Record<string, unknown>>)
      : [];
    for (const d of derivatives.slice(0, 3)) {
      const parts = [
        d.longShortRatio != null ? `L/S ${d.longShortRatio}` : null,
        d.fundingRate != null ? `funding ${d.fundingRate}` : null,
      ].filter(Boolean);
      if (parts.length) {
        rows.push({ label: String(d.symbol ?? 'Deriv'), value: parts.join(' · ') });
      }
    }
    if (typeof data.guidance === 'string') {
      rows.push({ label: 'Note', value: data.guidance });
    }
    if (data.source) rows.push({ label: 'Source', value: String(data.source) });
    if (rows.length) return { kind: 'rows', items: rows };
  }

  return { kind: 'empty' };
}

function SkillDetailBody({
  detail,
  summary,
  active,
}: {
  detail: SkillDetail;
  summary?: string | null;
  active: boolean;
}) {
  if (detail.kind === 'headlines') {
    return (
      <ul className="space-y-1.5">
        {detail.items.map((h, i) => (
          <li
            key={`${h.title}-${i}`}
            className="rounded-md border border-[#153653] bg-[#08172a] px-2.5 py-2"
          >
            {h.url ? (
              <a
                href={h.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-start gap-1.5 text-[8px] font-semibold text-[#9ec4e8] hover:text-[#57d9ff]"
              >
                <span className="min-w-0 flex-1">{h.title}</span>
                <ExternalLink size={10} className="mt-0.5 shrink-0" />
              </a>
            ) : (
              <p className="text-[8px] font-semibold text-[#9ec4e8]">{h.title}</p>
            )}
            <p className="mt-1 text-[7px] text-[#6f849d]">
              {[h.source, formatWhen(h.publishedAt)].filter(Boolean).join(' · ')}
            </p>
            {h.summary ? (
              <p className="mt-1 line-clamp-3 text-[8px] leading-3 text-[#8fa2b7]">
                {stripHtml(h.summary)}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    );
  }

  if (detail.kind === 'setups') {
    return (
      <ul className="space-y-1.5">
        {detail.items.map((item, i) => (
          <li
            key={`${item.Symbol}-${i}`}
            className="rounded-md border border-[#153653] bg-[#08172a] px-2.5 py-2"
          >
            <p className="text-[8px] font-semibold text-[#9ec4e8]">
              {item.Symbol}
              {item.Trend ? ` · ${item.Trend}` : ''}
            </p>
            <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
              {Object.entries(item)
                .filter(([k]) => k !== 'Symbol' && k !== 'Trend' && k !== 'Note')
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2 text-[7px]">
                    <span className="text-[#6f849d]">{k}</span>
                    <span className="text-[#c9d6e5]">{v}</span>
                  </div>
                ))}
            </div>
            {item.Note ? (
              <p className="mt-1 text-[7px] text-[#6f849d]">{item.Note}</p>
            ) : null}
          </li>
        ))}
      </ul>
    );
  }

  if (detail.kind === 'rows') {
    return (
      <ul className="space-y-1.5">
        {detail.items.map((row) => (
          <li
            key={row.label}
            className="flex items-start justify-between gap-3 rounded-md border border-[#153653] bg-[#08172a] px-2.5 py-2"
          >
            <span className="shrink-0 text-[8px] text-[#6f849d]">{row.label}</span>
            <span className="text-right text-[8px] leading-3 text-[#c9d6e5]">
              {row.value}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  if (detail.kind === 'text') {
    return (
      <ul className="space-y-1.5">
        {detail.items.map((t, i) => (
          <li
            key={i}
            className="rounded-md border border-[#153653] bg-[#08172a] px-2.5 py-2 text-[8px] leading-3 text-[#8fa2b7]"
          >
            {t}
          </li>
        ))}
      </ul>
    );
  }

  // Only show the prose summary when we truly have no structured payload.
  if (summary) {
    return <p className="text-[9px] leading-3.5 text-[#b7c7d8]">{summary}</p>;
  }

  return (
    <p className="text-[9px] text-[#71869f]">
      {active ? 'Skill is still running…' : 'No detail available for this skill yet.'}
    </p>
  );
}

function formatWhen(value?: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
