import {
  Activity,
  Brain,
  CheckCircle2,
  Clock,
  History,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { NumberBadge } from '../ui/NumberBadge';
import { useResearch } from '@/lib/research-context';
import type { MarketWindow } from '@/lib/types';

export function ResearchThesis() {
  const { session } = useResearch();
  const thesis = session?.thesis;
  const direction = thesis?.direction ?? null;
  const label =
    direction === 'long'
      ? 'Bullish'
      : direction === 'short'
        ? 'Bearish'
        : direction === 'neutral'
          ? 'Neutral'
          : 'Awaiting analysis';
  const confidence = thesis ? Math.round(thesis.confidence * 100) : 0;
  const catalysts: string[] = (thesis?.catalysts ?? []).map((c) =>
    typeof c === 'string'
      ? c
      : String((c as { title?: string })?.title ?? ''),
  );
  const risks: string[] = (thesis?.risks ?? []).map((r) =>
    typeof r === 'string'
      ? r
      : String((r as { title?: string })?.title ?? ''),
  );
  const done = session?.status === 'COMPLETED';

  return (
    <section className="relative rounded-lg border border-[#173957] bg-[#071424]">
      <div className="p-5">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div className="flex gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#142b53] text-[#75a6ff]">
              <Brain size={16} />
            </div>

            <div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-semibold tracking-wide text-[#c6d7ea]">
                  RESEARCH THESIS
                </span>

                <span
                  className={`rounded-md px-3 py-1 text-[9px] font-semibold ${
                    thesis
                      ? 'bg-[#06433f] text-[#46e6c4]'
                      : 'bg-[#1c3048] text-[#8298b2]'
                  }`}
                >
                  {label}
                </span>
              </div>

              <p className="mt-3 max-w-140 text-[12px] leading-4.5 text-[#d9e3ef]">
                {thesis?.rationale ??
                  (done
                    ? 'Thesis generation is still being processed — refresh shortly.'
                    : 'Run a research prompt to generate a live thesis from the five research skills.')}
              </p>
            </div>
          </div>

          {/* Confidence */}
          <div className="w-full md:w-48.75">
            <div className="mb-1 text-[9px] text-[#8195ac]">Confidence</div>

            <div className="flex items-center gap-3">
              <span className="text-[16px] font-semibold">
                {thesis ? `${confidence}%` : '—'}
              </span>

              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#203856]">
                <div
                  className="h-full rounded-full bg-[#39d9b1]"
                  style={{ width: `${thesis ? confidence : 0}%` }}
                />
              </div>
            </div>

            <div className="mt-1 h-px w-7.5 bg-[#39d9b1]" />
          </div>
        </div>

        <MarketWindowBanner window={session?.marketWindow ?? null} symbol={session?.symbol} />

        {/* Thesis Cards */}
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <ThesisMiniCard
            icon={<TrendingUp size={14} />}
            title="Key Catalysts"
            positive
            items={
              catalysts.length
                ? catalysts
                : [
                    thesis
                      ? 'No catalysts extracted for this run.'
                      : 'Waiting for a research run…',
                  ]
            }
            dim={!catalysts.length}
          />

          <ThesisMiniCard
            icon={<TrendingDown size={14} />}
            title="Key Risks"
            danger
            items={
              risks.length
                ? risks
                : [
                    thesis
                      ? 'No risks extracted for this run.'
                      : 'Waiting for a research run…',
                  ]
            }
            dim={!risks.length}
          />

          <HistoricalCard />
        </div>

        {/* Stress Testing */}
        <section className="relative mt-3 rounded-lg border border-[#153653] bg-[#08172a] p-4">
          <NumberBadge number="6" />

          <div className="mb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-full border border-[#617b9d]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#8ca8c8]" />
              </div>

              <h3 className="text-[11px] font-semibold">Stress Testing</h3>
            </div>

            <p className="ml-7 mt-1 text-[8px] text-[#748aa3]">
              How would {session?.symbol ?? 'the asset'} perform under different
              scenarios?
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {renderScenarios(session?.stressTests)}
          </div>
        </section>
      </div>
    </section>
  );
}

function renderScenarios(
  stressTests: unknown[] | null | undefined,
): ReactNode {
  if (stressTests?.length) {
    return stressTests.map((st, i) => {
      const s = st as {
        symbol: string;
        scenarios: {
          name: string;
          worstCase: number;
        }[];
        recommendation?: string;
      };
      const sc = s.scenarios?.[0];
      const drawdown = sc?.worstCase ?? 0;
      const positive = drawdown >= 0;
      const title = prettify(sc?.name ?? s.symbol);
      return (
        <ScenarioCard
          key={i}
          title={title}
          subtitle={
            s.recommendation ? truncateRecommendation(s.recommendation) : 'No guidance generated'
          }
          returnValue={`${positive ? '+' : ''}${(drawdown * 100).toFixed(1)}%`}
          probability={drawdown < 0 ? `${Math.round(Math.abs(drawdown) * 100)}% tail` : 'benign'}
          positive={positive}
        />
      );
    });
  }

  return (
    <div className="col-span-full rounded-lg border border-dashed border-[#27405e] bg-[#08172a] px-4 py-6 text-center text-[9px] text-[#748aa3]">
      No stress scenarios yet — they are generated after a research run completes.
    </div>
  );
}

/**
 * Shows the live US-market-hours status for a stock / tokenized rToken
 * session — the S2 hackathon's core scenario: the underlying NYSE/Nasdaq
 * session can be closed (nights, weekends) while an rToken keeps pricing
 * it 7×24 on-chain. Renders nothing for crypto sessions or before a
 * market-window reading exists.
 */
function MarketWindowBanner({
  window,
  symbol,
}: {
  window: MarketWindow | null | undefined;
  symbol?: string | null;
}) {
  if (!window) return null;

  const label = {
    regular: 'Regular session · open',
    'pre-market': 'Pre-market',
    'after-hours': 'After-hours',
    'closed-overnight': 'Closed overnight',
    'closed-weekend': 'Closed for the weekend',
  }[window.session];

  if (window.isRegularSessionOpen) {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-[#194a3c] bg-[#062018] px-3 py-2">
        <Clock size={12} className="shrink-0 text-[#3bdbbc]" />
        <p className="text-[9px] leading-3.5 text-[#8fd9c4]">
          <span className="font-semibold">US market: {label}</span> ({window.etClock}) —{' '}
          {symbol ?? 'this asset'} is trading during standard NYSE/Nasdaq hours.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#5c4a24] bg-[#2a2010] px-3 py-2">
      <Clock size={12} className="mt-px shrink-0 text-[#f0c25b]" />
      <p className="text-[9px] leading-3.75 text-[#e3cf9a]">
        <span className="font-semibold">US market: {label}</span> ({window.etClock}, reopens{' '}
        {window.nextOpenDescription}) — {window.note}
      </p>
    </div>
  );
}

function prettify(name: string): string {
  return name
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function truncateRecommendation(s: string): string {
  const max = 64;
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function ThesisMiniCard({
  icon,
  title,
  items,
  positive,
  danger,
  dim,
}: {
  icon: ReactNode;
  title: string;
  items: string[];
  positive?: boolean;
  danger?: boolean;
  dim?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[#183754] bg-[#09182a] p-3">
      <div className="mb-3 flex items-center gap-2">
        <div
          className={`flex h-6 w-6 items-center justify-center rounded-md ${
            positive
              ? 'bg-[#075044] text-[#43dfbf]'
              : danger
                ? 'bg-[#4d2227] text-[#f55e64]'
                : 'bg-[#233a70] text-[#7da0ff]'
          }`}
        >
          {icon}
        </div>

        <span className="text-[10px] font-semibold">{title}</span>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item}
            className={`flex gap-2 text-[8px] leading-3 ${
              dim ? 'text-[#5f7189]' : 'text-[#8fa2b7]'
            }`}
          >
            <CheckCircle2
              size={11}
              className={`mt-px shrink-0 ${
                dim
                  ? 'text-[#4a5a70]'
                  : danger
                    ? 'text-[#ed565e]'
                    : 'text-[#2bcdb4]'
              }`}
            />

            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function HistoricalCard() {
  const { session } = useResearch();
  const matches = session?.historicalMatches;
  const count = matches?.length ?? 0;

  return (
    <div className="rounded-lg border border-[#183754] bg-[#09182a] p-3">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#253c76] text-[#7ca3ff]">
          <History size={14} />
        </div>

        <span className="text-[10px] font-semibold">Historical Context</span>
      </div>

      {count > 0 ? (
        <>
          <p className="text-[9px] font-medium text-[#4ad9ff]">
            {count} similar historical {count === 1 ? 'event' : 'events'} matched
            for this run
          </p>

          <div className="mt-3 grid grid-cols-1 gap-y-2">
            {matches!.slice(0, 3).map((m, i) => {
              const match = m as {
                similarityScore?: number;
                similarityExplanation?: string | null;
              };
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 text-[8px] text-[#8fa2b7]"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#7ca3ff]" />
                  <span className="truncate">
                    {match.similarityExplanation ??
                      `Match with ${Math.round((match.similarityScore ?? 0) * 100)}% similarity`}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <p className="text-[9px] leading-3.5 text-[#5f7189]">
          {session?.status === 'COMPLETED'
            ? 'No historical matches found for this asset.'
            : 'Historical context appears after a research run completes.'}
        </p>
      )}
    </div>
  );
}

function ScenarioCard({
  title,
  subtitle,
  returnValue,
  probability,
  positive,
  danger,
}: {
  title: string;
  subtitle: string;
  returnValue: string;
  probability: string;
  positive?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        positive
          ? 'border-[#087263] bg-[#08242a]'
          : danger
            ? 'border-[#66343b] bg-[#22171e]'
            : 'border-[#23486e] bg-[#0a1c31]'
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        <div
          className={`flex h-5 w-5 items-center justify-center rounded-md ${
            positive
              ? 'bg-[#075044] text-[#36dcb9]'
              : danger
                ? 'bg-[#57262d] text-[#f25c63]'
                : 'bg-[#203d7b] text-[#7097ff]'
          }`}
        >
          {positive ? (
            <TrendingUp size={11} />
          ) : danger ? (
            <TrendingDown size={11} />
          ) : (
            <Activity size={11} />
          )}
        </div>

        <span
          className={`text-[9px] font-semibold ${
            positive
              ? 'text-[#34d9b5]'
              : danger
                ? 'text-[#ef6269]'
                : 'text-[#82a4ff]'
          }`}
        >
          {title}
        </span>
      </div>

      <p className="text-[7px] text-[#778ba2]">{subtitle}</p>

      <div className="mt-3 flex items-end justify-between">
        <div>
          <p className="text-[7px] text-[#71869f]">◉ Median 5D Return</p>
          <p
            className={`mt-1 text-[14px] font-semibold ${
              positive
                ? 'text-[#38d8b6]'
                : danger
                  ? 'text-[#f05d65]'
                  : 'text-[#7ea5ff]'
            }`}
          >
            {returnValue}
          </p>
        </div>

        <div className="text-right">
          <p className="text-[7px] text-[#71869f]">Probability</p>
          <p className="mt-1 text-[11px] font-semibold text-[#dce7f3]">
            {probability}
          </p>
        </div>
      </div>
    </div>
  );
}