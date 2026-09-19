'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckSquare,
  ClipboardCheck,
  History,
  RefreshCw,
  Sparkles,
  Square,
} from 'lucide-react';
import { NumberBadge } from '../ui/NumberBadge';
import { useResearch } from '@/lib/research-context';
import { getReview } from '@/lib/api';
import type { ReviewReport } from '@/lib/types';

const CHECKLIST_STORAGE_KEY = 'tradepilot:next-idea-checklist';

/**
 * Self-evolution review after a completed research run.
 * Surfaces this-session critique, cross-session recurrence, and a
 * next-idea checklist (GET /api/review/:sessionId).
 *
 * Checklist ticks = "I acknowledged this for my next idea" on this device.
 * They do not change the thesis or API — they help the trader carry lessons forward.
 */
export function SelfReview() {
  const { session, sessionId } = useResearch();
  const done = session?.status === 'COMPLETED';

  const [review, setReview] = useState<ReviewReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [acked, setAcked] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const report = await getReview(sessionId);
      setReview(report);
      setLoadedFor(sessionId);
      setAcked(readAcked());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load review');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (done && sessionId && loadedFor !== sessionId && !loading) {
      void load();
    }
  }, [done, sessionId, loadedFor, loading, load]);

  const toggleAck = (check: string) => {
    setAcked((prev) => {
      const next = { ...prev, [check]: !prev[check] };
      writeAcked(next);
      return next;
    });
  };

  if (!done) {
    return (
      <section
        id="section-review"
        className="relative scroll-mt-16 rounded-lg border border-[#173a5a] bg-[#071424]"
      >
        <NumberBadge number="9" />
        <Header />
        <div className="p-5">
          <p className="text-[9px] leading-3.5 text-[#5f7189]">
            After this run finishes, TradePilot reviews the thesis for risk
            mistakes, checks whether you&apos;ve made the same ones before, and
            builds a short checklist for the next idea.
          </p>
        </div>
      </section>
    );
  }

  const patterns =
    review?.patterns?.length
      ? review.patterns
      : (review?.badPatterns ?? []).map((message, i) => ({
          id: `pattern-${i}`,
          message,
        }));

  const recurringIds = new Set(review?.recurring.map((r) => r.id) ?? []);
  const thisSessionOnly = patterns.filter((p) => !recurringIds.has(p.id));
  const checkedCount = review
    ? review.checklist.filter((item) => acked[item.check]).length
    : 0;

  return (
    <section
      id="section-review"
      className="relative scroll-mt-16 rounded-lg border border-[#173a5a] bg-[#071424]"
    >
      <NumberBadge number="9" />
      <Header onRefresh={() => void load()} loading={loading} />

      <div className="p-5">
        {error ? (
          <div className="rounded-lg border border-[#5c2b34] bg-[#2a141b] px-4 py-3 text-[10px] text-[#f5a0a6]">
            {error}
          </div>
        ) : !review ? (
          <p className="text-[9px] leading-3.5 text-[#5f7189]">
            {loading ? 'Generating review…' : 'No review yet.'}
          </p>
        ) : (
          <div className="space-y-5">
            <p className="text-[11px] leading-4.25 text-[#d9e3ef]">
              {humanRecap(review.recap)}
            </p>

            {review.recurring.length ? (
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <History size={12} className="text-[#f0625b]" />
                  <h3 className="text-[10px] font-semibold text-[#dbe6f3]">
                    You&apos;ve seen this before
                  </h3>
                </div>
                <ul className="space-y-2">
                  {review.recurring.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-lg border border-[#5c2b34] bg-[#2a141b] px-3 py-2.5"
                    >
                      <p className="text-[8px] font-semibold text-[#f5a0a6]">
                        Showed up in {r.occurrences} of your last{' '}
                        {r.sessionsConsidered} reviews
                      </p>
                      <p className="mt-1 text-[9px] leading-3.75 text-[#f5b3a6]">
                        {r.message}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {thisSessionOnly.length ? (
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <AlertTriangle size={12} className="text-[#f0a35b]" />
                  <h3 className="text-[10px] font-semibold text-[#dbe6f3]">
                    Flagged on this thesis
                  </h3>
                </div>
                <ul className="space-y-2">
                  {thisSessionOnly.map((p) => (
                    <li
                      key={p.id}
                      className="rounded-lg border border-[#4d3a24] bg-[#241a0e] px-3 py-2.5 text-[9px] leading-3.75 text-[#e3c79a]"
                    >
                      {p.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {!review.recurring.length && !thisSessionOnly.length ? (
              <p className="text-[9px] leading-3.5 text-[#5f7189]">
                No adverse patterns flagged — coverage and risk posture look
                sound for this idea.
              </p>
            ) : null}

            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ClipboardCheck size={12} className="text-[#3bdbbc]" />
                  <h3 className="text-[10px] font-semibold text-[#dbe6f3]">
                    Before your next idea
                  </h3>
                </div>
                <span className="text-[7px] text-[#5f7189]">
                  {checkedCount}/{review.checklist.length} acknowledged
                </span>
              </div>
              <p className="mb-2 text-[8px] leading-3 text-[#6f849d]">
                Tick when you&apos;ve considered the point for your next
                research question. Saved on this device only — it doesn&apos;t
                change this thesis.
              </p>
              <ul className="space-y-2">
                {review.checklist.map((item) => {
                  const on = Boolean(acked[item.check]);
                  return (
                    <li key={item.check}>
                      <button
                        type="button"
                        onClick={() => toggleAck(item.check)}
                        className={`flex w-full cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition ${
                          on
                            ? 'border-[#087263] bg-[#08242a]'
                            : 'border-[#183754] bg-[#09182a] hover:border-[#24496d]'
                        }`}
                      >
                        {on ? (
                          <CheckSquare
                            size={14}
                            className="mt-0.5 shrink-0 text-[#3bdbbc]"
                          />
                        ) : (
                          <Square
                            size={14}
                            className="mt-0.5 shrink-0 text-[#6f849d]"
                          />
                        )}
                        <span>
                          <p
                            className={`text-[9px] font-medium leading-3.5 ${
                              on
                                ? 'text-[#8fd9c8] line-through'
                                : 'text-[#c9d6e5]'
                            }`}
                          >
                            {item.check}
                          </p>
                          <p className="mt-1 text-[8px] leading-3 text-[#6f849d]">
                            {item.why}
                          </p>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function readAcked(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(CHECKLIST_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAcked(next: Record<string, boolean>) {
  try {
    localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / private mode
  }
}

function humanRecap(recap: string): string {
  const direction = /Direction\s+(\w+)/i.exec(recap)?.[1];
  const confidence = /confidence\s+(\d+)%/i.exec(recap)?.[1];
  const drawdown = /drawdown\s+([\d.]+)%/i.exec(recap)?.[1];
  const stop = /suggested stop\s+([\d.]+)%/i.exec(recap)?.[1];

  if (!direction && !confidence) return recap;

  const parts: string[] = [];
  if (direction) {
    parts.push(
      `Thesis leans ${direction === 'long' ? 'bullish' : direction === 'short' ? 'bearish' : 'neutral'}`,
    );
  }
  if (confidence) parts.push(`${confidence}% confidence`);
  if (drawdown) parts.push(`worst stress drawdown ${drawdown}%`);
  if (stop) parts.push(`suggested stop ${stop}%`);
  return `${parts.join(' · ')}.`;
}

function Header({
  onRefresh,
  loading,
}: {
  onRefresh?: () => void;
  loading?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-[#142b44] px-5 py-4">
      <div className="flex items-center gap-2">
        <Sparkles size={14} className="text-[#7298ff]" />
        <div>
          <h2 className="text-[13px] font-semibold">Self-Evolution Review</h2>
          <p className="text-[8px] text-[#5f7189]">
            Learn from this run before the next one
          </p>
        </div>
      </div>
      {onRefresh ? (
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="flex cursor-pointer items-center gap-1 text-[9px] font-medium text-[#57d9ff] disabled:opacity-40"
        >
          <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      ) : null}
    </div>
  );
}
