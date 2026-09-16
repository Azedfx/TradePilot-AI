'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ClipboardCheck, History, RefreshCw, Sparkles } from 'lucide-react';
import { NumberBadge } from '../ui/NumberBadge';
import { useResearch } from '@/lib/research-context';
import { getReview } from '@/lib/api';
import type { ReviewReport } from '@/lib/types';

/**
 * Self-evolution review: after a research run completes, surfaces the
 * auto-generated review report (bad-decision patterns flagged + a reusable
 * checklist for the trader's next idea). Backed by GET /api/review/:sessionId.
 */
export function SelfReview() {
  const { session, sessionId } = useResearch();
  const done = session?.status === 'COMPLETED';

  const [review, setReview] = useState<ReviewReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const report = await getReview(sessionId);
      setReview(report);
      setLoadedFor(sessionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load review');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Auto-load once per completed session.
  useEffect(() => {
    if (done && sessionId && loadedFor !== sessionId && !loading) {
      void load();
    }
  }, [done, sessionId, loadedFor, loading, load]);

  if (!done) {
    return (
      <section className="relative rounded-lg border border-[#173a5a] bg-[#071424]">
        <NumberBadge number="9" />
        <Header />
        <div className="p-5">
          <p className="text-[9px] leading-3.5 text-[#5f7189]">
            The self-evolution review runs automatically once this research
            session completes — it flags adverse decision patterns, checks
            them against your recent research history, and produces a
            reusable checklist for your next idea.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="relative rounded-lg border border-[#173a5a] bg-[#071424]">
      <NumberBadge number="9" />
      <Header onRefresh={() => void load()} loading={loading} />

      <div className="p-5">
        {error ? (
          <div className="rounded-lg border border-[#5c2b34] bg-[#2a141b] px-4 py-3 text-[10px] text-[#f5a0a6]">
            {error}
          </div>
        ) : !review ? (
          <p className="text-[9px] leading-3.5 text-[#5f7189]">
            {loading ? 'Generating review report…' : 'No review yet.'}
          </p>
        ) : (
          <div className="space-y-5">
            <p className="text-[11px] leading-4.25 text-[#d9e3ef]">{review.recap}</p>

            {review.recurring.length ? (
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <History size={12} className="text-[#f0625b]" />
                  <h3 className="text-[10px] font-semibold text-[#dbe6f3]">
                    Recurring across your research history
                  </h3>
                </div>
                <ul className="space-y-2">
                  {review.recurring.map((r, i) => (
                    <li
                      key={i}
                      className="rounded-lg border border-[#5c2b34] bg-[#2a141b] px-3 py-2 text-[9px] leading-3.75 text-[#f5b3a6]"
                    >
                      <span className="font-semibold">
                        Repeated in {r.occurrences}/{r.sessionsConsidered} of your recent reviewed sessions:
                      </span>{' '}
                      {r.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div>
              <div className="mb-2 flex items-center gap-2">
                <AlertTriangle size={12} className="text-[#f0a35b]" />
                <h3 className="text-[10px] font-semibold text-[#dbe6f3]">
                  Bad-decision patterns flagged ({review.badPatterns.length})
                </h3>
              </div>
              {review.badPatterns.length ? (
                <ul className="space-y-2">
                  {review.badPatterns.map((p, i) => (
                    <li
                      key={i}
                      className="rounded-lg border border-[#4d3a24] bg-[#241a0e] px-3 py-2 text-[9px] leading-3.75 text-[#e3c79a]"
                    >
                      {p}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[9px] leading-3.5 text-[#5f7189]">
                  No adverse patterns flagged — coverage and risk posture look
                  sound for this idea.
                </p>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2">
                <ClipboardCheck size={12} className="text-[#3bdbbc]" />
                <h3 className="text-[10px] font-semibold text-[#dbe6f3]">
                  Reusable checklist for the next idea
                </h3>
              </div>
              <ul className="space-y-2">
                {review.checklist.map((item, i) => (
                  <li
                    key={i}
                    className="rounded-lg border border-[#183754] bg-[#09182a] px-3 py-2"
                  >
                    <p className="text-[9px] font-medium text-[#c9d6e5]">
                      ☐ {item.check}
                    </p>
                    <p className="mt-1 text-[8px] leading-3 text-[#6f849d]">
                      {item.why}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </section>
  );
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
          <p className="text-[7px] uppercase tracking-wide text-[#5f7189]">
            Track 3 · Review &amp; Self-Evolution
          </p>
        </div>
      </div>
      {onRefresh ? (
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1 text-[9px] font-medium text-[#57d9ff] disabled:opacity-40"
        >
          <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      ) : null}
    </div>
  );
}
