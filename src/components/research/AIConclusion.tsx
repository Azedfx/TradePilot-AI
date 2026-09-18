'use client';

import { useState } from 'react';
import { Check, FileText, Search, Sparkles, X } from 'lucide-react';
import { NumberBadge } from '../ui/NumberBadge';
import { useResearch } from '@/lib/research-context';
import { submitDecision } from '@/lib/api';
import type { FindingView, ResearchSessionResponse } from '@/lib/types';

interface Evidence {
  icon: string;
  title: string;
  source: string;
  time: string;
  positive?: boolean;
  warning?: boolean;
  blue?: boolean;
}

const SKILL_LABEL: Record<string, string> = {
  news: 'News Briefing',
  market: 'Market Intel',
  macro: 'Macro Analyst',
  sentiment: 'Sentiment Analyst',
  technical: 'Technical Analysis',
  historical: 'Historical Distribution',
};

export function AIConclusion({
  embedded = false,
}: {
  /** When true, render inline (e.g. My Research) instead of the desktop aside. */
  embedded?: boolean;
}) {
  const { session, sessionId, openSession } = useResearch();
  const thesis = session?.thesis;
  const done = session?.status === 'COMPLETED';
  const [busy, setBusy] = useState(false);
  const [localDecision, setLocalDecision] = useState<
    'accepted' | 'rejected' | null
  >(null);

  const decision = localDecision ?? session?.decision ?? null;

  const conclusion =
    thesis?.rationale ??
    'Run a research prompt to generate an AI conclusion. The system pulls from news, market data, and historical scenarios before summarizing a recommended direction.';

  const evidence = buildEvidence(session);

  const onDecide = async (next: 'accepted' | 'rejected') => {
    if (!sessionId || busy || decision) return;
    setBusy(true);
    try {
      await submitDecision(sessionId, next);
      setLocalDecision(next);
      await openSession(sessionId);
    } catch {
      // Keep UI usable; decision can be retried.
    } finally {
      setBusy(false);
    }
  };

  const body = (
    <>
      {/* AI Conclusion */}
      <section className="relative border-b border-[#17324d] p-5">
        <NumberBadge number="7" />

        <div className="mb-4 flex items-center gap-2">
          <Sparkles size={15} className="text-[#7298ff]" />
          <h2 className="text-[13px] font-semibold text-[#dce8f7]">
            AI Conclusion
          </h2>
        </div>

        <p className="text-[10px] leading-4.25 text-[#a8b9cc]">
          {conclusion}
        </p>

        {thesis ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-md bg-[#163351] px-2 py-1 text-[8px] font-semibold text-[#54d8ff]">
              {thesis.direction === 'long'
                ? 'Bullish'
                : thesis.direction === 'short'
                  ? 'Bearish'
                  : 'Neutral'}
            </span>
            <span className="rounded-md bg-[#0d2a24] px-2 py-1 text-[8px] font-semibold text-[#3bdbbc]">
              {Math.round(thesis.confidence * 100)}% confidence
            </span>
            {session?.symbol ? (
              <span className="rounded-md bg-[#1c3048] px-2 py-1 text-[8px] font-semibold text-[#8298b2]">
                {session.symbol}
              </span>
            ) : null}
          </div>
        ) : null}

        <p className="mt-4 text-[8px] leading-3.5 text-[#5f7189]">
          Track 3 · AI assists — you make the final call.
        </p>

        {decision ? (
          <div
            className={`mt-3 flex items-center gap-2 rounded-md px-3 py-2 text-[9px] font-semibold ${
              decision === 'accepted'
                ? 'border border-[#087263] bg-[#08242a] text-[#36dcb9]'
                : 'border border-[#66343b] bg-[#22171e] text-[#f25c63]'
            }`}
          >
            {decision === 'accepted' ? <Check size={12} /> : <X size={12} />}
            Thesis {decision === 'accepted' ? 'accepted' : 'rejected'} by you
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              disabled={!done || busy}
              onClick={() => void onDecide('accepted')}
              className="flex items-center justify-center gap-1 rounded-md bg-[#6177ff] py-2.5 text-[9px] font-semibold text-white shadow-[0_5px_20px_rgba(79,95,220,.25)] hover:bg-[#7185ff] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FileText size={10} />
              Accept Thesis
            </button>

            <button
              disabled={!done || busy}
              onClick={() => void onDecide('rejected')}
              className="rounded-md border border-[#35506d] py-2.5 text-[9px] font-medium text-[#a5b6ca] hover:bg-[#0b1c30] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Reject Thesis
            </button>
          </div>
        )}
      </section>

      {/* Evidence */}
      <section className="relative border-b border-[#17324d] p-5">
        <NumberBadge number="8" />

        <div className="mb-4 flex items-center gap-2">
          <Search size={14} className="text-[#67b9ff]" />
          <h2 className="text-[13px] font-semibold">Key Evidence</h2>
        </div>

        {evidence.length ? (
          evidence.map((e, i) => (
            <EvidenceItem key={`${e.title}-${i}`} {...e} />
          ))
        ) : (
          <p className="text-[9px] leading-3.5 text-[#5f7189]">
            Key evidence from the live research run will appear here once data is
            returned by the skills.
          </p>
        )}
      </section>

      {/* Full report excerpt */}
      {session?.report ? (
        <section className="relative p-5">
          <div className="mb-3 flex items-center gap-2">
            <FileText size={14} className="text-[#7da0ff]" />
            <h2 className="text-[12px] font-semibold">Research Report</h2>
          </div>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-[#183754] bg-[#09182a] p-3 text-[8px] leading-3.5 text-[#9ab0c6]">
            {session.report.slice(0, 2400)}
            {session.report.length > 2400 ? '\n…' : ''}
          </pre>
        </section>
      ) : null}
    </>
  );

  if (embedded) {
    return (
      <div className="rounded-lg border border-[#173a5a] bg-[#04101e]">
        {body}
      </div>
    );
  }

  return (
    <aside className="hidden border-l border-[#142d47] bg-[#04101e] xl:block">
      {body}
    </aside>
  );
}

function buildEvidence(
  session: ResearchSessionResponse | null,
): Evidence[] {
  const list: Evidence[] = [];
  const md = session?.marketData;
  const findings = session?.findings ?? [];

  if (md?.price) {
    list.push({
      icon: '◉',
      title: `${session?.symbol ?? 'Asset'} trading at $${md.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}${(md.change24h ?? 0) >= 0 ? ' (+' : ' ('}${(md.change24h ?? 0).toFixed(2)}% 24h)`,
      source: 'Live market data',
      time: 'real-time',
      blue: true,
    });
  }

  const skillFindings = findings.filter((f) =>
    ['news', 'market', 'macro', 'sentiment', 'technical', 'historical'].includes(
      f.category,
    ),
  );

  for (const f of skillFindings.slice(0, 6)) {
    list.push(findingToEvidence(f));
  }

  if (list.length <= 1) {
    const catalysts = (session?.thesis?.catalysts ?? [])
      .map((c) =>
        typeof c === 'string'
          ? c
          : String((c as { title?: string })?.title ?? ''),
      )
      .filter(Boolean);
    const risks = (session?.thesis?.risks ?? [])
      .map((r) =>
        typeof r === 'string'
          ? r
          : String((r as { title?: string })?.title ?? ''),
      )
      .filter(Boolean);

    catalysts.slice(0, 2).forEach((c) => {
      list.push({
        icon: '✓',
        title: c,
        source: 'Research findings',
        time: 'live',
        positive: true,
      });
    });
    risks.slice(0, 2).forEach((r) => {
      list.push({
        icon: '✗',
        title: r,
        source: 'Risk analysis',
        time: 'live',
        warning: true,
      });
    });
  }

  return list;
}

function findingToEvidence(f: FindingView): Evidence {
  const label = SKILL_LABEL[f.category] ?? f.category;
  const warning =
    f.category === 'macro' ||
    /risk|bear|fear|down|drawdown/i.test(f.statement);
  const positive =
    f.category === 'technical' ||
    /bull|positive|constructive|oversold/i.test(f.statement);

  return {
    icon: warning ? '!' : positive ? '✓' : '◉',
    title: truncate(f.statement, 140),
    source: label,
    time: 'live',
    positive: positive && !warning,
    warning,
    blue: !positive && !warning,
  };
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function EvidenceItem({
  icon,
  title,
  source,
  time,
  positive,
  warning,
  blue,
}: {
  icon: string;
  title: string;
  source: string;
  time: string;
  positive?: boolean;
  warning?: boolean;
  blue?: boolean;
}) {
  return (
    <div className="mb-3 flex gap-3">
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[12px] font-semibold ${
          positive
            ? 'bg-[#075044] text-[#3bdbbc]'
            : warning
              ? 'bg-[#513024] text-[#ef805d]'
              : blue
                ? 'bg-[#253c75] text-[#789dff]'
                : 'bg-[#23344a] text-[#88a0bb]'
        }`}
      >
        {icon}
      </div>

      <div className="min-w-0">
        <p className="text-[9px] leading-3.5 text-[#c9d6e5]">{title}</p>
        <p className="mt-1 text-[8px] text-[#6f849d]">
          Source: {source} | {time}
        </p>
      </div>
    </div>
  );
}
