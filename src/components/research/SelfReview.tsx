'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckSquare,
  ChevronDown,
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

/**
 * Self-evolution review: after a research run completes, surfaces the
 * auto-generated review report (bad-decision patterns flagged + a reusable
 * checklist for the trader's next idea). Backed by GET /api/review/:sessionId.
 *
 * This is the Track 3 demo surface: judges should see (1) this-session
 * critique, (2) cross-session recurrence, (3) a reusable next-idea checklist.
 */
export function SelfReview() {
  const { session, sessionId } = useResearch();
  const done = session?.status === 'COMPLETED';

  const [review, setReview] = useState<ReviewReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [showMarkdown, setShowMarkdown] = useState(false);

  const load = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const report = await getReview(sessionId);
      setReview(report);
      setLoadedFor(sessionId);
      setChecked({});
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
            The self-evolution review runs automatically once this research
            session completes — it flags adverse decision patterns, checks
            them against your recent research history, and produces a
            reusable checklist for your next idea.
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

  const skillsDone = review?.skillsCompleted ?? session?.skills.filter((s) => s.status === 'COMPLETED').length ?? 0;
  const skillsPlanned = review?.plannedSkills ?? Math.max(skillsDone, 5);
  const checkedCount = Object.values(checked).filter(Boolean).length;

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
            {loading ? 'Generating review report…' : 'No review yet.'}
          </p>
        ) : (
          <div className="space-y-5">
            <div className="rounded-lg border border-[#1f3f63] bg-[#0a1a2e] px-3 py-2.5">
              <p className="text-[8px] font-semibold uppercase tracking-wide text-[#57d9ff]">
                Track 3 loop · critique → memory → next checklist
              </p>
              <p className="mt-1 text-[9px] leading-3.5 text-[#8fa2b7]">
                AI reviews this thesis for bad-decision patterns, checks whether
                those same pattern IDs appeared in your recent sessions, then
                emits a reusable checklist you can apply to the next idea.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatChip
                label="Skill coverage"
                value={`${skillsDone}/${skillsPlanned || '—'}`}
              />
              <StatChip
                label="Patterns flagged"
                value={String(patterns.length)}
              />
              <StatChip
                label="Recurring"
                value={String(review.recurring.length)}
              />
              <StatChip
                label="Checklist items"
                value={`${checkedCount}/${review.checklist.length}`}
              />
            </div>

            <div>
              <p className="text-[10px] font-semibold text-[#dbe6f3]">
                {review.title}
              </p>
              <p className="mt-1 text-[11px] leading-4.25 text-[#d9e3ef]">
                {review.recap}
              </p>
              <p className="mt-1 text-[7px] text-[#5f7189]">
                Generated {new Date(review.generatedAt).toLocaleString()} ·{' '}
                {review.source} engine
              </p>
            </div>

            {review.recurring.length ? (
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <History size={12} className="text-[#f0625b]" />
                  <h3 className="text-[10px] font-semibold text-[#dbe6f3]">
                    Recurring across your research history
                  </h3>
                </div>
                <ul className="space-y-2">
                  {review.recurring.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-lg border border-[#5c2b34] bg-[#2a141b] px-3 py-2 text-[9px] leading-3.75 text-[#f5b3a6]"
                    >
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="rounded bg-[#4d2227] px-1.5 py-0.5 font-mono text-[7px] text-[#f5a0a6]">
                          {r.id}
                        </span>
                        <span className="font-semibold">
                          Repeated in {r.occurrences}/{r.sessionsConsidered}{' '}
                          recent reviewed sessions
                        </span>
                      </div>
                      {r.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-[#27405e] bg-[#08182a] px-3 py-2 text-[9px] text-[#6f849d]">
                No recurring patterns yet across prior reviews — this is the
                baseline session for your self-evolution memory.
              </div>
            )}

            <div>
              <div className="mb-2 flex items-center gap-2">
                <AlertTriangle size={12} className="text-[#f0a35b]" />
                <h3 className="text-[10px] font-semibold text-[#dbe6f3]">
                  Bad-decision patterns flagged ({patterns.length})
                </h3>
              </div>
              {patterns.length ? (
                <ul className="space-y-2">
                  {patterns.map((p) => (
                    <li
                      key={p.id}
                      className="rounded-lg border border-[#4d3a24] bg-[#241a0e] px-3 py-2 text-[9px] leading-3.75 text-[#e3c79a]"
                    >
                      <span className="mb-1 inline-block rounded bg-[#3a2a14] px-1.5 py-0.5 font-mono text-[7px] text-[#d4b48a]">
                        {p.id}
                      </span>
                      <p className="mt-1">{p.message}</p>
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
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ClipboardCheck size={12} className="text-[#3bdbbc]" />
                  <h3 className="text-[10px] font-semibold text-[#dbe6f3]">
                    Reusable checklist for the next idea
                  </h3>
                </div>
                <span className="text-[7px] text-[#5f7189]">
                  Click to check off
                </span>
              </div>
              <ul className="space-y-2">
                {review.checklist.map((item, i) => {
                  const on = Boolean(checked[i]);
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() =>
                          setChecked((prev) => ({ ...prev, [i]: !prev[i] }))
                        }
                        className={`flex w-full cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-left transition ${
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
                            className={`text-[9px] font-medium ${
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

            <div>
              <button
                type="button"
                onClick={() => setShowMarkdown((v) => !v)}
                className="flex cursor-pointer items-center gap-1 text-[9px] font-medium text-[#57d9ff]"
              >
                <ChevronDown
                  size={12}
                  className={`transition-transform ${showMarkdown ? 'rotate-180' : ''}`}
                />
                {showMarkdown ? 'Hide' : 'Show'} full review report
              </button>
              {showMarkdown ? (
                <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-[#183754] bg-[#09182a] p-3 text-[8px] leading-3.5 text-[#9ab0c6]">
                  {review.markdown}
                </pre>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#183754] bg-[#09182a] px-2.5 py-2">
      <p className="text-[7px] uppercase tracking-wide text-[#6f849d]">{label}</p>
      <p className="mt-1 text-[12px] font-semibold text-[#dce7f3]">{value}</p>
    </div>
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
