'use client';

import { useEffect, useState } from 'react';
import { Folder, Check, XCircle, Loader2, ArrowLeft } from 'lucide-react';
import { useResearch } from '@/lib/research-context';
import { AssetLogo } from '../ui/AssetLogo';
import { NumberBadge } from '../ui/NumberBadge';
import { ResearchProgress } from '../research/ResearchProgress';
import { ResearchSkills } from '../research/ResearchSkills';
import { ResearchThesis } from '../research/ResearchThesis';
import { SelfReview } from '../research/SelfReview';
import { AIConclusion } from '../research/AIConclusion';

export function MyResearchView() {
  const {
    recent,
    refreshRecent,
    openSession,
    session,
    clearSession,
    error,
  } = useResearch();
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    void refreshRecent();
  }, [refreshRecent]);

  // Entering My Research always starts on the list; opening a row loads detail.
  useEffect(() => {
    setShowDetail(false);
  }, []);

  const statusLabel = (status: string) => {
    if (status === 'COMPLETED') return 'Complete';
    if (status === 'FAILED') return 'Failed';
    return 'In progress';
  };

  const onOpen = async (sessionId: string) => {
    setOpeningId(sessionId);
    try {
      await openSession(sessionId);
      setShowDetail(true);
    } finally {
      setOpeningId(null);
    }
  };

  const onBack = () => {
    setShowDetail(false);
    clearSession();
  };

  if (showDetail && session) {
    return (
      <div className="space-y-2 p-2">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#173a5a] bg-[#071424] px-4 py-3">
          <button
            type="button"
            onClick={onBack}
            className="flex cursor-pointer items-center gap-1.5 text-[9px] font-medium text-[#57d9ff] transition hover:text-[#7fe4ff]"
          >
            <ArrowLeft size={10} />
            Back to list
          </button>
          <div className="min-w-0 text-right">
            <p className="truncate text-[11px] font-semibold text-[#e3ebf4]">
              {session.symbol ?? 'Research'}
              {session.thesis?.direction
                ? ` · ${
                    session.thesis.direction === 'long'
                      ? 'Bullish'
                      : session.thesis.direction === 'short'
                        ? 'Bearish'
                        : 'Neutral'
                  }`
                : ''}
            </p>
            <p className="truncate text-[8px] text-[#8ea2b8]">{session.question}</p>
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-[#5c2b34] bg-[#2a141b] px-4 py-3 text-[10px] text-[#f5a0a6]">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-2 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-2">
            <ResearchProgress />
            <ResearchThesis />
            <SelfReview />
          </div>
          <div className="min-w-0 space-y-2">
            <ResearchSkills />
            <AIConclusion embedded />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2">
      <section className="relative rounded-lg border border-[#173a5a] bg-[#071424]">
        <NumberBadge number="1" />

        <div className="flex items-center justify-between border-b border-[#142b44] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-5 w-5 items-center justify-center rounded-full border border-[#19c8ef]">
              <Folder size={10} className="text-[#21c9ed]" />
            </div>
            <h2 className="text-[13px] font-semibold">My Research</h2>
          </div>

          <button
            type="button"
            onClick={() => void refreshRecent()}
            className="cursor-pointer text-[9px] font-medium text-[#57d9ff]"
          >
            Refresh
          </button>
        </div>

        <div className="p-3">
          {error ? (
            <div className="mb-3 rounded-lg border border-[#5c2b34] bg-[#2a141b] px-4 py-3 text-[10px] text-[#f5a0a6]">
              {error}
            </div>
          ) : null}

          {recent.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#27405e] bg-[#08182a] p-8 text-center">
              <p className="text-[11px] text-[#8ea2b8]">
                No research sessions yet.
              </p>
              <p className="mt-1 text-[9px] text-[#63778f]">
                Head to the Research Desk and ask a question.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {recent.map((r) => {
                const busy = openingId === r.sessionId;
                return (
                  <button
                    key={r.sessionId}
                    type="button"
                    disabled={Boolean(openingId)}
                    onClick={() => void onOpen(r.sessionId)}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-[#112a43] bg-[#08182a] p-3 text-left transition hover:border-[#24496d] hover:bg-[#0b1e33] disabled:cursor-wait disabled:opacity-70"
                  >
                    <AssetLogo type={r.symbol?.toLowerCase() ?? 'nvda'} />

                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-[#e3ebf4]">
                        {r.symbol ?? 'Unknown'}
                        {r.direction
                          ? ` · ${r.direction === 'long' ? 'Bullish' : r.direction === 'short' ? 'Bearish' : 'Neutral'}`
                          : ''}
                      </p>
                      <p className="truncate text-[9px] text-[#8ea2b8]">
                        {r.question}
                      </p>
                      <p className="mt-1 text-[8px] text-[#63778f]">
                        {timeAgo(r.createdAt)}
                        {r.confidence != null
                          ? ` · ${Math.round(r.confidence * 100)}% confidence`
                          : ''}
                      </p>
                    </div>

                    {busy ? (
                      <span className="flex shrink-0 items-center gap-1 rounded bg-[#1c3048] px-2 py-1 text-[7px] font-semibold text-[#8298b2]">
                        <Loader2 size={9} className="animate-spin" />
                        Loading
                      </span>
                    ) : (
                      <StatusPill
                        status={r.status}
                        label={statusLabel(r.status)}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function StatusPill({ status, label }: { status: string; label: string }) {
  if (status === 'COMPLETED') {
    return (
      <span className="flex shrink-0 items-center gap-1 rounded bg-[#06413f] px-2 py-1 text-[7px] font-semibold text-[#39dcbf]">
        <Check size={9} />
        {label}
      </span>
    );
  }
  if (status === 'FAILED') {
    return (
      <span className="flex shrink-0 items-center gap-1 rounded bg-[#4d2227] px-2 py-1 text-[7px] font-semibold text-[#f55e64]">
        <XCircle size={9} />
        {label}
      </span>
    );
  }
  return (
    <span className="flex shrink-0 items-center gap-1 rounded bg-[#1c3048] px-2 py-1 text-[7px] font-semibold text-[#8298b2]">
      <Loader2 size={9} className="animate-spin" />
      {label}
    </span>
  );
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
