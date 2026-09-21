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
  fundamentals: 'Fundamentals / Earnings',
  historical: 'Historical Scenarios',
  review: 'Self-Evolution Review',
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

        <div id="section-decision" className="scroll-mt-16">
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
        </div>
      </section>

      {/* Evidence */}
      <section
        id="section-sources"
        className="relative scroll-mt-16 border-b border-[#17324d] p-5"
      >
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

      {/* Full report */}
      {session?.report ? (
        <section className="relative p-5">
          <div className="mb-3 flex items-center gap-2">
            <FileText size={14} className="text-[#7da0ff]" />
            <h2 className="text-[12px] font-semibold">Research Report</h2>
          </div>
          <ResearchReportView markdown={session.report} />
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
    const venueLabel =
      md.venue === 'bitget-reality'
        ? `Bitget Reality (${md.rTokenSymbol ?? `r${session?.symbol}USDT`})`
        : 'Live market data';
    const cashNote =
      md.cashEquity && md.venue === 'bitget-reality'
        ? ` · cash ${md.cashEquity.symbol} $${md.cashEquity.last.toLocaleString(undefined, { maximumFractionDigits: 2 })}${
            md.rTokenVsCashPct != null
              ? ` (${md.rTokenVsCashPct >= 0 ? '+' : ''}${md.rTokenVsCashPct.toFixed(2)}% vs cash)`
              : ''
          }`
        : '';
    list.push({
      icon: '◉',
      title: `${session?.symbol ?? 'Asset'} trading at $${md.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}${(md.change24h ?? 0) >= 0 ? ' (+' : ' ('}${(md.change24h ?? 0).toFixed(2)}% 24h)${cashNote}`,
      source: venueLabel,
      time: 'real-time',
      blue: true,
    });
  }

  // Prefer fundamentals expectation-gap in Key Evidence for judges.
  const fundFinding = findings.find((f) => f.category === 'fundamentals');
  const fundData = (fundFinding?.data ?? null) as {
    expectationGap?: { summary?: string } | null;
    rangePosition?: { summary?: string } | null;
    source?: string;
  } | null;
  if (fundData?.expectationGap?.summary) {
    list.push({
      icon: '✓',
      title: fundData.expectationGap.summary,
      source:
        fundData.source === 'finnhub'
          ? 'Fundamentals · Finnhub earnings'
          : 'Fundamentals / expectation gap',
      time: 'live',
      positive: /beat|\+/i.test(fundData.expectationGap.summary),
      warning: /miss|-/i.test(fundData.expectationGap.summary),
    });
  } else if (fundData?.rangePosition?.summary) {
    list.push({
      icon: '◉',
      title: fundData.rangePosition.summary,
      source: 'Fundamentals · 52w range',
      time: 'live',
      blue: true,
    });
  }

  const skillFindings = findings.filter((f) =>
    ['news', 'market', 'macro', 'sentiment', 'technical', 'fundamentals', 'historical'].includes(
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

/** Lightweight markdown → structured report cards (no raw # / ** dump). */
function ResearchReportView({ markdown }: { markdown: string }) {
  const parsed = parseReportMarkdown(markdown);

  return (
    <div className="max-h-80 space-y-3 overflow-auto rounded-lg border border-[#183754] bg-[#09182a] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[11px] font-semibold text-[#dce8f7]">{parsed.title}</p>
        {parsed.bias ? (
          <span className="rounded bg-[#163351] px-2 py-0.5 text-[7px] font-semibold uppercase text-[#54d8ff]">
            {parsed.bias}
          </span>
        ) : null}
        {parsed.confidence ? (
          <span className="rounded bg-[#0d2a24] px-2 py-0.5 text-[7px] font-semibold text-[#3bdbbc]">
            {parsed.confidence}
          </span>
        ) : null}
      </div>

      {parsed.summary ? (
        <p className="text-[9px] leading-3.75 text-[#a8b9cc]">{parsed.summary}</p>
      ) : null}

      {parsed.sections.map((section) => (
        <div key={section.heading}>
          <h3 className="mb-1.5 text-[9px] font-semibold uppercase tracking-wide text-[#7ea0c4]">
            {section.heading}
          </h3>
          {section.bullets.length ? (
            <ul className="space-y-1">
              {section.bullets.map((b, i) => (
                <li
                  key={`${section.heading}-${i}`}
                  className="flex gap-2 text-[8px] leading-3.25 text-[#9ab0c6]"
                >
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[#3d6a94]" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          ) : section.body ? (
            <p className="text-[8px] leading-3.25 text-[#9ab0c6]">{section.body}</p>
          ) : null}
        </div>
      ))}

      {parsed.footer ? (
        <p className="text-[7px] text-[#5f7189]">{parsed.footer}</p>
      ) : null}
    </div>
  );
}

function parseReportMarkdown(markdown: string): {
  title: string;
  bias: string | null;
  confidence: string | null;
  summary: string;
  sections: Array<{ heading: string; bullets: string[]; body: string }>;
  footer: string | null;
} {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let title = 'Research Report';
  let bias: string | null = null;
  let confidence: string | null = null;
  const summaryParts: string[] = [];
  const sections: Array<{ heading: string; bullets: string[]; body: string }> =
    [];
  let current: { heading: string; bullets: string[]; bodyParts: string[] } | null =
    null;
  let footer: string | null = null;

  const flush = () => {
    if (!current) return;
    sections.push({
      heading: current.heading,
      bullets: current.bullets,
      body: current.bodyParts.join(' ').trim(),
    });
    current = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith('# ')) {
      title = line.replace(/^#\s+/, '').replace(/\s*[—-]\s*Research Report$/i, '').trim()
        || title;
      if (!/research report/i.test(title)) title = `${title} — Research Report`;
      continue;
    }

    const meta = /^\*\*Bias:\*\*\s*(\w+)\s*\|\s*\*\*Confidence:\*\*\s*([\d.]+%)/i.exec(
      line,
    );
    if (meta) {
      bias = meta[1];
      confidence = meta[2];
      continue;
    }

    if (line.startsWith('## ')) {
      flush();
      current = {
        heading: line.replace(/^##\s+/, ''),
        bullets: [],
        bodyParts: [],
      };
      continue;
    }

    if (line.startsWith('_') && line.endsWith('_')) {
      footer = line.replace(/^_|_$/g, '');
      continue;
    }

    const bullet = /^[-*]\s+(.+)$/.exec(line);
    if (bullet) {
      const text = bullet[1].replace(/\*\*(.*?)\*\*/g, '$1');
      if (current) current.bullets.push(text);
      else summaryParts.push(text);
      continue;
    }

    const prose = line.replace(/\*\*(.*?)\*\*/g, '$1');
    if (current) current.bodyParts.push(prose);
    else summaryParts.push(prose);
  }
  flush();

  return {
    title,
    bias,
    confidence,
    summary: summaryParts.join(' ').replace(/\s+/g, ' ').trim(),
    sections,
    footer,
  };
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
